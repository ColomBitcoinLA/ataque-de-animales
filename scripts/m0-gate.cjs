const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  startTestServer,
  stopTestServer,
} = require("../tests/helpers/server-process.cjs");
const { runPerfBaseline } = require("./perf-baseline.cjs");

const ROOT_DIR = path.resolve(__dirname, "..");

function runCommand(commandLine, options = {}) {
  const result = spawnSync(commandLine, {
    cwd: ROOT_DIR,
    shell: true,
    encoding: "utf8",
    ...options,
  });
  return {
    code: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

const checks = [];

function recordCheck(name, passed, details = "") {
  checks.push({ name, passed, details });
  const symbol = passed ? "✔" : "✖";
  console.log(`[${symbol}] ${name}${details ? ` (${details})` : ""}`);
}

async function runM0Gate() {
  console.log("==================================================");
  console.log("🛡️  M0 SAFETY NET REGRESSION GATE");
  console.log("==================================================");

  // 1. Node Version >= 24
  const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
  recordCheck(
    "1. Node.js Environment",
    nodeMajor >= 24,
    `v${process.versions.node}`
  );

  // 2. pnpm-lock.yaml present
  const hasPnpmLock = fs.existsSync(path.join(ROOT_DIR, "pnpm-lock.yaml"));
  recordCheck("2. pnpm-lock.yaml present", hasPnpmLock);

  // 3. package-lock.json absent
  const hasPackageLock = fs.existsSync(path.join(ROOT_DIR, "package-lock.json"));
  recordCheck("3. package-lock.json absent", !hasPackageLock);

  // 4. node_modules NOT tracked in git
  const gitLsModules = runCommand("git ls-files node_modules");
  const trackedModulesCount = gitLsModules.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;
  recordCheck(
    "4. node_modules untracked in Git",
    trackedModulesCount === 0,
    `${trackedModulesCount} tracked files`
  );

  // 5. pnpm install --frozen-lockfile
  const pnpmInstall = runCommand("pnpm install --frozen-lockfile");
  recordCheck(
    "5. pnpm install --frozen-lockfile reproducible",
    pnpmInstall.code === 0,
    pnpmInstall.code === 0 ? "OK" : pnpmInstall.stderr.slice(0, 100)
  );

  // 6. Syntax Checks (node --check)
  const filesToCheck = [
    "index.js",
    "lib/security/passwords.js",
    "lib/security/google-token.js",
    "lib/security/rate-limiter.js",
    "lib/security/cors-config.js",
    "scripts/perf-baseline.cjs",
    "scripts/rotate-sessions.cjs",
    "scripts/m0-gate.cjs",
    "tests/helpers/server-process.cjs",
    "tests/helpers/websocket-client.cjs",
    "tests/integration/server-health.test.cjs",
    "tests/integration/websocket.test.cjs",
    "tests/integration/multiplayer-contracts.test.cjs",
    "tests/integration/security.test.cjs",
    "tests/unit/passwords.test.cjs",
    "tests/unit/google-token.test.cjs",
    "tests/unit/rate-limiter.test.cjs",
    "tests/unit/rotate-sessions.test.cjs",
  ];

  let syntaxOk = true;
  for (const f of filesToCheck) {
    const fullPath = path.join(ROOT_DIR, f);
    if (!fs.existsSync(fullPath)) {
      syntaxOk = false;
      break;
    }
    const checkRes = runCommand(`node --check "${fullPath}"`);
    if (checkRes.code !== 0) {
      syntaxOk = false;
      break;
    }
  }
  recordCheck("6. JavaScript Syntax Checks", syntaxOk, `${filesToCheck.length} files`);

  // 7. Full Test Suite (pnpm test)
  const testRes = runCommand('node --test "tests/**/*.test.cjs"');
  recordCheck(
    "7. Full Test Suite (Unit & Integration)",
    testRes.code === 0,
    testRes.code === 0 ? "All tests passing" : "Test failure"
  );

  // 8. Performance Smoke/Baseline
  let perfOk = false;
  try {
    const perfResults = await runPerfBaseline();
    perfOk = Boolean(perfResults && perfResults.bootDurationMs > 0);
  } catch (err) {
    perfOk = false;
  }
  recordCheck("8. Performance Baseline Execution", perfOk);

  // 9a. git diff --check (unstaged)
  const diffCheck = runCommand("git diff --check");
  recordCheck(
    "9a. git diff --check (unstaged whitespace/conflicts)",
    diffCheck.code === 0,
    diffCheck.code === 0 ? "Clean" : diffCheck.stderr
  );

  // 9b. git diff --cached --check (staged)
  const cachedDiffCheck = runCommand("git diff --cached --check");
  recordCheck(
    "9b. git diff --cached --check (staged whitespace/conflicts)",
    cachedDiffCheck.code === 0,
    cachedDiffCheck.code === 0 ? "Clean" : cachedDiffCheck.stderr
  );

  // 10. No Unexpected Temporary Files
  const dataDir = path.join(ROOT_DIR, "data");
  let tempFilesOk = true;
  if (fs.existsSync(dataDir)) {
    const entries = fs.readdirSync(dataDir);
    if (entries.some((e) => e.endsWith(".tmp"))) {
      tempFilesOk = false;
    }
  }
  recordCheck("10. Temporary Persistence Hygiene", tempFilesOk, "no .tmp artifacts");

  // 11. Server Isolated Lifecycle (Spawn, /health, Clean Stop)
  let lifecycleOk = false;
  try {
    const srv = await startTestServer();
    const h = await (await fetch(`${srv.url}/health`)).json();
    await stopTestServer(srv);
    lifecycleOk = h && h.ok === true;
  } catch {
    lifecycleOk = false;
  }
  recordCheck("11. Clean Server Boot & Shutdown Lifecycle", lifecycleOk);

  // 12. Dependency Security Gate (High / Critical vulnerabilities)
  const auditRes = runCommand("pnpm audit --audit-level high");
  recordCheck(
    "12. Dependency Security Gate (zero High/Critical advisories)",
    auditRes.code === 0,
    auditRes.code === 0 ? "No High/Critical vulnerabilities" : "High/Critical vulnerabilities detected"
  );

  console.log("==================================================");
  const totalPassed = checks.filter((c) => c.passed).length;
  const totalFailed = checks.filter((c) => !c.passed).length;
  if (totalFailed === 0) {
    console.log(`🎉 ALL M0 REGRESSION GATE CHECKS PASSED (${totalPassed}/${checks.length})`);
    console.log("==================================================");
    process.exit(0);
  } else {
    console.error(`❌ M0 GATE FAILED: ${totalFailed} check(s) failed.`);
    console.log("==================================================");
    process.exit(1);
  }
}

runM0Gate().catch((err) => {
  console.error("Fatal Gate Error:", err);
  process.exit(1);
});
