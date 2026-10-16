"use strict";

/**
 * Contrato del mapa "Plazoleta del Río" (M2 / Cali Viva POC).
 * Verifica que UNA sola representación (MAP_V1) sea coherente para colisión,
 * superficies, puntos de interés, presupuesto de dibujo y alcanzabilidad.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

let map;
let mapModule;

test.before(async () => {
  mapModule = await import("../../js/world/plazoleta/map-v1.mjs");
  map = mapModule.PLAZOLETA_MAP;
});

test("mapa: el recinto es de 20 x 20 metros y la validación de contrato pasa", () => {
  assert.equal(map.widthMetres, 20);
  assert.equal(map.depthMetres, 20);
  const result = mapModule.validateMap(map);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test("mapa: cada colisionador tiene autoría visual declarada y banda vertical válida", () => {
  assert.ok(map.solids.length >= 18, `se esperan al menos 18 sólidos, hay ${map.solids.length}`);
  for (const solid of map.solids) {
    assert.ok(solid.note && solid.note.length > 3, `sólido ${solid.id} sin nota de autoría`);
    assert.ok(solid.yMax > solid.yMin, `sólido ${solid.id} con banda vertical vacía`);
  }
});

test("mapa: el puente pasa por encima de la ribera y del agua (bandas verticales)", () => {
  // A nivel de calle el agua y el parapeto bloquean...
  assert.equal(mapModule.blockedAt(map, -8, 0, 0, 0.34), true, "el agua debe bloquear a pie");
  assert.equal(mapModule.blockedAt(map, -6.2, -5, 0, 0.34), true, "el parapeto debe bloquear a pie");
  // ...pero sobre el tablero (y=1.15) no.
  assert.equal(mapModule.blockedAt(map, -8, 0, map.bridgeDeckY, 0.34), false, "el tablero debe ser transitable");
  assert.equal(mapModule.blockedAt(map, -8, 0, map.bridgeDeckY, 0.34, 1.02), false);
  // Los pretiles sí bloquean a quien va sobre el tablero.
  assert.equal(mapModule.blockedAt(map, -8, 2.45, map.bridgeDeckY, 0.34), true, "el pretil debe bloquear en el puente");
});

test("mapa: superficies y alturas (tablero plano y rampa interpolada)", () => {
  // A nivel de calle el tablero NO es alcanzable: el paso máximo lo impide.
  assert.equal(mapModule.surfaceHeightAt(map, -7.5, 0, 0, 0.3), 0);
  // Sobre el tablero, la superficie es el propio tablero.
  assert.equal(mapModule.surfaceHeightAt(map, -7.5, 0, map.bridgeDeckY), map.bridgeDeckY);
  const midRamp = mapModule.surfaceHeightAt(map, -2.0, 0, 0.6, 1.2);
  assert.ok(midRamp > 0.3 && midRamp < 0.9, `altura de rampa inesperada: ${midRamp}`);
  assert.equal(mapModule.surfaceHeightAt(map, 3, 6, 0), 0);
});

test("mapa: el spawn y todos los POI están libres de sólidos", () => {
  assert.equal(mapModule.blockedAt(map, map.spawn.x, map.spawn.z, 0, 0.34), false);
  for (const poi of map.interactables) {
    assert.equal(
      mapModule.blockedAt(map, poi.x, poi.z, poi.feetY ?? 0, 0.34),
      false,
      `POI ${poi.id} dentro de un sólido`
    );
  }
});

/** BFS en rejilla sobre el espacio transitable de un nivel. */
function reachableCells(startX, startZ, feetY, step = 0.2) {
  const area = map.playArea;
  const key = (ix, iz) => `${ix},${iz}`;
  const toIndex = (value, min) => Math.round((value - min) / step);
  const visited = new Set();
  const queue = [[toIndex(startX, area.minX), toIndex(startZ, area.minZ)]];
  visited.add(key(queue[0][0], queue[0][1]));
  while (queue.length > 0) {
    const [ix, iz] = queue.shift();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = ix + dx;
      const nz = iz + dz;
      const x = area.minX + nx * step;
      const z = area.minZ + nz * step;
      if (x < area.minX || x > area.maxX || z < area.minZ || z > area.maxZ) continue;
      const id = key(nx, nz);
      if (visited.has(id)) continue;
      if (mapModule.blockedAt(map, x, z, feetY, 0.34)) continue;
      visited.add(id);
      queue.push([nx, nz]);
    }
  }
  return { visited, toIndex, key };
}

