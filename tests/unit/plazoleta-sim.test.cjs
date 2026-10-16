"use strict";

/**
 * Simulación del mundo (M2 / Cali Viva POC).
 * Prueba determinismo, locomoción, colisión por bandas, tránsito del puente,
 * cadena de misión, comportamiento de fauna/NPC y separación simulación/render.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

let sim;
let simModule;
let map;
let behaviors;

test.before(async () => {
  simModule = await import("../../js/world/plazoleta/world-sim.mjs");
  sim = simModule.SIM;
  map = (await import("../../js/world/plazoleta/map-v1.mjs")).PLAZOLETA_MAP;
  behaviors = await import("../../js/world/plazoleta/behaviors.mjs");
});

function makeState(seed = 1234) {
  return simModule.createWorldState(map, { seed });
}

function runTicks(state, input, ticks) {
  for (let i = 0; i < ticks; i++) simModule.stepWorld(state, input, 1 / sim.hz);
  return state;
}

const FORWARD_X = { moveX: 1, moveZ: 0, run: false };
const RUN_X = { moveX: 1, moveZ: 0, run: true };

test("sim: determinismo — mismo seed e inputs producen el mismo estado", () => {
  const a = runTicks(makeState(777), { moveX: 0.6, moveZ: 0.8, run: true }, 900);
  const b = runTicks(makeState(777), { moveX: 0.6, moveZ: 0.8, run: true }, 900);
  assert.equal(a.player.x, b.player.x);
  assert.equal(a.player.z, b.player.z);
  assert.equal(a.player.phase, b.player.phase);
  assert.equal(a.rng, b.rng);
  assert.deepEqual(
    a.critters.map((c) => [c.x, c.z, c.state]),
    b.critters.map((c) => [c.x, c.z, c.state])
  );
});

test("sim: caminar y correr respetan la velocidad declarada (sin patinaje)", () => {
  const walker = makeState();
  walker.player.x = -1.6;
  walker.player.z = 5.6;
  runTicks(walker, FORWARD_X, 60); // 1 s
  const walkedDistance = walker.player.distance;
  assert.ok(Math.abs(walkedDistance - sim.walkSpeed) < 0.12, `caminar: ${walkedDistance}`);

  const runner = makeState();
  runner.player.x = -1.6;
  runner.player.z = 5.6;
  runTicks(runner, RUN_X, 60);
  assert.ok(Math.abs(runner.player.distance - sim.runSpeed) < 0.2, `correr: ${runner.player.distance}`);
  assert.equal(runner.player.locomotion, "run");

  // La fase de locomoción avanza por DISTANCIA: el paso de carrera es más largo,
  // así que por metro recorrido acumula MENOS fase (base del ciclo de animación).
  const walkSample = (() => {
    const s = makeState();
    s.player.x = -1.6; s.player.z = 5.6;
    runTicks(s, FORWARD_X, 30);
    return { phase: s.player.phase, distance: s.player.distance };
  })();
  const runSample = (() => {
    const s = makeState();
    s.player.x = -1.6; s.player.z = 5.6;
    runTicks(s, RUN_X, 30);
    return { phase: s.player.phase, distance: s.player.distance };
  })();
  assert.ok(
    runSample.phase / runSample.distance < walkSample.phase / walkSample.distance,
    "correr con paso más largo debe acumular menos fase por metro"
  );
});

test("sim: colisión con la casona (bloqueo por eje, sin atravesar)", () => {
  const state = makeState();
  state.player.x = 2.0;
  state.player.z = 0.0;
  runTicks(state, FORWARD_X, 180);
  assert.ok(state.player.x < 4.6, `el jugador atravesó la casona: x=${state.player.x}`);
  assert.ok(state.player.x > 4.1, `debería detenerse junto al muro: x=${state.player.x}`);
  assert.equal(state.player.blockedX, true);
  assert.ok(state.stats.blockedTicks > 0);
});

test("sim: la ribera y el agua bloquean el paso a pie", () => {
  const state = makeState();
  state.player.x = -3.0;
  state.player.z = -6.0;
  runTicks(state, { moveX: -1, moveZ: 0, run: false }, 240);
  assert.ok(state.player.x > -5.75, `atravesó el parapeto: x=${state.player.x}`);
  assert.equal(state.player.blockedX, true);
});

test("sim: el jugador sube la rampa y queda sobre el tablero del puente", () => {
  const state = makeState();
  state.player.x = -0.7;
  state.player.z = 0.0;
  runTicks(state, { moveX: -1, moveZ: 0, run: false }, 330);
  assert.ok(state.player.x < -3.5, `no llegó al tablero: x=${state.player.x}`);
  assert.ok(Math.abs(state.player.feetY - map.bridgeDeckY) < 0.02, `altura: ${state.player.feetY}`);
  assert.equal(state.player.zone, "puente");
  // Los pretiles impiden salirse del tablero.
  runTicks(state, { moveX: 0, moveZ: 1, run: false }, 120);
  assert.ok(state.player.z < 2.3, `atravesó el pretil: z=${state.player.z}`);
});

test("sim: el jugador nunca termina dentro de un sólido (invariante)", () => {
  const inputs = [
    { moveX: 1, moveZ: 0, run: false }, { moveX: -1, moveZ: 0, run: true },
    { moveX: 0, moveZ: 1, run: false }, { moveX: 0, moveZ: -1, run: true },
    { moveX: 0.7, moveZ: -0.7, run: false }, { moveX: -0.3, moveZ: 0.95, run: true },
  ];
  const state = makeState();
  for (let i = 0; i < 12; i++) {
    for (const input of inputs) {
      runTicks(state, input, 90);
      assert.equal(simModule.playerBlocked(state), false, `bloqueado en (${state.player.x}, ${state.player.z}, y=${state.player.feetY})`);
    }
  }
});

test("sim: interacción real — Lucía, luego la cadena completa de la misión", () => {
  const state = makeState();
  state.player.x = 4.0;
  state.player.z = 4.9;
  simModule.stepWorld(state, { moveX: 0, moveZ: 0 }, 1 / sim.hz);
  assert.equal(state.interaction.targetId, "lucia");
  assert.equal(state.interaction.verb, "Hablar");

  const first = simModule.activate(state, behaviors.dialogs);
  assert.equal(first.type, "quest-step");
  assert.equal(first.stepId, "hablar-lucia");
  assert.equal(state.quest.stepIndex, 1);
  assert.equal(state.quest.trust.lucia, 1);
  assert.ok(first.dialog.title.length > 3);

  const chain = [
    ["samar", 1.1, -3.4, 0],
    ["placa", -5.6, 5.2, 0],
    ["mirador", -7.4, 0, map.bridgeDeckY],
    ["lucia", 4.0, 4.9, 0],
  ];
  for (const [id, x, z, feetY] of chain) {
    state.player.x = x;
    state.player.z = z;
    state.player.feetY = feetY;
    simModule.stepWorld(state, { moveX: 0, moveZ: 0 }, 1 / sim.hz);
    assert.equal(state.interaction.targetId, id, `esperaba ${id}`);
    const action = simModule.activate(state, behaviors.dialogs);
    assert.ok(action, `la interacción con ${id} no devolvió acción`);
  }

  assert.equal(state.quest.completed, true);
  assert.equal(state.quest.rewardGranted, true);
  assert.equal(state.quest.stepIndex, map.quest.steps.length);

  // La recompensa se declara SIEMPRE como simulación local (prioridad 12).
  const rewardText = map.quest.rewardLabel;
  assert.match(rewardText, /simulación local/i);
  assert.match(rewardText, /no acredita progreso real/i);

  // No se puede volver a cobrar: tras completar sólo hay contenido de sabor.
  const again = simModule.activate(state, behaviors.dialogs);
  assert.equal(again.reward, null);
  assert.equal(again.xpAwarded, 0);
});

test("sim: la fauna reacciona (las palomas huyen del jugador)", () => {
  const state = makeState();
  const bird = state.critters[0];
  state.player.x = bird.x + 1.2;
  state.player.z = bird.z;
  const initialDistance = Math.hypot(bird.x - state.player.x, bird.z - state.player.z);
  runTicks(state, { moveX: 0, moveZ: 0 }, 30);
  assert.equal(bird.state, "flee");
  const laterDistance = Math.hypot(bird.x - state.player.x, bird.z - state.player.z);
  assert.ok(laterDistance > initialDistance, "la paloma debería alejarse");
  // Y vuelve a su territorio cuando se calma.
  state.player.x = -8;
  state.player.z = -8;
  runTicks(state, { moveX: 0, moveZ: 0 }, 400);
  assert.ok(["return", "peck"].includes(bird.state));
  assert.ok(Math.hypot(bird.x - bird.homeX, bird.z - bird.homeZ) < 3.2, "debe volver cerca de casa");
});

test("sim: Lucía se gira hacia el jugador cuando entra en su radio de atención", () => {
  const state = makeState();
  const lucia = state.npcs[0];
  state.player.x = lucia.x;
  state.player.z = lucia.z + 2.0;
  runTicks(state, { moveX: 0, moveZ: 0 }, 90);
  assert.equal(lucia.facingPlayer, true);
  assert.ok(lucia.alert > 0.6, `alerta: ${lucia.alert}`);
  // Mirando al jugador: el rumbo apunta hacia él (atan2(dx, dz) ≈ 0).
  assert.ok(Math.abs(lucia.heading) < 0.25, `rumbo de Lucía: ${lucia.heading}`);
});

test("sim: cero asignaciones en régimen estable (identidad de buffers y heap estable)", () => {
  const state = makeState();
  // Zona alejada de NPC y fauna: caminar no debe emitir ningún evento.
  state.player.x = -8.5;
  state.player.z = -8.5;
  const moveBuffer = state.scratch.move;
  const dirBuffer = state.scratch.dir;
  runTicks(state, FORWARD_X, 600);
  assert.equal(state.scratch.move, moveBuffer, "el buffer de movimiento debe reutilizarse");
  assert.equal(state.scratch.dir, dirBuffer, "el buffer de dirección debe reutilizarse");
  assert.equal(state.events.length, 0, "moverse no debe generar eventos");

  const before = process.memoryUsage().heapUsed;
  runTicks(state, { moveX: 0.7, moveZ: 0.7, run: true }, 20000);
  const after = process.memoryUsage().heapUsed;
  const growthMB = (after - before) / 1048576;
  assert.ok(growthMB < 12, `crecimiento de heap sospechoso: ${growthMB.toFixed(1)} MB en 20k ticks`);
});

test("sim: rechaza dt inválido sin coercionar", () => {
  const state = makeState();
  assert.throws(() => simModule.stepWorld(state, {}, NaN), RangeError);
  assert.throws(() => simModule.stepWorld(state, {}, -0.1), RangeError);
});

test("arquitectura: simulación, mapa, comportamiento y cámara no conocen render, DOM ni red", () => {
  const files = [
    "js/world/plazoleta/world-sim.mjs",
    "js/world/plazoleta/map-v1.mjs",
    "js/world/plazoleta/behaviors.mjs",
    "js/world/plazoleta/camera-solver.mjs",
  ];
  const forbidden = ["three", "document", "window", "WebSocket", "fetch(", "localStorage", "requestAnimationFrame"];
  for (const relative of files) {
    const source = fs.readFileSync(path.resolve(__dirname, "../..", relative), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");
    for (const token of forbidden) {
      assert.ok(!source.includes(token), `${relative} contiene '${token}' (debe ser puro)`);
    }
  }
});
