const test = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");

const {
  startTestServer,
  stopTestServer,
} = require("../helpers/server-process.cjs");
const { connectWs } = require("../helpers/websocket-client.cjs");

test("Security SEC-03: Sensitive backend files are NOT exposed statically", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const forbiddenPaths = [
    "/data/database.json",
    "/data/database.json.tmp",
    "/package.json",
    "/pnpm-lock.yaml",
    "/index.js",
    "/.gitignore",
    "/tests/helpers/server-process.cjs",
    "/tests/integration/server-health.test.cjs",
    "/data",
    "/tests",
  ];

  for (const p of forbiddenPaths) {
    const res = await fetch(`${server.url}${p}`);
    assert.equal(
      res.status === 404 || res.status === 403,
      true,
      `Expected ${p} to be inaccessible (got status ${res.status})`
    );
  }
});

test("Security SEC-03: Legitimate public frontend assets ARE accessible", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  // mokepon.html
  const htmlRes = await fetch(`${server.url}/mokepon.html`);
  assert.equal(htmlRes.status, 200);
  const htmlText = await htmlRes.text();
  assert.ok(htmlText.includes("<title>Animal Combat</title>"));

  // css
  const cssRes = await fetch(`${server.url}/css/mokepon.css`);
  assert.equal(cssRes.status, 200);

  // js
  const jsRes = await fetch(`${server.url}/js/main.js`);
  assert.equal(jsRes.status, 200);

  // root redirects to /mokepon.html
  const rootRes = await fetch(`${server.url}/`, { redirect: "manual" });
  assert.equal(rootRes.status, 302);
  assert.equal(rootRes.headers.get("location"), "/mokepon.html");
});

test("Security SEC-12: Standard security headers are present", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const res = await fetch(`${server.url}/health`);
  assert.equal(res.status, 200);

  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.ok(res.headers.get("permissions-policy"));
});

test("Security SEC-08: WebSocket rejects payloads exceeding maxPayload limit", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const ws = new WebSocket(server.wsUrl);
  await new Promise((resolve) => ws.once("open", resolve));

  t.after(() => {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  });

  // Construct a frame exceeding the 64KB maxPayload limit (e.g. 70KB)
  const hugePayload = JSON.stringify({
    type: "create_room",
    payload: { blob: "X".repeat(70 * 1024) },
  });

  const closePromise = new Promise((resolve) => {
    ws.once("close", (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });

  ws.send(hugePayload);

  const closeEvent = await closePromise;
  // WS frame too large error code is 1009 (Message Too Big)
  assert.equal(closeEvent.code, 1009);

  // Server health remains uncompromised
  const health = await (await fetch(`${server.url}/health`)).json();
  assert.equal(health.ok, true);
});

test("Security SEC-01 & SEC-02 & SEC-05: Auth & API routes fail safely with strict input validation", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  // Protected route without Bearer token returns 401
  const unauthRes = await fetch(`${server.url}/api/profile`);
  assert.equal(unauthRes.status, 401);

  // Register with invalid/too-short username returns 400
  const badRegRes = await fetch(`${server.url}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "a", password: "validPassword123" }),
  });
  assert.equal(badRegRes.status, 400);

  // Login with non-existent user returns 401 without user enumeration leakage
  const badLoginRes = await fetch(`${server.url}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "non_existent_user", password: "somePassword" }),
  });
  assert.equal(badLoginRes.status, 401);

  // Google auth without credential returns 400
  const noCredGoogleRes = await fetch(`${server.url}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "victim@example.com" }),
  });
  assert.equal(noCredGoogleRes.status, 400);

  // Google auth with credential when GOOGLE_CLIENT_ID not configured fails closed (503)
  const unconfiguredGoogleRes = await fetch(`${server.url}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: "some.mock.token" }),
  });
  assert.equal(unconfiguredGoogleRes.status, 503);

  // Register valid user to obtain token for testing report_match
  const regRes = await fetch(`${server.url}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "security_tester", password: "ValidPassword#1" }),
  });
  assert.equal(regRes.status, 200);
  const regData = await regRes.json();
  const token = regData.token;

  // report_match rejects invalid result enum
  const badResultRes = await fetch(`${server.url}/api/report_match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ result: "invalid_result_hacked", difficulty: "normal" }),
  });
  assert.equal(badResultRes.status, 400);

  // report_match rejects invalid difficulty enum
  const badDiffRes = await fetch(`${server.url}/api/report_match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ result: "win", difficulty: "god_mode_unlimited" }),
  });
  assert.equal(badDiffRes.status, 400);

  // report_match succeeds with valid values
  const validReportRes = await fetch(`${server.url}/api/report_match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      result: "win",
      pet: "Neptuno",
      opponent: "Salamander",
      vsAI: true,
      difficulty: "normal",
    }),
  });
  assert.equal(validReportRes.status, 200);
  const validReportData = await validReportRes.json();
  assert.equal(validReportData.ok, true);
  assert.equal(validReportData.xpGain, 100);
});

test("Security SEC-06: Production CORS rejects untrusted origins", async (t) => {
  const server = await startTestServer({
    nodeEnv: "production",
    env: { ALLOWED_ORIGINS: "https://trusted-domain.com" },
  });
  t.after(() => stopTestServer(server));

  // Request from untrusted origin
  const untrustedRes = await fetch(`${server.url}/health`, {
    headers: { Origin: "https://evil-attacker.com" },
  });
  // CORS error causes 500 or omitted Access-Control-Allow-Origin
  assert.notEqual(
    untrustedRes.headers.get("access-control-allow-origin"),
    "https://evil-attacker.com"
  );

  // Request from trusted origin
  const trustedRes = await fetch(`${server.url}/health`, {
    headers: { Origin: "https://trusted-domain.com" },
  });
  assert.equal(
    trustedRes.headers.get("access-control-allow-origin"),
    "https://trusted-domain.com"
  );
});

test("Security SEC-07: Configurable TRUST_PROXY behavior (secure default vs explicit trust)", async (t) => {
  // 1. Default server (TRUST_PROXY unset): secure default does not trust spoofed X-Forwarded-For
  const defaultServer = await startTestServer();
  t.after(() => stopTestServer(defaultServer));

  // Exhaust auth limit on default server using a spoofed header
  // Because trust proxy is OFF by default, all requests from this client hit 127.0.0.1
  let blockedOnDefault = false;
  for (let i = 0; i < 16; i++) {
    const res = await fetch(`${defaultServer.url}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": `198.51.100.${i}`, // Spoofed unique IPs
      },
      body: JSON.stringify({ username: "nobody", password: "wrong" }),
    });
    if (res.status === 429) {
      blockedOnDefault = true;
      break;
    }
  }
  // Secure default blocked them because it keyed by actual socket IP (127.0.0.1), ignoring spoofed headers
  assert.equal(blockedOnDefault, true, "Default server should ignore spoofed X-Forwarded-For");

  // 2. Explicitly configured server with TRUST_PROXY="1"
  const proxyServer = await startTestServer({
    env: { TRUST_PROXY: "1" },
  });
  t.after(() => stopTestServer(proxyServer));

  // Two different upstream clients forwarded by reverse proxy
  const resClient1 = await fetch(`${proxyServer.url}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.1",
    },
    body: JSON.stringify({ username: "nobody", password: "wrong" }),
  });
  assert.equal(resClient1.status, 401); // Not 429

  const resClient2 = await fetch(`${proxyServer.url}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.2",
    },
    body: JSON.stringify({ username: "nobody", password: "wrong" }),
  });
  assert.equal(resClient2.status, 401); // Independent quota
});