test("mapa: todos los POI de planta baja son alcanzables caminando desde el spawn", () => {
  const { visited, toIndex, key } = reachableCells(map.spawn.x, map.spawn.z, 0);
  const groundPois = map.interactables.filter((poi) => (poi.feetY ?? 0) === 0);
  assert.ok(groundPois.length >= 4);
  // Un POI es alcanzable si existe una celda transitable dentro de su radio de interacción.
  for (const poi of groundPois) {
    const reach = poi.radius * 0.85;
    let found = false;
    for (let dx = -reach; dx <= reach && !found; dx += 0.2) {
      for (let dz = -reach; dz <= reach && !found; dz += 0.2) {
        if (Math.hypot(dx, dz) > reach) continue;
        const id = key(toIndex(poi.x + dx, map.playArea.minX), toIndex(poi.z + dz, map.playArea.minZ));
        if (visited.has(id)) found = true;
      }
    }
    assert.ok(found, `POI ${poi.id} no alcanzable desde el spawn`);
  }
});

test("mapa: el mirador del puente es alcanzable por la rampa, en el nivel del tablero", () => {
  // Base de la rampa alcanzable a pie...
  const ground = reachableCells(map.spawn.x, map.spawn.z, 0);
  const rampBase = ground.key(ground.toIndex(-0.7, map.playArea.minX), ground.toIndex(0, map.playArea.minZ));
  assert.ok(ground.visited.has(rampBase), "la base de la rampa debe ser alcanzable a pie");
  // ...y desde el alto de la rampa se llega al mirador sobre el tablero.
  const deck = reachableCells(-3.2, 0, map.bridgeDeckY);
  const mirador = map.interactables.find((poi) => poi.id === "mirador");
  const id = deck.key(deck.toIndex(mirador.x, map.playArea.minX), deck.toIndex(mirador.z, map.playArea.minZ));
  assert.ok(deck.visited.has(id), "el mirador debe ser alcanzable sobre el tablero");
});

test("mapa: presupuesto de draw calls planificado dentro de lo exigido", () => {
  const main = mapModule.plannedDrawCalls();
  const withShadows = mapModule.plannedDrawCallsWithShadows();
  assert.ok(main <= 90, `pase principal planificado ${main} > 90`);
  assert.ok(withShadows <= 115, `con sombras planificado ${withShadows} > 115`);
  assert.ok(main >= 20, "el presupuesto planificado parece incompleto");
});

test("mapa: los sólidos de cámara son un subconjunto de los sólidos reales", () => {
  const ids = new Set(map.solids.map((s) => s.id));
  for (const id of map.cameraSolidIds) assert.ok(ids.has(id), `sólido de cámara inexistente: ${id}`);
  const cameraBoxes = mapModule.cameraSolids(map);
  assert.ok(cameraBoxes.length >= 3);
  for (const box of cameraBoxes) assert.ok(box.yMax - box.yMin > 0);
});

test("mapa: familias de props con instancias válidas y dentro del recinto", () => {
  assert.ok(map.propFamilies.length >= 10);
  let total = 0;
  for (const family of map.propFamilies) {
    assert.ok(family.instances.length > 0, `familia ${family.id} vacía`);
    total += family.instances.length;
  }
  assert.ok(total >= 60, `se esperan al menos 60 instancias de props, hay ${total}`);
  const pigeonHome = map.propFamilies.find((f) => f.id === "paloma");
  assert.equal(pigeonHome.instances.length, 3, "el POC declara 3 palomas");
});

test("mapa: la misión encadena POI existentes y su recompensa se declara como simulación local", () => {
  const ids = new Set(map.interactables.map((poi) => poi.id));
  for (const step of map.quest.steps) assert.ok(ids.has(step.trigger), `trigger inexistente: ${step.trigger}`);
  assert.ok(map.quest.rewardXp > 0);
  assert.match(map.quest.rewardLabel, /simulación local/i);
  assert.match(map.quest.rewardLabel, /no acredita progreso real/i);
});
