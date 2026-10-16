const test = require('node:test');
const assert = require('node:assert/strict');

let layout;
let cameraRig;
let locomotion;
let quest;
let disposal;
let perf;
let worldCore;

test.before(async () => {
  layout = await import('../../js/world/cali-viva/layout.mjs');
  cameraRig = await import('../../js/world/cali-viva/camera-rig.mjs');
  locomotion = await import('../../js/world/cali-viva/locomotion.mjs');
  quest = await import('../../js/world/cali-viva/quest.mjs');
  disposal = await import('../../js/world/cali-viva/disposal.mjs');
  perf = await import('../../js/world/cali-viva/perf-monitor.mjs');
  worldCore = await import('../../js/world/world-core.mjs');
});

// -------------------------------------------------------------
// 1. LAYOUT DE LA PLAZOLETA DEL RÍO
// -------------------------------------------------------------
test('cali-viva layout: spawn point is inside plaza and navigable', () => {
  const { SPAWN, PLAZA, SOLIDS } = layout;
  assert.ok(SPAWN.x >= PLAZA.minX && SPAWN.x <= PLAZA.maxX);
  assert.ok(SPAWN.z >= PLAZA.minZ && SPAWN.z <= PLAZA.maxZ);
  assert.equal(worldCore.canOccupy(SPAWN.x, SPAWN.z, SOLIDS), true);
});

test('cali-viva layout: bridge deck height forms a positive parabolic arch over the river', () => {
  const { BRIDGE, groundHeight } = layout;
  const midZ = (BRIDGE.startZ + BRIDGE.endZ) / 2;
  const midX = (BRIDGE.minX + BRIDGE.maxX) / 2;

  // En la plaza plana la altura es 0
  assert.equal(groundHeight(0, 0), 0);

  // En el punto medio del puente alcanza la altura máxima (rise)
  const peakHeight = groundHeight(midX, midZ);
  assert.ok(peakHeight > 0.5);
  assert.ok(Math.abs(peakHeight - BRIDGE.rise) < 1e-4);

  // Fuera del puente vuelve a 0
  assert.equal(groundHeight(midX, 2), 0);
  assert.equal(groundHeight(15, midZ), 0);
});

test('cali-viva layout: mirador detection identifies positions on the bridge deck', () => {
  const { MIRADOR, isInsideMirador } = layout;
  assert.equal(isInsideMirador(MIRADOR.x, MIRADOR.z), true);
  assert.equal(isInsideMirador(0, 6), false);
});

test('cali-viva layout: solids block walking into the facade or off the plaza bounds', () => {
  const { FACADE, SOLIDS } = layout;
  const facadeInsideX = (FACADE.frontX + FACADE.backX) / 2;
  const facadeInsideZ = (FACADE.minZ + FACADE.maxZ) / 2;
  assert.equal(worldCore.canOccupy(facadeInsideX, facadeInsideZ, SOLIDS), false);
  assert.equal(worldCore.canOccupy(50, 50, SOLIDS), false);
});

// -------------------------------------------------------------
// 2. CÁMARA EN 3ª PERSONA Y EVASIÓN DE MUROS
// -------------------------------------------------------------
test('cali-viva camera: orbit clamps pitch and distance to safe comfort limits', () => {
  const { createOrbit, applyOrbitInput, CAMERA_LIMITS } = cameraRig;
  const o = createOrbit({ yaw: 0, pitch: 0.3, distance: 5 });

  // Entrada extrema de pitch se limita
  const pitched = applyOrbitInput(o, { dPitch: 10 });
  assert.equal(pitched.pitch, CAMERA_LIMITS.maxPitch);

  const underPitched = applyOrbitInput(o, { dPitch: -10 });
  assert.equal(underPitched.pitch, CAMERA_LIMITS.minPitch);

  // Entrada extrema de zoom se limita
  const zoomedOut = applyOrbitInput(o, { dZoom: 10 });
  assert.equal(zoomedOut.distance, CAMERA_LIMITS.maxDistance);

  const zoomedIn = applyOrbitInput(o, { dZoom: -10 });
  assert.equal(zoomedIn.distance, CAMERA_LIMITS.minDistance);
});

