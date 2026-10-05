const { performance } = require("node:perf_hooks");
const {
  startTestServer,
  stopTestServer,
} = require("../tests/helpers/server-process.cjs");
const { connectWs } = require("../tests/helpers/websocket-client.cjs");

function calculatePercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

async function runPerfBaseline() {
  console.log("==================================================");
  console.log("ANIMAL COMBAT - M0.7 PERFORMANCE BASELINE");
  console.log("==================================================");

  const results = {};

  // 1. Measure Server Boot
  console.log("\n[1/5] Measuring Server Boot...");
  const bootStart = performance.now();
  const server = await startTestServer();
  const bootDuration = performance.now() - bootStart;
  results.bootDurationMs = Number(bootDuration.toFixed(2));
  console.log(`  -> Boot to /health ready: ${results.bootDurationMs} ms`);

  try {
    // 2. Measure HTTP /health Latency
    console.log("\n[2/5] Measuring HTTP /health latency (50 samples)...");
    const httpSamples = [];
    const HTTP_COUNT = 50;

    for (let i = 0; i < HTTP_COUNT; i++) {
      const start = performance.now();
      const res = await fetch(`${server.url}/health`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      await res.json();
      const dur = performance.now() - start;
      httpSamples.push(dur);
    }

    httpSamples.sort((a, b) => a - b);
    const httpMin = httpSamples[0];
    const httpMax = httpSamples[httpSamples.length - 1];
    const httpAvg = httpSamples.reduce((a, b) => a + b, 0) / httpSamples.length;
    const httpP50 = calculatePercentile(httpSamples, 50);
    const httpP95 = calculatePercentile(httpSamples, 95);

    results.http = {
      samples: HTTP_COUNT,
      minMs: Number(httpMin.toFixed(2)),
      avgMs: Number(httpAvg.toFixed(2)),
      p50Ms: Number(httpP50.toFixed(2)),
      p95Ms: Number(httpP95.toFixed(2)),
      maxMs: Number(httpMax.toFixed(2)),
    };

    console.log(`  -> min: ${results.http.minMs} ms`);
    console.log(`  -> avg: ${results.http.avgMs} ms`);
    console.log(`  -> p50: ${results.http.p50Ms} ms`);
    console.log(`  -> p95: ${results.http.p95Ms} ms`);
    console.log(`  -> max: ${results.http.maxMs} ms`);

    // 3. Measure WebSocket Connection & Handshake Latency
    console.log("\n[3/5] Measuring WebSocket Handshake latency (10 connections)...");
    const wsSamples = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      const client = await connectWs(server.wsUrl);
      const dur = performance.now() - start;
      wsSamples.push(dur);
      await client.close();
    }
    wsSamples.sort((a, b) => a - b);
    const wsAvg = wsSamples.reduce((a, b) => a + b, 0) / wsSamples.length;
    results.websocket = {
      samples: 10,
      minMs: Number(wsSamples[0].toFixed(2)),
      avgMs: Number(wsAvg.toFixed(2)),
      p50Ms: Number(calculatePercentile(wsSamples, 50).toFixed(2)),
      p95Ms: Number(calculatePercentile(wsSamples, 95).toFixed(2)),
      maxMs: Number(wsSamples[wsSamples.length - 1].toFixed(2)),
    };
    console.log(`  -> min: ${results.websocket.minMs} ms | avg: ${results.websocket.avgMs} ms | p95: ${results.websocket.p95Ms} ms`);

    // 4. Measure Multiplayer Flow Latency (Room Create & Join)
    console.log("\n[4/5] Measuring Multiplayer Room Lifecycle latency...");
    const host = await connectWs(server.wsUrl);
    const guest = await connectWs(server.wsUrl);

    const createStart = performance.now();
    host.send({ type: "create_room", payload: {} });
    const createdMsg = await host.waitForMessage("room_joined");
    const createDur = performance.now() - createStart;

    const joinStart = performance.now();
    guest.send({ type: "join_room", payload: { code: createdMsg.payload.code } });
    await guest.waitForMessage("room_joined");
    const joinDur = performance.now() - joinStart;

    await host.close();
    await guest.close();

    results.multiplayer = {
      roomCreateMs: Number(createDur.toFixed(2)),
      roomJoinMs: Number(joinDur.toFixed(2)),
    };
    console.log(`  -> Room Create: ${results.multiplayer.roomCreateMs} ms`);
    console.log(`  -> Room Join: ${results.multiplayer.roomJoinMs} ms`);

    // 5. Resource Cleanup & Stability Check
    console.log("\n[5/5] Measuring Stability & Connection Cleanup (20 burst connections)...");
    const burstClients = [];
    for (let i = 0; i < 20; i++) {
      burstClients.push(connectWs(server.wsUrl));
    }
    const connected = await Promise.all(burstClients);

    const healthDuringBurst = await (await fetch(`${server.url}/health`)).json();
    assertState(healthDuringBurst.players === 20, "Burst players count should be 20");

    for (const c of connected) {
      await c.close();
    }

    // Wait for clean release
    let cleanOk = false;
    const cleanupStart = Date.now();
    while (Date.now() - cleanupStart < 3000) {
      const h = await (await fetch(`${server.url}/health`)).json();
      if (h.players === 0 && h.rooms === 0) {
        cleanOk = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    assertState(cleanOk, "Server did not cleanly release all players/rooms after burst disconnect");
    console.log("  -> Clean release verified: players: 0, rooms: 0");

    console.log("\n==================================================");
    console.log("M0.7 BASELINE COMPLETE - ALL CHECKS PASSED");
    console.log("==================================================");

    return results;
  } finally {
    await stopTestServer(server);
  }
}

function assertState(condition, message) {
  if (!condition) {
    throw new Error(`Guardrail violation: ${message}`);
  }
}

if (require.main === module) {
  runPerfBaseline()
    .then((res) => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Performance Baseline Failed:", err);
      process.exit(1);
    });
}

module.exports = { runPerfBaseline };
