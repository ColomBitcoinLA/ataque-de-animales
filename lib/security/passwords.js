const crypto = require("node:crypto");
const util = require("node:util");

const scryptAsync = util.promisify(crypto.scrypt);

const SCRYPT_PREFIX = "scrypt:";
const KEY_LENGTH = 64;
const DEFAULT_SALT_BYTES = 16;

/**
 * Timing-safe string comparison.
 * Returns false if lengths differ without leaking timing info.
 */
function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hash a password using Node's native asynchronous scrypt KDF (non-blocking).
 */
async function hashPasswordScrypt(password, salt) {
  if (typeof password !== "string" || !password) {
    throw new TypeError("Password must be a non-empty string");
  }
  if (typeof salt !== "string" || !salt) {
    throw new TypeError("Salt must be a non-empty string");
  }
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `${SCRYPT_PREFIX}${derived.toString("hex")}`;
}

/**
 * Legacy SHA-256 password hash for backwards compatibility.
 */
function hashPasswordLegacy(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

/**
 * Generate a cryptographically secure random salt hex string.
 */
function generateSalt(byteLength = DEFAULT_SALT_BYTES) {
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * Verify a password against a user record asynchronously.
 * Supports modern scrypt hashes and legacy SHA-256 hashes with automatic migration signal.
 */
async function verifyPassword(password, user) {
  if (!user || typeof user !== "object" || !user.passwordHash || !user.salt) {
    return { valid: false, needsMigration: false };
  }

  const storedHash = user.passwordHash;

  // Modern scrypt format
  if (storedHash.startsWith(SCRYPT_PREFIX)) {
    const computed = await hashPasswordScrypt(password, user.salt);
    const valid = timingSafeCompare(storedHash, computed);
    return { valid, needsMigration: false };
  }

  // Legacy SHA-256 format
  const legacyComputed = hashPasswordLegacy(password, user.salt);
  const legacyValid = timingSafeCompare(storedHash, legacyComputed);

  if (legacyValid) {
    // Produce upgraded salt and scrypt hash for transparent lazy migration
    const upgradedSalt = generateSalt();
    const upgradedHash = await hashPasswordScrypt(password, upgradedSalt);
    return {
      valid: true,
      needsMigration: true,
      upgradedSalt,
      upgradedHash,
    };
  }

  return { valid: false, needsMigration: false };
}

module.exports = {
  timingSafeCompare,
  hashPasswordScrypt,
  hashPasswordLegacy,
  generateSalt,
  verifyPassword,
};