test('cali-viva camera: rayAabbDistance correctly computes slab intersection distance', () => {
  const { rayAabbDistance } = cameraRig;
  const origin = { x: 0, y: 1, z: 0 };
  const dir = { x: 1, y: 0, z: 0 }; // rayo hacia +X
  const box = { minX: 3, maxX: 5, minY: 0, maxY: 2, minZ: -1, maxZ: 1 };

  const dist = rayAabbDistance(origin, dir, box);
  assert.equal(dist, 3); // choca en x = 3

  // Rayo opuesto no choca
  const distOpposite = rayAabbDistance(origin, { x: -1, y: 0, z: 0 }, box);
  assert.equal(distOpposite, Infinity);
});

test('cali-viva camera: resolveCameraDistance pulls distance inward when obstructed', () => {
  const { resolveCameraDistance } = cameraRig;
  const target = { x: 0, y: 1, z: 0 };
  const dir = { x: 1, y: 0, z: 0 }; // hacia obstáculo en x = 4
  const obstacles = [{ minX: 3.8, maxX: 6, minY: 0, maxY: 3, minZ: -2, maxZ: 2 }];

  const desired = 8.0;
  const safe = resolveCameraDistance(target, dir, desired, obstacles);
  assert.ok(safe < desired);
  assert.ok(safe >= 0.6);
});

test('cali-viva camera: smoothCameraDistance jumps immediately on occlusion and returns smoothly', () => {
  const { smoothCameraDistance } = cameraRig;
  // Si target es menor (un muro apareció de repente), salta de inmediato para no atravesarlo
  const current = 6.0;
  const obstructedTarget = 2.5;
  const jumped = smoothCameraDistance(current, obstructedTarget, 0.016);
  assert.equal(jumped, obstructedTarget);

  // Si target es mayor (el muro desapareció), amortigua el regreso suavemente
  const clearedTarget = 6.0;
  const returning = smoothCameraDistance(2.5, clearedTarget, 0.016, 5);
  assert.ok(returning > 2.5);
  assert.ok(returning < clearedTarget);
});

// -------------------------------------------------------------
// 3. LOCOMOCIÓN Y GIRO
// -------------------------------------------------------------
test('cali-viva locomotion: classifies gait states (idle, walk, run, turn)', () => {
  const { classifyGait, GAIT } = locomotion;
  assert.equal(classifyGait(0, 0), GAIT.IDLE);
  assert.equal(classifyGait(0, 3.5), GAIT.TURN);
  assert.equal(classifyGait(2.5, 0), GAIT.WALK);
  assert.equal(classifyGait(5.5, 0), GAIT.RUN);
});

test('cali-viva locomotion: cameraRelativeInput transforms input relative to orbit yaw', () => {
  const { cameraRelativeInput } = locomotion;
  // Con yaw = 0 (cámara al sur mirando al norte):
  // iz = +1 (adelante) debe apuntar a -Z (hacia el norte)
  const forward = cameraRelativeInput(0, 1, 0);
  assert.ok(Math.abs(forward.x) < 1e-6);
  assert.ok(forward.z < -0.99);

  // iz = -1 (atrás) debe apuntar a +Z
  const backward = cameraRelativeInput(0, -1, 0);
  assert.ok(backward.z > 0.99);
});

test('cali-viva locomotion: acceleration and capped turn rate integrate deterministically', () => {
  const { createLocomotionState, updateLocomotion, GAIT } = locomotion;
  let state = createLocomotionState(0);

  // Acelerando hacia adelante
  state = updateLocomotion(state, { dirX: 0, dirZ: 1, run: false }, 0.05);
  assert.ok(state.speed > 0);
  assert.equal(state.gait, GAIT.WALK);

  // Frenando al soltar
  state = updateLocomotion(state, { dirX: 0, dirZ: 0, run: false }, 0.08);
  state = updateLocomotion(state, { dirX: 0, dirZ: 0, run: false }, 0.08);
  assert.ok(state.speed < 1.0);
});

