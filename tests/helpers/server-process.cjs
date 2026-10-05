const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address.port;

      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });

    server.on("error", reject);
  });
}

async function waitForHealth(port, child, timeoutMs = 5000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before becoming ready (code ${child.exitCode})`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Server did not become healthy within ${timeoutMs}ms${lastError ? `: ${lastError.message}` : ""}`
  );
}

async function startTestServer(options = {}) {
  const port = await getFreePort();
  const rootDir = path.resolve(__dirname, "../..");

  // Isolated temporary database for persistence tests
  const tempDbPath =
    options.dbPath ||
    path.join(os.tmpdir(), `ac-test-db-${crypto.randomUUID()}.json`);

  if (!fs.existsSync(tempDbPath)) {
    fs.writeFileSync(
      tempDbPath,
      JSON.stringify(options.initialDb || { users: {}, sessions: {} }, null, 2),
      "utf8"
    );
  }

  const child = spawn(process.execPath, ["index.js"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      ANIMAL_COMBAT_DB_PATH: tempDbPath,
      NODE_ENV: options.nodeEnv || "development",
      ...options.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForHealth(port, child);
  } catch (error) {
    child.kill();
    cleanupTempDb(tempDbPath);

    throw new Error(
      `${error.message}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
    );
  }

  return {
    child,
    port,
    tempDbPath,
    url: `http://127.0.0.1:${port}`,
    wsUrl: `ws://127.0.0.1:${port}`,
    getOutput() {
      return { stdout, stderr };
    },
  };
}

function cleanupTempDb(dbPath) {
  if (!dbPath) return;
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch {}
  try {
    if (fs.existsSync(dbPath + ".tmp")) fs.unlinkSync(dbPath + ".tmp");
  } catch {}
}

async function stopTestServer(serverOrChild) {
  if (!serverOrChild) return;

  const child = serverOrChild.child || serverOrChild;
  const tempDbPath = serverOrChild.tempDbPath;

  if (child && child.exitCode === null) {
    child.kill();

    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2000);

      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  cleanupTempDb(tempDbPath);
}

module.exports = {
  startTestServer,
  stopTestServer,
};
