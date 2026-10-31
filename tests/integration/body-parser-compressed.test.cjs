"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const zlib = require("node:zlib");

const { startTestServer, stopTestServer } = require("../helpers/server-process.cjs");

const ROOT = path.resolve(__dirname, "../..");

function postGzip(url, payload) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
          "Content-Length": payload.length,
        },
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () => resolve({ status: response.statusCode, body }));
      }
    );
    request.on("error", reject);
    request.end(payload);
  });
}

test("body-parser is pinned at or above the patched 2.4.0", () => {
  const expressDir = path.dirname(require.resolve("express", { paths: [ROOT] }));
  const bodyParserEntry = require.resolve("body-parser", { paths: [expressDir] });
  const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(bodyParserEntry), "package.json"), "utf8"));
  const [major, minor] = manifest.version.split(".").map(Number);
  assert.ok(major > 2 || (major === 2 && minor >= 4), `body-parser ${manifest.version} is below 2.4.0`);
});

test("compressed JSON bodies are parsed and trailing bytes do not crash the server", async (t) => {
  const server = await startTestServer();
  t.after(async () => { await stopTestServer(server.child); });

  const validBody = zlib.gzipSync(Buffer.from(JSON.stringify({ username: "af_compressed_probe", password: "wrong" })));
  const valid = await postGzip(`${server.url}/api/login`, validBody);
  assert.equal(valid.status, 401, `valid gzip should reach the route, got ${valid.status}: ${valid.body.slice(0, 200)}`);

  const withTrailing = Buffer.concat([validBody, Buffer.from("TRAILING-BYTES")]);
  const startedAt = Date.now();
  const malformed = await postGzip(`${server.url}/api/login`, withTrailing);
  const elapsed = Date.now() - startedAt;

  assert.ok([400, 401, 413].includes(malformed.status), `unexpected status ${malformed.status}`);
  assert.ok(elapsed < 3000, `malformed compressed body took ${elapsed}ms`);

  const health = await fetch(`${server.url}/health`);
  assert.equal(health.status, 200);
  const body = await health.json();
  assert.equal(body.ok, true);
});
