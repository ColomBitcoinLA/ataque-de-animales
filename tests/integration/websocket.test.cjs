const test = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");

const {
  startTestServer,
  stopTestServer,
} = require("../helpers/server-process.cjs");

function waitForMessage(ws) {
  return new Promise((resolve, reject) => {
    ws.once("message", (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    });

    ws.once("error", reject);
  });
}

test("WebSocket accepts a connection and sends welcome", async (t) => {
  const server = await startTestServer();

  t.after(async () => {
    await stopTestServer(server.child);
  });

  const ws = new WebSocket(server.wsUrl);

  t.after(() => {
    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    ) {
      ws.close();
    }
  });

  const message = await waitForMessage(ws);

  assert.equal(message.type, "welcome");
  assert.equal(typeof message.payload.id, "string");
  assert.ok(message.payload.id.length > 0);
  assert.equal(message.payload.authenticated, false);

  ws.close();
});
