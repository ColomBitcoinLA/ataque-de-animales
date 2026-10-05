const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hashPasswordScrypt,
  hashPasswordLegacy,
  generateSalt,
  verifyPassword,
  timingSafeCompare,
} = require("../../lib/security/passwords.js");

test("passwords: timingSafeCompare handles matching, non-matching and different length strings safely", () => {
  assert.equal(timingSafeCompare("secret-token-123", "secret-token-123"), true);
  assert.equal(timingSafeCompare("secret-token-123", "secret-token-456"), false);
  assert.equal(timingSafeCompare("short", "much-longer-string"), false);
  assert.equal(timingSafeCompare("", "non-empty"), false);
  assert.equal(timingSafeCompare("", ""), true);
  assert.equal(timingSafeCompare(null, "test"), false);
  assert.equal(timingSafeCompare(123, 123), false);
});

test("passwords: hashPasswordScrypt produces scrypt: prefixed derived key asynchronously", async () => {
  const salt = generateSalt();
  const hash = await hashPasswordScrypt("hunter2", salt);

  assert.ok(hash.startsWith("scrypt:"));
  assert.equal(hash.length, 7 + 128); // "scrypt:" + 64 bytes in hex (128 chars)
});

test("passwords: verifyPassword validates correct modern scrypt password asynchronously", async () => {
  const salt = generateSalt();
  const passwordHash = await hashPasswordScrypt("MySecurePass#2026", salt);
  const user = { salt, passwordHash };

  const result = await verifyPassword("MySecurePass#2026", user);
  assert.equal(result.valid, true);
  assert.equal(result.needsMigration, false);
});

test("passwords: verifyPassword rejects incorrect password asynchronously", async () => {
  const salt = generateSalt();
  const passwordHash = await hashPasswordScrypt("CorrectPassword", salt);
  const user = { salt, passwordHash };

  const result = await verifyPassword("WrongPassword", user);
  assert.equal(result.valid, false);
  assert.equal(result.needsMigration, false);
});

test("passwords: verifyPassword validates legacy SHA-256 and signals migration asynchronously", async () => {
  const salt = generateSalt();
  const legacyHash = hashPasswordLegacy("LegacyPassword123", salt);
  const user = { salt, passwordHash: legacyHash };

  const result = await verifyPassword("LegacyPassword123", user);
  assert.equal(result.valid, true);
  assert.equal(result.needsMigration, true);
  assert.ok(typeof result.upgradedSalt === "string");
  assert.ok(result.upgradedHash.startsWith("scrypt:"));

  // Verify that subsequent check with upgraded credentials validates as modern scrypt
  const upgradedUser = {
    salt: result.upgradedSalt,
    passwordHash: result.upgradedHash,
  };
  const recheck = await verifyPassword("LegacyPassword123", upgradedUser);
  assert.equal(recheck.valid, true);
  assert.equal(recheck.needsMigration, false);
});

test("passwords: verifyPassword rejects invalid user records safely", async () => {
  assert.equal((await verifyPassword("pass", null)).valid, false);
  assert.equal((await verifyPassword("pass", {})).valid, false);
  assert.equal((await verifyPassword("pass", { salt: "123" })).valid, false);
});
