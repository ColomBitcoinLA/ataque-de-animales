const test = require("node:test");
const assert = require("node:assert/strict");

const {
  startTestServer,
  stopTestServer,
} = require("../helpers/server-process.cjs");

test("server boots and exposes a healthy HTTP endpoint", async (t) => {
  const server = await startTestServer();

  t.after(async () => {
    await stopTestServer(server.child);
  });

  const response = await fetch(`${server.url}/health`);

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.ok, true);
  assert.equal(body.players, 0);
  assert.equal(body.rooms, 0);
});
