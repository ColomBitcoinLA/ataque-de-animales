const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");

const FILES_TO_CHECK = [
  "index.js",
  "lib/security/passwords.js",
  "lib/security/google-token.js",
  "lib/security/rate-limiter.js",
  "lib/security/cors-config.js",
  "scripts/check-syntax.cjs",
  "scripts/perf-baseline.cjs",
  "scripts/rotate-sessions.cjs",
  "scripts/m0-gate.cjs",
  "js/domain/constants.mjs",
  "js/domain/valueObjects.mjs",
  "js/domain/SpeciesDefinition.mjs",
  "js/domain/CreatureIndividual.mjs",
  "js/domain/defaultSpecies.mjs",
  "js/domain/index.mjs",
  "js/domain/index.cjs",
  "js/simulation/MovementSystem.mjs",
  "js/simulation/interpolation.mjs",
  "js/simulation/CollisionSystem.mjs",
  "js/simulation/index.mjs",
  "js/simulation/index.cjs",
  "js/compat/speciesResolver.mjs",
  "js/compat/LegacyAnimalAdapter.mjs",
  "js/compat/index.mjs",
  "js/compat/index.cjs",
  "js/rules/elementalRules.mjs",
  "js/rules/index.mjs",
  "js/rules/index.cjs",
  "forge/index.mjs",
  "forge/index.cjs",
  "forge/cli.mjs",
  "forge/core/schema.mjs",
  "forge/core/ids.mjs",
  "forge/core/hash.mjs",
  "forge/core/fsutil.mjs",
  "forge/core/result.mjs",
  "forge/core/paths.mjs",
  "forge/art-bible.mjs",
  "forge/archetypes.mjs",
  "forge/species-registry.mjs",
  "forge/variants.mjs",
  "forge/evolutions.mjs",
  "forge/world-registry.mjs",
  "forge/domain-link.mjs",
  "forge/adapters/h3cSalamander.mjs",
  "forge/blockout.mjs",
  "forge/pipeline.mjs",
  "forge/scripts/sync-salamander.mjs",
  "tests/helpers/server-process.cjs",
  "tests/helpers/websocket-client.cjs",
  "tests/integration/server-health.test.cjs",
  "tests/integration/websocket.test.cjs",
  "tests/integration/multiplayer-contracts.test.cjs",
  "tests/integration/security.test.cjs",
  "tests/integration/body-parser-compressed.test.cjs",
  "tests/unit/domain.test.cjs",
  "tests/unit/simulation.test.cjs",
  "tests/unit/compat.test.cjs",
  "tests/unit/rules.test.cjs",
  "tests/unit/passwords.test.cjs",
  "tests/unit/google-token.test.cjs",
  "tests/unit/rate-limiter.test.cjs",
  "tests/unit/rotate-sessions.test.cjs",
  "tests/unit/forge-core.test.cjs",
  "tests/unit/forge-registry.test.cjs",
  "tests/unit/forge-cli.test.cjs",
];

const BROWSER_ESM_FILES = [
  "js/entities/Animal.js",
  "js/core/typeChart.js",
  "js/3d/Arena3D.js",
  "js/ui/UIManager.js",
  "js/main.js",
];

function checkBrowserEsmSyntax() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "animal-combat-esm-check-"));
  let hasError = false;
  try {
    for (const relativePath of BROWSER_ESM_FILES) {
      const sourcePath = path.join(ROOT_DIR, relativePath);
      if (!fs.existsSync(sourcePath)) {
        console.error(`✖ Missing browser ESM file: ${relativePath}`);
        hasError = true;
        continue;
      }
      const tempPath = path.join(tempDir, `${path.basename(relativePath, ".js")}.mjs`);
      fs.writeFileSync(tempPath, fs.readFileSync(sourcePath, "utf8"), "utf8");
      const res = spawnSync(process.execPath, ["--check", tempPath], {
        cwd: ROOT_DIR,
        encoding: "utf8",
      });
      if (res.status !== 0) {
        console.error(`✖ Browser ESM syntax error in ${relativePath}:`);
        if (res.stderr) console.error(res.stderr);
        hasError = true;
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return !hasError;
}

function checkAllSyntax() {
  console.log(`Checking syntax for ${FILES_TO_CHECK.length} files...`);
  let hasError = false;

  for (const relativePath of FILES_TO_CHECK) {
    const fullPath = path.join(ROOT_DIR, relativePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`✖ Missing file: ${relativePath}`);
      hasError = true;
      continue;
    }

    const res = spawnSync(process.execPath, ["--check", fullPath], {
      cwd: ROOT_DIR,
      encoding: "utf8",
    });

    if (res.status !== 0) {
      console.error(`✖ Syntax error in ${relativePath}:`);
      if (res.stderr) console.error(res.stderr);
      hasError = true;
    }
  }

  if (!checkBrowserEsmSyntax()) hasError = true;

  if (hasError) {
    console.error("Syntax check failed.");
    process.exit(1);
  }

  console.log(`✔ All ${FILES_TO_CHECK.length} Node/CJS/MJS files passed syntax check.`);
  console.log(`✔ All ${BROWSER_ESM_FILES.length} browser ESM files passed syntax check.`);
}

if (require.main === module) {
  checkAllSyntax();
}

module.exports = {
  FILES_TO_CHECK,
  BROWSER_ESM_FILES,
  checkBrowserEsmSyntax,
  checkAllSyntax,
};
