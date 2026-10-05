const test = require("node:test");
const assert = require("node:assert/strict");

const {
  startTestServer,
  stopTestServer,
} = require("../helpers/server-process.cjs");
const { connectWs } = require("../helpers/websocket-client.cjs");

test("Multiplayer Contract: B - Create Room", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const client = await connectWs(server.wsUrl);
  t.after(() => client.close());

  client.send({ type: "create_room", payload: {} });

  const msg = await client.waitForMessage("room_joined");
  assert.equal(typeof msg.payload.code, "string");
  assert.match(msg.payload.code, /^[A-Z0-9]{4}$/);
  assert.equal(msg.payload.players, 1);
  assert.equal(msg.payload.host, true);
});

test("Multiplayer Contract: C - Join Room with Two Players", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const host = await connectWs(server.wsUrl);
  const guest = await connectWs(server.wsUrl);
  t.after(async () => {
    await host.close();
    await guest.close();
  });

  host.send({ type: "create_room", payload: {} });
  const hostCreated = await host.waitForMessage("room_joined");
  const roomCode = hostCreated.payload.code;

  guest.send({ type: "join_room", payload: { code: roomCode } });

  const guestJoined = await guest.waitForMessage("room_joined");
  assert.equal(guestJoined.payload.code, roomCode);
  assert.equal(guestJoined.payload.players, 2);
  assert.equal(guestJoined.payload.host, false);

  const hostNotified = await host.waitForMessage("room_joined");
  assert.equal(hostNotified.payload.code, roomCode);
  assert.equal(hostNotified.payload.players, 2);
  assert.equal(hostNotified.payload.host, true);
});

test("Multiplayer Contract: D - Room Full and Invalid Code Rejection", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const p1 = await connectWs(server.wsUrl);
  const p2 = await connectWs(server.wsUrl);
  const p3 = await connectWs(server.wsUrl);
  t.after(async () => {
    await p1.close();
    await p2.close();
    await p3.close();
  });

  // Create room and fill it with 2 players
  p1.send({ type: "create_room", payload: {} });
  const created = await p1.waitForMessage("room_joined");
  const roomCode = created.payload.code;

  p2.send({ type: "join_room", payload: { code: roomCode } });
  await p2.waitForMessage("room_joined");

  // Third player tries to join full room
  p3.send({ type: "join_room", payload: { code: roomCode } });
  const fullError = await p3.waitForMessage("error");
  assert.equal(fullError.payload.message, "Sala llena");

  // Non-existent room code
  p3.send({ type: "join_room", payload: { code: "ZZZZ" } });
  const notFoundError = await p3.waitForMessage("error");
  assert.equal(notFoundError.payload.message, "Sala no encontrada");

  // Malformed room code format
  p3.send({ type: "join_room", payload: { code: "INVALID#CODE!" } });
  const invalidCodeError = await p3.waitForMessage("error");
  assert.equal(invalidCodeError.payload.message, "Código de sala inválido");
});

async function pollHealth(url, predicate, timeoutMs = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await (await fetch(`${url}/health`)).json();
      if (predicate(res)) return res;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  return await (await fetch(`${url}/health`)).json();
}

test("Multiplayer Contract: E - Disconnect Cleanup", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const p1 = await connectWs(server.wsUrl);
  const p2 = await connectWs(server.wsUrl);

  p1.send({ type: "create_room", payload: {} });
  const created = await p1.waitForMessage("room_joined");
  p2.send({ type: "join_room", payload: { code: created.payload.code } });
  await p2.waitForMessage("room_joined");

  // Health before disconnect
  const healthBefore = await (await fetch(`${server.url}/health`)).json();
  assert.equal(healthBefore.players, 2);
  assert.equal(healthBefore.rooms, 1);

  // Disconnect p2
  await p2.close();
  const healthAfter = await pollHealth(server.url, (h) => h.players === 1);
  assert.equal(healthAfter.players, 1);

  // Clean up p1
  await p1.close();
  const healthFinal = await pollHealth(server.url, (h) => h.players === 0 && h.rooms === 0);
  assert.equal(healthFinal.players, 0);
  assert.equal(healthFinal.rooms, 0);
});

test("Multiplayer Contract: F - Invalid JSON Handling", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const client = await connectWs(server.wsUrl);
  t.after(() => client.close());

  client.sendRaw("{not-valid-json");
  const errMsg = await client.waitForMessage("error");
  assert.equal(errMsg.payload.message, "JSON inválido");

  // Server must continue operating normally
  const health = await (await fetch(`${server.url}/health`)).json();
  assert.equal(health.ok, true);
});

test("Multiplayer Contract: G - Unknown Message Type", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const client = await connectWs(server.wsUrl);
  t.after(() => client.close());

  // Send unrecognized type
  client.send({ type: "unknown_custom_test_action", payload: { test: true } });

  // Now send a valid command to verify server is intact
  client.send({ type: "create_room", payload: {} });
  const joined = await client.waitForMessage("room_joined");
  assert.equal(joined.payload.players, 1);

  const health = await (await fetch(`${server.url}/health`)).json();
  assert.equal(health.ok, true);
});

