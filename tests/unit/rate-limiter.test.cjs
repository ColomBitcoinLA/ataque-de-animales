const test = require("node:test");
const assert = require("node:assert/strict");

const { RateLimiter } = require("../../lib/security/rate-limiter.js");

test("rate-limiter: allows requests within limit and blocks excess", () => {
  const limiter = new RateLimiter({ windowMs: 10_000, maxRequests: 2, cleanupIntervalMs: 0 });

  let status = null;
  let responseBody = null;
  let headers = {};

  const fakeRes = {
    status(code) {
      status = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
    setHeader(name, val) {
      headers[name] = val;
    },
  };

  const fakeReq = { socket: { remoteAddress: "192.168.1.1" } };
  const middleware = limiter.middleware();

  let nextCalled = 0;
  const next = () => { nextCalled++; };

  // First request: OK
  middleware(fakeReq, fakeRes, next);
  assert.equal(nextCalled, 1);
  assert.equal(status, null);

  // Second request: OK
  middleware(fakeReq, fakeRes, next);
  assert.equal(nextCalled, 2);
  assert.equal(status, null);

  // Third request: Blocked (429)
  middleware(fakeReq, fakeRes, next);
  assert.equal(nextCalled, 2);
  assert.equal(status, 429);
  assert.deepEqual(responseBody, { error: "Demasiadas peticiones" });
  assert.ok(headers["Retry-After"] > 0);

  limiter.destroy();
});

test("rate-limiter: cleanup removes expired entries", () => {
  const limiter = new RateLimiter({ windowMs: 100, maxRequests: 5, cleanupIntervalMs: 0 });

  limiter.hits.set("old-ip", { count: 3, resetAt: Date.now() - 500 });
  limiter.hits.set("active-ip", { count: 1, resetAt: Date.now() + 5000 });

  assert.equal(limiter.hits.size, 2);
  limiter.cleanup();
  assert.equal(limiter.hits.size, 1);
  assert.equal(limiter.hits.has("old-ip"), false);
  assert.equal(limiter.hits.has("active-ip"), true);

  limiter.destroy();
});

test("rate-limiter: respects proxy-aware req.ip over raw socket remoteAddress", () => {
  const limiter = new RateLimiter({ windowMs: 10_000, maxRequests: 2, cleanupIntervalMs: 0 });
  const middleware = limiter.middleware();

  let nextCalled = 0;
  const next = () => { nextCalled++; };
  const dummyRes = { status() { return this; }, json() {}, setHeader() {} };

  // Two different client IPs arriving through the same reverse proxy socket (10.0.0.1)
  const clientA = { ip: "203.0.113.195", socket: { remoteAddress: "10.0.0.1" } };
  const clientB = { ip: "198.51.100.42", socket: { remoteAddress: "10.0.0.1" } };

  // Client A exhausts its 2 requests
  middleware(clientA, dummyRes, next);
  middleware(clientA, dummyRes, next);
  assert.equal(nextCalled, 2);

  // Client B should NOT be blocked despite sharing proxy socket address
  middleware(clientB, dummyRes, next);
  assert.equal(nextCalled, 3);

  limiter.destroy();
});
