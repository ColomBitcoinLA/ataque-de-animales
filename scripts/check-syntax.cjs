const path = require("node:path");
const fs = require("node:fs");
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
  "tests/helpers/server-process.cjs",
  "tests/helpers/websocket-client.cjs",
  "tests/integration/server-health.test.cjs",
  "tests/integration/websocket.test.cjs",
  "tests/integration/multiplayer-contracts.test.cjs",
  "tests/integration/security.test.cjs",
  "tests/unit/domain.test.cjs",
  "tests/unit/simulation.test.cjs",
  "tests/unit/compat.test.cjs",
  "tests/unit/passwords.test.cjs",
  "tests/unit/google-token.test.cjs",
  "tests/unit/rate-limiter.test.cjs",
  "tests/unit/rotate-sessions.test.cjs",
];

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

  if (hasError) {
    console.error("Syntax check failed.");
    process.exit(1);
  }

  console.log(`✔ All ${FILES_TO_CHECK.length} files passed syntax check.`);
}

if (require.main === module) {
  checkAllSyntax();
}

module.exports = {
  FILES_TO_CHECK,
  checkAllSyntax,
};