test("Multiplayer Contract: H - Invalid Payload Formats", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const client = await connectWs(server.wsUrl);
  t.after(() => client.close());

  // Non-object payload
  client.send({ type: "create_room", payload: null });
  const joined = await client.waitForMessage("room_joined");
  assert.equal(joined.payload.players, 1);

  // Invalid payload structure on join
  client.send({ type: "join", payload: { animal: 12345, level: "invalid" } });
  const err = await client.waitForMessage("error");
  assert.equal(err.payload.message, "Nombre inválido");

  // Move with invalid coordinates (NaN / string)
  client.send({ type: "move", payload: { x: "abc", y: null } });
  const coordErr = await client.waitForMessage("error");
  assert.equal(coordErr.payload.message, "Coords inválidas");

  const health = await (await fetch(`${server.url}/health`)).json();
  assert.equal(health.ok, true);
});

test("Multiplayer Contract: I - Authoritative Combat Flow", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const p1 = await connectWs(server.wsUrl);
  const p2 = await connectWs(server.wsUrl);
  t.after(async () => {
    await p1.close();
    await p2.close();
  });

  // Setup room
  p1.send({ type: "create_room", payload: {} });
  const created = await p1.waitForMessage("room_joined");
  p2.send({ type: "join_room", payload: { code: created.payload.code } });
  await p2.waitForMessage("room_joined");
  await p1.waitForMessage("room_joined");

  // Ready states
  p1.send({ type: "player_ready", payload: { animal: "Neptuno" } });
  p2.send({ type: "player_ready", payload: { animal: "Salamander" } });

  // Both should receive match_start
  const [matchStartP1, matchStartP2] = await Promise.all([
    p1.waitForMessage("match_start"),
    p2.waitForMessage("match_start"),
  ]);

  assert.equal(matchStartP1.payload.roomId, created.payload.code);
  assert.equal(matchStartP2.payload.roomId, created.payload.code);

  // Both receive turn_start (Round 1)
  const [turn1P1, turn1P2] = await Promise.all([
    p1.waitForMessage("turn_start"),
    p2.waitForMessage("turn_start"),
  ]);

  assert.equal(turn1P1.payload.round, 1);
  assert.equal(turn1P2.payload.round, 1);
  assert.equal(turn1P1.payload.hp, 100);
  assert.equal(turn1P2.payload.hp, 100);

  // Both submit attacks immediately without waiting for timeout
  p1.send({ type: "submit_attack", payload: { attack: "AGUA", charged: false, move: "basic" } });
  p2.send({ type: "submit_attack", payload: { attack: "FUEGO", charged: false, move: "basic" } });

  const [confirmP1, confirmP2] = await Promise.all([
    p1.waitForMessage("attack_confirmed"),
    p2.waitForMessage("attack_confirmed"),
  ]);

  assert.equal(confirmP1.payload.attack, "AGUA");
  assert.equal(confirmP2.payload.attack, "FUEGO");

  // Server resolves round authoritatively
  const [roundP1, roundP2] = await Promise.all([
    p1.waitForMessage("round_resolved"),
    p2.waitForMessage("round_resolved"),
  ]);

  assert.equal(roundP1.payload.round, 1);
  assert.equal(roundP2.payload.round, 1);
  assert.equal(typeof roundP1.payload.myDamage, "number");
  assert.equal(typeof roundP2.payload.myDamage, "number");
  assert.ok(roundP1.payload.myHp <= 100);
  assert.ok(roundP2.payload.myHp <= 100);
});

test("Multiplayer Contract: J - Duplicate Action Safety", async (t) => {
  const server = await startTestServer();
  t.after(() => stopTestServer(server));

  const p1 = await connectWs(server.wsUrl);
  const p2 = await connectWs(server.wsUrl);
  t.after(async () => {
    await p1.close();
    await p2.close();
  });

  p1.send({ type: "create_room", payload: {} });
  const created = await p1.waitForMessage("room_joined");
  p2.send({ type: "join_room", payload: { code: created.payload.code } });
  await p2.waitForMessage("room_joined");

  p1.send({ type: "player_ready", payload: { animal: "Neptuno" } });
  p2.send({ type: "player_ready", payload: { animal: "Salamander" } });

  await Promise.all([p1.waitForMessage("match_start"), p2.waitForMessage("match_start")]);
  await Promise.all([p1.waitForMessage("turn_start"), p2.waitForMessage("turn_start")]);

  // Player 1 sends attack twice in the same turn
  p1.send({ type: "submit_attack", payload: { attack: "AGUA", charged: false, move: "basic" } });
  p1.send({ type: "submit_attack", payload: { attack: "AGUA", charged: false, move: "basic" } });

  // Only one attack_confirmed should be issued for p1
  const confirmP1 = await p1.waitForMessage("attack_confirmed");
  assert.equal(confirmP1.payload.attack, "AGUA");

  // Player 2 submits attack
  p2.send({ type: "submit_attack", payload: { attack: "FUEGO", charged: false, move: "basic" } });

  const [roundP1, roundP2] = await Promise.all([
    p1.waitForMessage("round_resolved"),
    p2.waitForMessage("round_resolved"),
  ]);

  assert.equal(roundP1.payload.round, 1);
  assert.equal(roundP2.payload.round, 1);
});
