"use strict";

/**
 * Cámara en tercera persona (M2 / Cali Viva POC).
 * El solucionador es puro: se prueba sin navegador y sin GPU.
 * Garantías verificadas: brazo que se acorta ante oclusión, histéresis al alargar,
 * no penetración de sólidos de cámara, límites de pitch/zoom y suavizado
 * independiente del frame rate.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

let camera;
let mapModule;
let map;
let solids;

test.before(async () => {
  camera = await import("../../js/world/plazoleta/camera-solver.mjs");
  mapModule = await import("../../js/world/plazoleta/map-v1.mjs");
  map = mapModule.PLAZOLETA_MAP;
  solids = mapModule.cameraSolids(map);
});
const outPosition = { x: 0, y: 0, z: 0 };
const outTarget = { x: 0, y: 0, z: 0 };

function solve(state, subject, dt = 1 / 60, speed = 2.5, subjectHeading = null, focusTarget = null) {
  camera.solveCamera(state, {
    subject,
    subjectSpeed: speed,
    subjectHeading,
    cameraSolids: solids,
    dt,
    outPosition,
    outTarget,
    focusTarget,
  });
  return state;
}

test("cámara: el brazo se acorta cuando hay un sólido entre la mascota y la cámara", () => {
  const open = camera.createCameraState({ yaw: 0, pitch: 0.2, distance: 6.4 });
  solve(open, { x: 0, y: 0, z: 0 });
  assert.ok(Math.abs(open.boom - 6.4) < 0.05, `brazo libre: ${open.boom}`);

  // Mascota pegada al muro oeste de la casona: la cámara debe acortarse.
  const wall = camera.createCameraState({ yaw: Math.PI / 2, pitch: 0.18, distance: 6.4 });
  solve(wall, { x: 4.1, y: 0, z: -2.4 });
  assert.ok(wall.boom < 3.0, `el brazo no se acortó: ${wall.boom}`);
  assert.equal(wall.occluded, true);
});

test("cámara: nunca queda dentro de un sólido de cámara (barrido completo)", () => {
  const subjects = [
    [3.0, 0], [4.1, -5.0], [-5.2, -5.0], [-5.6, 5.0], [0, 0], [-1.0, 3.6], [-3.0, -2.4], [2.6, -3.4],
  ];
  let checked = 0;
  for (const [x, z] of subjects) {
    assert.equal(camera.pointInsideSolids({ x, y: 1.85, z }, solids), false, `origen dentro de sólido en (${x},${z})`);
    for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 8) {
      for (const pitch of [-0.14, 0, 0.28, 0.58]) {
        const state = camera.createCameraState({ yaw, pitch, distance: 6.4 });
        solve(state, { x, y: 0, z });
        assert.equal(
          camera.pointInsideSolids(state.position, solids),
          false,
          `cámara dentro de sólido: sujeto (${x},${z}) yaw ${yaw.toFixed(2)} pitch ${pitch} boom ${state.boom.toFixed(2)}`
        );
        checked++;
      }
    }
  }
  assert.ok(checked >= 250, `barrido insuficiente: ${checked}`);
});

test("cámara: histéresis — alarga despacio, nunca de golpe", () => {
  const state = camera.createCameraState({ yaw: Math.PI / 2, pitch: 0.18, distance: 6.4 });
  solve(state, { x: 4.1, y: 0, z: -2.4 });
  const collapsed = state.boom;
  assert.ok(collapsed < 3.0);

  // Al alejarse del muro y mirar hacia espacio libre, el brazo se recupera con calma.
  state.yaw = 0;
  solve(state, { x: 0, y: 0, z: 0 }, 1 / 60);
  const afterOneFrame = state.boom;
  assert.ok(afterOneFrame - collapsed < 0.6, `salto de brazo demasiado brusco: ${afterOneFrame - collapsed}`);

  for (let i = 0; i < 60; i++) solve(state, { x: 0, y: 0, z: 0 }, 1 / 60);
  assert.ok(state.boom > 5.5, `no recuperó el brazo: ${state.boom}`);
  assert.equal(state.occluded, false);
});

test("cámara: suavizado independiente del frame rate", () => {
  const fast = camera.createCameraState({ yaw: 0, pitch: 0.2, distance: 6.4 });
  const slow = camera.createCameraState({ yaw: 0, pitch: 0.2, distance: 6.4 });
  solve(fast, { x: 0, y: 0, z: 0 });
  solve(slow, { x: 0, y: 0, z: 0 });
  // Teleportar al sujeto y comparar 60 pasos pequeños vs 1 paso grande (mismo tiempo).
  for (let i = 0; i < 60; i++) solve(fast, { x: -3.0, y: 0, z: 4.0 }, 1 / 60);
  solve(slow, { x: -3.0, y: 0, z: 4.0 }, 1);
  assert.ok(Math.abs(fast.position.x - slow.position.x) < 1e-6, `x: ${fast.position.x} vs ${slow.position.x}`);
  assert.ok(Math.abs(fast.position.z - slow.position.z) < 1e-6, `z: ${fast.position.z} vs ${slow.position.z}`);
  assert.ok(Math.abs(fast.target.y - slow.target.y) < 1e-6);
});

test("cámara: pitch acotado y zoom con objetivo suavizado (R1-A)", () => {
  const state = camera.createCameraState({ yaw: 0, pitch: 0.2, distance: 6.4 });
  camera.applyLook(state, 0, 10000);
  assert.equal(state.pitch, camera.CAMERA_LIMITS.pitchMax);
  camera.applyLook(state, 0, -10000);
  assert.equal(state.pitch, camera.CAMERA_LIMITS.pitchMin);

  // El zoom mueve un objetivo acotado, no la distancia final.
  for (let i = 0; i < 40; i++) camera.adjustZoom(state, 2);
  assert.equal(state.distanceTarget, camera.CAMERA_LIMITS.distanceMax);
  for (let i = 0; i < 80; i++) camera.adjustZoom(state, -2);
  assert.equal(state.distanceTarget, camera.CAMERA_LIMITS.distanceMin);

  // Y la distancia real lo persigue con suavizado (nada de saltos).
  const zoomed = camera.createCameraState({ yaw: 0, pitch: 0.2, distance: 6.4 });
  solve(zoomed, { x: 0, y: 0, z: 0 });
  camera.adjustZoom(zoomed, 3.0);
  solve(zoomed, { x: 0, y: 0, z: 0 }, 1 / 60);
  assert.ok(zoomed.distance > 6.4 && zoomed.distance < 6.4 + 3.0 * 0.3, `primer frame: ${zoomed.distance}`);
  for (let i = 0; i < 180; i++) solve(zoomed, { x: 0, y: 0, z: 0 }, 1 / 60);
  assert.ok(Math.abs(zoomed.distance - zoomed.distanceTarget) < 0.02, `distancia final: ${zoomed.distance}`);
});

test("cámara: recentrado automático tras el sujeto cuando avanza (R1-A)", () => {
  const heading = 0.6;
  const state = camera.createCameraState({ yaw: heading + Math.PI + 0.9, pitch: 0.2, distance: 6.4 });
  // Sin velocidad no hay recentrado.
  solve(state, { x: 0, y: 0, z: 0 }, 1 / 60, 0, heading);
  assert.equal(state.recenterActive, false);
  const idleYaw = state.yaw;

  // Avanzando, la cámara vuelve poco a poco detrás del sujeto.
  let activeFrames = 0;
  for (let i = 0; i < 60; i++) {
    solve(state, { x: 0, y: 0, z: 0 }, 1 / 60, 3.0, heading);
    if (state.recenterActive) activeFrames++;
  }
  // El recentrado actúa hasta entrar en la zona muerta y luego se detiene.
  assert.ok(activeFrames > 5, `frames con recentrado activo: ${activeFrames}`);
  assert.equal(state.recenterActive, false, "ya está detrás: no debe seguir empujando");
  assert.ok(Math.abs(state.yaw - idleYaw) > 0.2, `no recentró: ${state.yaw} vs ${idleYaw}`);
  const behind = Math.abs(Math.atan2(Math.sin(state.yaw - heading - Math.PI), Math.cos(state.yaw - heading - Math.PI)));
  assert.ok(behind < 0.3, `distancia angular a "detrás": ${behind}`);

  // Si el jugador acaba de mover la cámara, el recentrado espera.
  const manual = camera.createCameraState({ yaw: heading + Math.PI + 1.0, pitch: 0.2, distance: 6.4 });
  camera.applyLook(manual, -40, 0);
  const yawAfterDrag = manual.yaw;
  solve(manual, { x: 0, y: 0, z: 0 }, 1 / 60, 3.0, heading);
  assert.equal(manual.recenterActive, false, "no debe recentrar durante el control manual");
  assert.equal(manual.yaw, yawAfterDrag);

  // Tampoco recentra mientras hay diálogo (encuadre fijo en el interlocutor).
  const dialog = camera.createCameraState({ yaw: heading + Math.PI + 1.0, pitch: 0.2, distance: 6.4 });
  solve(dialog, { x: 0, y: 0, z: 0 }, 1 / 60, 3.0, heading, { x: 3, y: 0, z: 3 });
  assert.equal(dialog.recenterActive, false);
});

test("cámara: hombro lateral cuando el brazo se acorta (R1-A)", () => {
  // Brazo medio (muro a ~2,6 m): el hombro entra y el encuadre deja de centrar la mascota.
  const mid = camera.createCameraState({ yaw: Math.PI / 2, pitch: 0.18, distance: 6.4 });
  solve(mid, { x: 2.0, y: 0, z: -2.4 });
  assert.ok(mid.boom > camera.CAMERA_LIMITS.minBoom, `brazo: ${mid.boom}`);
  assert.ok(mid.boom < camera.CAMERA_LIMITS.shoulderBoom, `el brazo debería estar acortado: ${mid.boom}`);
  assert.ok(mid.shoulder > 0.05, `hombro esperado > 0.05, fue ${mid.shoulder}`);
  assert.equal(camera.pointInsideSolids(mid.position, solids), false, "el hombro no debe meter la cámara en el muro");
  const lateral = Math.abs(
    (mid.position.x - mid.target.x) * Math.cos(mid.yaw) -
    (mid.position.z - mid.target.z) * -Math.sin(mid.yaw)
  );
  assert.ok(lateral > 0.05, `desplazamiento lateral: ${lateral}`);

  // Brazo pegado a un muro (más cerca que el mínimo): el hombro CEDE antes que atravesar.
  const tight = camera.createCameraState({ yaw: Math.PI / 2, pitch: 0.18, distance: 6.4 });
  solve(tight, { x: 4.1, y: 0, z: -2.4 });
  assert.equal(tight.shoulder, 0, "sin espacio, primero se sacrifica el hombro");
  assert.equal(camera.pointInsideSolids(tight.position, solids), false, "y nunca atraviesa el muro");

  // Brazo largo sin oclusión ⇒ sin hombro (encuadre centrado).
  const long = camera.createCameraState({ yaw: 0, pitch: 0.2, distance: 6.4 });
  solve(long, { x: 0, y: 0, z: 0 });
  assert.equal(long.shoulder, 0);
});

test("cámara: encuadre de diálogo (R1-A)", () => {
  const state = camera.createCameraState({ yaw: 0.4, pitch: 0.24, distance: 8.0 });
  const focus = { x: 3.2, y: 0, z: 3.4 };
  solve(state, { x: 0, y: 0, z: 0 });
  const boomBefore = state.boom;
  for (let i = 0; i < 120; i++) solve(state, { x: 0, y: 0, z: 0 }, 1 / 60, 0, 0, focus);
  assert.ok(state.focus > 0.9, `foco: ${state.focus}`);
  assert.ok(
    Math.abs(state.boom - camera.CAMERA_LIMITS.focusBoom) < 0.3,
    `brazo de diálogo: ${state.boom} (antes ${boomBefore})`
  );
  // La mirada se mezcla hacia el interlocutor (entre el sujeto y él, nunca más allá).
  assert.ok(state.target.x > 0.4 && state.target.x < focus.x, `mirada x: ${state.target.x}`);
  assert.ok(state.shoulder < 0.05, "durante el diálogo el encuadre se centra");

  // Al cerrar el diálogo vuelve a su sitio.
  for (let i = 0; i < 120; i++) solve(state, { x: 0, y: 0, z: 0 }, 1 / 60, 0, 0, null);
  assert.ok(state.focus < 0.1, `foco residual: ${state.focus}`);
  assert.ok(Math.abs(state.target.x) < 0.06, `mirada vuelve al sujeto: ${state.target.x}`);
});

test("cámara: el barrido de no-penetración sigue limpio con hombro y recentrado activos", () => {
  const subjects = [
    [3.0, 0], [4.1, -5.0], [-5.2, -5.0], [-5.6, 5.0], [0, 0], [-1.0, 3.6], [-3.0, -2.4], [2.6, -3.4],
  ];
  let checked = 0;
  for (const [x, z] of subjects) {
    for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 8) {
      for (const pitch of [-0.14, 0.2, 0.58]) {
        const state = camera.createCameraState({ yaw, pitch, distance: 6.4 });
        // Con recentrado activo y velocidad de carrera.
        for (let i = 0; i < 4; i++) solve(state, { x, y: 0, z }, 1 / 60, 4.0, 0.35);
        assert.equal(
          camera.pointInsideSolids(state.position, solids),
          false,
          `cámara dentro de sólido: sujeto (${x},${z}) yaw ${yaw.toFixed(2)} pitch ${pitch}`
        );
        checked++;
      }
    }
  }
  assert.ok(checked >= 180, `barrido insuficiente: ${checked}`);
});

test("cámara: FOV se abre al correr y vuelve al caminar", () => {
  const state = camera.createCameraState({ yaw: 0, pitch: 0.2, distance: 6.4 });
  for (let i = 0; i < 120; i++) solve(state, { x: 0, y: 0, z: 0 }, 1 / 60, 6.0);
  assert.ok(state.fov > 59, `FOV corriendo: ${state.fov}`);
  for (let i = 0; i < 240; i++) solve(state, { x: 0, y: 0, z: 0 }, 1 / 60, 0);
  assert.ok(state.fov < 56, `FOV caminando: ${state.fov}`);
});

test("cámara: intersección rayo-AABB correcta", () => {
  const box = { minX: 1, maxX: 2, minY: 0, maxY: 2, minZ: -0.5, maxZ: 0.5 };
  assert.ok(Math.abs(camera.rayAabbDistance(0, 1, 0, 1, 0, 0, box) - 1) < 1e-9);
  assert.equal(camera.rayAabbDistance(0, 1, 0, -1, 0, 0, box), Infinity);
  assert.equal(camera.rayAabbDistance(5, 1, 0, 1, 0, 0, box), Infinity);
  assert.equal(camera.rayAabbDistance(0, 5, 0, 0, -1, 0, box), Infinity, "fuera del rango en X");
  assert.equal(camera.rayAabbDistance(1.5, 5, 0, 0, -1, 0, box), 3, "cae desde arriba dentro de la caja");
  assert.equal(camera.pointInsideSolids({ x: 1.5, y: 1, z: 0 }, [box]), true);
  assert.equal(camera.pointInsideSolids({ x: 1.5, y: 3, z: 0 }, [box]), false);
  // Sin obstáculo el brazo usa la distancia pedida completa.
  assert.equal(camera.freeBoomDistance({ x: 0, y: 2, z: 0 }, { x: 0, y: 0.2, z: 1 }, 6.4, []), 6.4);
});

test("cámara: el sujeto nunca queda fuera de cuadro por el recorte (el objetivo se mantiene)", () => {
  const state = camera.createCameraState({ yaw: 1.1, pitch: 0.3, distance: 6.4 });
  solve(state, { x: 2.0, y: 0, z: -2.0 });
  assert.ok(Math.abs(state.target.x - 2.0) < 1e-9);
  assert.ok(Math.abs(state.target.z + 2.0) < 1e-9);
  assert.ok(state.target.y > 0.8);
});
