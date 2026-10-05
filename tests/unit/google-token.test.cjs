const test = require("node:test");
const assert = require("node:assert/strict");

const {
  verifyGoogleIdToken,
  setTestVerifier,
  resetTestVerifier,
} = require("../../lib/security/google-token.js");

test("google-token: fails closed when GOOGLE_CLIENT_ID is not configured", async () => {
  await assert.rejects(
    async () => {
      await verifyGoogleIdToken("some.jwt.token", undefined);
    },
    (err) => {
      assert.equal(err.code, "AUTH_NOT_CONFIGURED");
      assert.equal(err.status, 503);
      return true;
    }
  );
});

test("google-token: rejects missing or empty idToken", async () => {
  await assert.rejects(
    async () => {
      await verifyGoogleIdToken("", "client-id-123");
    },
    (err) => {
      assert.equal(err.code, "INVALID_TOKEN");
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test("google-token: test verifier simulates valid token verification successfully", async (t) => {
  setTestVerifier(async (token, clientId) => {
    if (token === "valid-google-jwt" && clientId === "expected-client-id") {
      return {
        email: "verified_user@gmail.com",
        name: "Ash Ketchum",
        picture: "https://example.com/avatar.png",
        sub: "google-sub-12345",
      };
    }
    const err = new Error("Invalid token");
    err.status = 401;
    throw err;
  });

  t.after(() => resetTestVerifier());

  const result = await verifyGoogleIdToken("valid-google-jwt", "expected-client-id");
  assert.equal(result.email, "verified_user@gmail.com");
  assert.equal(result.name, "Ash Ketchum");
  assert.equal(result.sub, "google-sub-12345");
});

test("google-token: test verifier rejects untrusted issuer or bad audience", async (t) => {
  setTestVerifier(async (token) => {
    if (token === "bad-aud") {
      const err = new Error("Audience mismatch");
      err.code = "INVALID_AUDIENCE";
      err.status = 401;
      throw err;
    }
    if (token === "unverified-email") {
      const err = new Error("Email not verified");
      err.code = "EMAIL_NOT_VERIFIED";
      err.status = 401;
      throw err;
    }
    throw new Error("Generic failure");
  });

  t.after(() => resetTestVerifier());

  await assert.rejects(
    async () => verifyGoogleIdToken("bad-aud", "my-client-id"),
    (err) => err.code === "INVALID_AUDIENCE" && err.status === 401
  );

  await assert.rejects(
    async () => verifyGoogleIdToken("unverified-email", "my-client-id"),
    (err) => err.code === "EMAIL_NOT_VERIFIED" && err.status === 401
  );
});
