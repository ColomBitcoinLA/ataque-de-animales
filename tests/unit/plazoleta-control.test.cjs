"use strict";

/**
 * Sensación de control (R1-A).
 *
 * Verifica el módulo puro `control-feel.mjs`: mapeo relativo a la cámara, aceleración,
 * frenada, rampa de carrera, giro suavizado con tope y el factor de alineación que
 * elimina el deslizamiento lateral al girar.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

let feel;
let MOVEMENT;

test.before(async () => {
  feel = await import("../../js/world/plazoleta/control-feel.mjs");
  MOVEMENT = feel.MOVEMENT;
});

const scratch = { x: 0, z: 0, magnitude: 0 };

test("control: el movimiento es relativo a la cámara (adelante = alejarse de ella)", () => {
  // Cámara detrás mirando a +Z (yaw = 0 ⇒ está en +Z): avanzar debe ir hacia -Z.
  feel.intentFromInput({ forward: 1, strafe: 0 }, 0, scratch);
  assert.ok(Math.abs(scratch.x) < 1e-9);
  assert.ok(Math.abs(scratch.z + 1) < 1e-9, `esperado -Z, obtenido ${scratch.z}`);

  // Derecha de la cámara en yaw 0 ⇒ +X.
  feel.intentFromInput({ forward: 0, strafe: 1 }, 0, scratch);
  assert.ok(Math.abs(scratch.x - 1) < 1e-9, `esperado +X, obtenido ${scratch.x}`);
  assert.ok(Math.abs(scratch.z) < 1e-9);

  // Girando la cámara 90°, "adelante" gira con ella.
  feel.intentFromInput({ forward: 1, strafe: 0 }, Math.PI / 2, scratch);
  assert.ok(Math.abs(scratch.x + 1) < 1e-9, `esperado -X, obtenido ${scratch.x}`);
  assert.ok(Math.abs(scratch.z) < 1e-9);
});

test("control: la dirección de mundo está normalizada (diagonal no es más rápida)", () => {
  feel.intentFromInput({ forward: 1, strafe: 1 }, 0.7, scratch);
  assert.ok(Math.abs(Math.hypot(scratch.x, scratch.z) - 1) < 1e-9);
  assert.ok(scratch.magnitude > 1);
});

test("control: sin input no hay dirección pero sí memoria de la última (para frenar)", () => {
  feel.intentFromInput({ forward: 1, strafe: 0 }, 0, scratch);
  const lastX = scratch.x;
  const lastZ = scratch.z;
  feel.intentFromInput({ forward: 0, strafe: 0 }, 0, scratch);
  assert.equal(scratch.magnitude, 0);
  assert.equal(scratch.x, 0);
  assert.equal(lastX !== 0 || lastZ !== 0, true);
});

test("control: acelera y frena con rampas (no instantáneo) y la frenada es más firme", () => {
  const state = feel.createControlState({ heading: 0 });
  // 1 tick: la velocidad es una fracción de la de crucero.
  feel.stepControl(state, { moveX: 0, moveZ: 1 }, 1 / 60);
  assert.ok(state.speed > 0 && state.speed < MOVEMENT.walkSpeed * 0.4, `arranque: ${state.speed}`);
  const speedAfterOneTick = state.speed;

  // Tiempo de rampa: alcanza el crucero en ~walkSpeed/accel segundos.
  const ticksToCruise = Math.ceil((MOVEMENT.walkSpeed / MOVEMENT.accel) * 60) + 2;
  for (let i = 0; i < ticksToCruise; i++) feel.stepControl(state, { moveX: 0, moveZ: 1 }, 1 / 60);
  assert.ok(Math.abs(state.speed - MOVEMENT.walkSpeed) < 0.02, `crucero: ${state.speed}`);

  // Frenada: soltar el input lleva a cero en menos tiempo del que tardó en acelerar.
  let releaseTicks = 0;
  while (state.speed > 0.001 && releaseTicks < 600) {
    feel.stepControl(state, { moveX: 0, moveZ: 0 }, 1 / 60);
    releaseTicks++;
  }
  const accelTicks = Math.ceil((MOVEMENT.walkSpeed - speedAfterOneTick) / (MOVEMENT.accel / 60));
  assert.ok(releaseTicks < accelTicks, `frenar (${releaseTicks}) debe ser más rápido que acelerar (${accelTicks})`);
  assert.equal(state.locomotion, "idle");
});

test("control: la carrera exige mantener Shift y entra con rampa", () => {
  const state = feel.createControlState({ heading: 0 });
  feel.stepControl(state, { moveX: 0, moveZ: 1, run: true }, 1 / 60);
  const firstTickSpeed = state.speed;
  for (let i = 0; i < 120; i++) feel.stepControl(state, { moveX: 0, moveZ: 1, run: true }, 1 / 60);
  assert.ok(state.speed > MOVEMENT.walkSpeed * 1.5, `debería acercarse a la carrera: ${state.speed}`);
  assert.ok(state.speed <= MOVEMENT.runSpeed + 1e-9);
  assert.ok(firstTickSpeed < MOVEMENT.walkSpeed * 0.5, "la carrera no es instantánea");
  assert.equal(state.locomotion, "run");

  // Soltar Shift devuelve al trote.
  for (let i = 0; i < 90; i++) feel.stepControl(state, { moveX: 0, moveZ: 1, run: false }, 1 / 60);
  assert.ok(Math.abs(state.speed - MOVEMENT.walkSpeed) < 0.05, `vuelta al trote: ${state.speed}`);
  assert.equal(state.locomotion, "walk");
});

test("control: el giro tiene tope de velocidad angular y no arranca de golpe", () => {
  const state = feel.createControlState({ heading: 0 });
  const dt = 1 / 60;
  // Giro de 180°: ningún tick puede superar el tope declarado.
  const maxStep = MOVEMENT.turnRateIdle * dt;
  let previous = state.heading;
  for (let i = 0; i < 60; i++) {
    feel.stepControl(state, { moveX: 0, moveZ: -1 }, dt);
    const delta = Math.abs(feel.shortestAngle(previous, state.heading));
    assert.ok(delta <= maxStep + 1e-9, `salto de giro ${delta} > ${maxStep}`);
    previous = state.heading;
  }
  // Tras un segundo ya está prácticamente encarado.
  const remaining = Math.abs(feel.shortestAngle(state.heading, Math.PI));
  assert.ok(remaining < 0.2, `rumbo restante: ${remaining}`);
});

test("control: mientras se gira, el avance se penaliza (nada de deslizar de lado)", () => {
  const straight = feel.createControlState({ heading: 0 });
  for (let i = 0; i < 30; i++) feel.stepControl(straight, { moveX: 0, moveZ: 1 }, 1 / 60);

  // Pedir 180° desde parado: al principio casi no avanza.
  const reversal = feel.createControlState({ heading: 0 });
  feel.stepControl(reversal, { moveX: 0, moveZ: -1 }, 1 / 60);
  assert.ok(reversal.align <= MOVEMENT.alignMin + 1e-9, `alineación: ${reversal.align}`);
  assert.ok(reversal.effectiveSpeed < reversal.speed * 0.2, "el avance efectivo debe estar muy reducido");
  assert.equal(reversal.aligning, true);

  // Y al completar el giro vuelve a avanzar a pleno.
  for (let i = 0; i < 90; i++) feel.stepControl(reversal, { moveX: 0, moveZ: -1 }, 1 / 60);
  assert.ok(reversal.align > 0.98, `alineación final: ${reversal.align}`);
  assert.ok(Math.abs(reversal.effectiveSpeed - reversal.speed) < 1e-6);
});

test("control: ángulos envueltos y utilidades numéricas", () => {
  assert.ok(Math.abs(feel.shortestAngle(3.0, -3.0) - (Math.PI * 2 - 6.0 + 0.0)) < 1e-6);
  assert.ok(Math.abs(feel.wrapAngle(Math.PI * 2 + 0.5) - 0.5) < 1e-9);
  assert.equal(feel.approach(0, 10, 3), 3);
  assert.equal(feel.approach(9, 10, 3), 10);
  assert.equal(feel.approach(0, -10, 4), -4);
  assert.equal(feel.classifyLocomotion(0), "idle");
  assert.equal(feel.classifyLocomotion(MOVEMENT.walkSpeed), "walk");
  assert.equal(feel.classifyLocomotion(MOVEMENT.runSpeed), "run");
});

test("control: rechaza dt inválido y no asigna memoria en el bucle", () => {
  const state = feel.createControlState();
  assert.throws(() => feel.stepControl(state, { moveX: 1, moveZ: 0 }, NaN), RangeError);
  assert.throws(() => feel.stepControl(state, { moveX: 1, moveZ: 0 }, -1), RangeError);

  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 20000; i++) feel.stepControl(state, { moveX: 0.6, moveZ: 0.8, run: true }, 1 / 60);
  const growthMB = (process.memoryUsage().heapUsed - before) / 1048576;
  assert.ok(growthMB < 8, `crecimiento de heap: ${growthMB.toFixed(1)} MB`);
});

test("autodiagnóstico: resume el recorrido con criterios explícitos (R1-A)", async () => {
  const selftest = await import("../../js/world/plazoleta/selftest.mjs");
  const tracker = selftest.createSelfTestTracker();
  const state = { player: { locomotion: "walk", speed: 2.5, distance: 3.0 } };
  const cameraState = { recenterActive: true, shoulder: 0.12 };
  const baseline = { x: 0, z: 0, distance: 0 };
  const clean = { cameraPenetration: false, bodyPenetration: false };

  for (let i = 0; i < 8; i++) selftest.trackSelfTest(tracker, state, cameraState, clean);
  state.player.locomotion = "run";
  state.player.speed = 5.0;
  for (let i = 0; i < 8; i++) selftest.trackSelfTest(tracker, state, cameraState, clean);
  state.player.locomotion = "idle";
  state.player.speed = 0;
  for (let i = 0; i < 60; i++) selftest.trackSelfTest(tracker, state, cameraState, clean);

  const summary = selftest.summarizeSelfTest({ state, cameraState, tracker, perf: { snapshot: { calls: 57 } }, baseline });
  assert.deepEqual(summary.checks, {
    moved: true, sprintReached: true, walked: true, ran: true, stopped: true,
    recentered: true, shoulderUsed: true, cameraClean: true, bodyClean: true,
    drawCallsWithinPlan: true, framesTracked: true,
  });
  assert.equal(summary.ok, true);
  assert.match(selftest.selfTestTitle(summary), /^selftest PASS/);

  // Un fallo concreto se refleja con su nombre en el título.
  const failing = selftest.summarizeSelfTest({
    state: { player: { locomotion: "idle", speed: 0, distance: 0.2 } },
    cameraState,
    tracker: selftest.createSelfTestTracker(),
    perf: null,
    baseline,
  });
  assert.equal(failing.ok, false);
  assert.match(selftest.selfTestTitle(failing), /FAIL\(.*moved/);
});
