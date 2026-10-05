const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const { rotateSessions } = require("../../scripts/rotate-sessions.cjs");

test("rotate-sessions: halts safely without explicit confirmation flag", (t) => {
  const tempDb = path.join(os.tmpdir(), `test-rot-db-${crypto.randomUUID()}.json`);
  fs.writeFileSync(
    tempDb,
    JSON.stringify({ users: { alice: { xp: 100 } }, sessions: { token1: {} } }),
    "utf8"
  );
  t.after(() => {
    try { fs.unlinkSync(tempDb); } catch {}
  });

  const res = rotateSessions(tempDb, { forceConfirm: false });
  assert.equal(res.success, false);
  assert.equal(res.reason, "MISSING_CONFIRMATION");

  // File must remain untouched
  const content = JSON.parse(fs.readFileSync(tempDb, "utf8"));
  assert.equal(Object.keys(content.sessions).length, 1);
});

test("rotate-sessions: clears sessions while preserving user accounts and creating backup", (t) => {
  const tempDb = path.join(os.tmpdir(), `test-rot-db-${crypto.randomUUID()}.json`);
  const backupDb = `${tempDb}.bak`;
  const initialData = {
    users: {
      trainer1: { xp: 250, stats: { wins: 5 } },
      trainer2: { xp: 400, stats: { wins: 10 } },
    },
    sessions: {
      secret_tok_1: { username: "trainer1" },
      secret_tok_2: { username: "trainer2" },
    },
  };
  fs.writeFileSync(tempDb, JSON.stringify(initialData, null, 2), "utf8");

  t.after(() => {
    try { fs.unlinkSync(tempDb); } catch {}
    try { fs.unlinkSync(backupDb); } catch {}
  });

  const res = rotateSessions(tempDb, { forceConfirm: true });
  assert.equal(res.success, true);
  assert.equal(res.sessionCount, 2);
  assert.equal(res.userCount, 2);

  // Backup exists with original data
  assert.ok(fs.existsSync(backupDb));
  const backupData = JSON.parse(fs.readFileSync(backupDb, "utf8"));
  assert.equal(Object.keys(backupData.sessions).length, 2);

  // Rotated DB has empty sessions and all users intact
  const rotatedData = JSON.parse(fs.readFileSync(tempDb, "utf8"));
  assert.deepEqual(rotatedData.sessions, {});
  assert.equal(Object.keys(rotatedData.users).length, 2);
  assert.equal(rotatedData.users.trainer1.xp, 250);
});
