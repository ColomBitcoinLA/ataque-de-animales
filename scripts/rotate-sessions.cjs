/**
 * OPERATIONAL SCRIPT: Invalidate / Rotate Active Sessions (SEC-04D)
 *
 * This script provides a safe operational procedure to invalidate pre-existing
 * session tokens from database.json without affecting accounts, passwords, or stats.
 *
 * SAFETY GUARD:
 * Requires the explicit flag `--confirm` to execute. Without `--confirm`,
 * it exits without making any modifications.
 *
 * USAGE:
 *   node scripts/rotate-sessions.cjs --confirm
 */

const fs = require("node:fs");
const path = require("node:path");

function rotateSessions(dbPath, { dryRun = false, forceConfirm = false } = {}) {
  const targetPath =
    dbPath ||
    process.env.ANIMAL_COMBAT_DB_PATH ||
    path.join(__dirname, "..", "data", "database.json");

  if (!forceConfirm && !process.argv.includes("--confirm")) {
    console.error("==================================================");
    console.error("⚠️  SAFETY HALT: Session rotation requires explicit confirmation.");
    console.error("Run with '--confirm' to proceed:");
    console.error("  node scripts/rotate-sessions.cjs --confirm");
    console.error("==================================================");
    return { success: false, reason: "MISSING_CONFIRMATION" };
  }

  if (!fs.existsSync(targetPath)) {
    console.error(`Target database file not found at: ${targetPath}`);
    return { success: false, reason: "FILE_NOT_FOUND" };
  }

  const raw = fs.readFileSync(targetPath, "utf8");
  let db;
  try {
    db = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to parse database file: ${err.message}`);
    return { success: false, reason: "PARSE_ERROR" };
  }

  const sessionCount = Object.keys(db.sessions || {}).length;
  const userCount = Object.keys(db.users || {}).length;

  console.log(`Found ${sessionCount} active session(s) and ${userCount} user account(s).`);

  if (dryRun) {
    console.log("[DRY-RUN] No changes written.");
    return { success: true, sessionCount, userCount, dryRun: true };
  }

  // 1. Create backup
  const backupPath = `${targetPath}.bak`;
  fs.writeFileSync(backupPath, raw, "utf8");
  console.log(`Backup created at: ${backupPath}`);

  // 2. Invalidate sessions only (users, history, stats remain 100% untouched)
  db.sessions = {};

  // 3. Atomic write
  const tmpPath = `${targetPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmpPath, targetPath);

  console.log(`✅ Success: ${sessionCount} session token(s) revoked. ${userCount} user(s) preserved.`);
  return { success: true, sessionCount, userCount };
}

if (require.main === module) {
  const result = rotateSessions();
  if (!result.success) {
    process.exit(1);
  }
}

module.exports = { rotateSessions };