// -------------------------------------------------------------
// 4. GUION DE EXPLORACIÓN Y XP DEMO
// -------------------------------------------------------------
test('cali-viva quest: advances sequentially and does not skip steps', () => {
  const { createQuestState, currentStep, completeStep, isQuestComplete, DEMO_XP_PER_STEP } = quest;
  let q = createQuestState();
  assert.equal(currentStep(q).id, 'meet-lucia');
  assert.equal(q.demoXp, 0);

  // Intento de saltar a report-lucia debe ser rechazado
  const { changed: skipped } = completeStep(q, 'report-lucia');
  assert.equal(skipped, false);

  // Paso 1: hablar con Lucía
  const res1 = completeStep(q, 'meet-lucia');
  assert.equal(res1.changed, true);
  q = res1.state;
  assert.equal(currentStep(q).id, 'visit-mirador');
  assert.equal(q.demoXp, DEMO_XP_PER_STEP);

  // Paso 2: visitar mirador
  const res2 = completeStep(q, 'visit-mirador');
  assert.equal(res2.changed, true);
  q = res2.state;
  assert.equal(currentStep(q).id, 'report-lucia');

  // Paso 3: reportar a Lucía
  const res3 = completeStep(q, 'report-lucia');
  assert.equal(res3.changed, true);
  q = res3.state;
  assert.equal(isQuestComplete(q), true);
  assert.equal(q.demoXp, DEMO_XP_PER_STEP * 3);
});

// -------------------------------------------------------------
// 5. GESTIÓN Y LIBERACIÓN DETERMINISTA DE RECURSOS GPU
// -------------------------------------------------------------
test('cali-viva disposal: ResourceTracker disposes geometries, materials and textures cleanly', () => {
  const { ResourceTracker } = disposal;
  const tracker = new ResourceTracker();

  let geoDisposed = false;
  let matDisposed = false;

  const mockGeo = { isBufferGeometry: true, dispose() { geoDisposed = true; } };
  const mockMat = { isMaterial: true, dispose() { matDisposed = true; } };
  const mockMesh = {
    geometry: mockGeo,
    material: mockMat,
    traverse(cb) { cb(this); },
  };

  tracker.track(mockMesh);
  assert.ok(tracker.size >= 2);

  const count = tracker.dispose();
  assert.ok(count >= 2);
  assert.equal(geoDisposed, true);
  assert.equal(matDisposed, true);
  assert.equal(tracker.size, 0);
});

// -------------------------------------------------------------
// 6. MONITOR DE RENDIMIENTO (?perf=1)
// -------------------------------------------------------------
test('cali-viva perf: FrameStats computes real averages, p95 and max', () => {
  const { FrameStats, formatPerfLines } = perf;
  const stats = new FrameStats(10);
  for (let i = 1; i <= 10; i++) {
    stats.push(i * 2); // 2, 4, 6, 8, 10, 12, 14, 16, 18, 20
  }
  const summary = stats.summary();
  assert.equal(summary.count, 10);
  assert.equal(summary.avg, 11);
  assert.equal(summary.max, 20);
  assert.equal(summary.p95, 20);
  assert.ok(summary.fps > 0);

  const lines = formatPerfLines({
    frame: summary,
    cpu: summary,
    info: { calls: 12, triangles: 4500, geometries: 10, textures: 4 },
    heapMB: 45.2,
    pixelRatio: 1.5,
  });
  assert.equal(lines.length, 5);
  assert.ok(lines[0].includes('FPS'));
  assert.ok(lines[2].includes('Draw calls 12'));
});
