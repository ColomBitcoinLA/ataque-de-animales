/**
 * map-v1.mjs — Representación canónica del recinto "Plazoleta del Río" (M2 / Cali Viva POC).
 *
 * 20 m x 20 m jugables. Módulo PURO: sin three.js, sin DOM, sin red.
 * Una sola fuente de datos produce la geometría de colisión Y la geometría visual:
 *   - `solids`        → colisionadores AABB con banda vertical [yMin, yMax]
 *   - `surfaces`      → superficies caminables (planas o rampa)
 *   - `propFamilies`  → listas de instancias (posición/rotación/escala) por familia
 *   - `interactables` → puntos de interacción con verbo y radio
 *   - `cameraSolids`  → subconjunto que la cámara debe respetar (oclusión)
 *
 * tests/unit/plazoleta-map.test.cjs valida este contrato (validateMap) y el
 * presupuesto de draw calls planificado (DRAW_BUDGET).
 *
 * Referencias de identidad: Puente Ortiz sobre el río Cali, malecón arbolado,
 * casona republicana con arcada, Samán de sombra y palmas de la ribera.
 * No es una reconstrucción geográfica: es un microdistrito inspirado.
 */

export const UNIT = "metre";
export const STEP_UP = 0.42;
export const BRIDGE_DECK_Y = 1.15;

export const BOUNDS = Object.freeze({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
/** Área jugable. El oeste llega hasta el tablero del puente; el resto deja un borde decorativo. */
export const PLAY_AREA = Object.freeze({ minX: -9.7, maxX: 9.4, minZ: -9.4, maxZ: 9.4 });

/** Zonas del recinto. El ORDEN es prioridad: el puente está por encima del río. */
export const ZONES = Object.freeze([
  Object.freeze({ id: "puente", label: "Puente Ortiz", minX: -10, maxX: -3.4, minZ: -2.55, maxZ: 2.55 }),
  Object.freeze({ id: "rio", label: "Río Cali", minX: -10, maxX: -6.05, minZ: -10, maxZ: 10 }),
  Object.freeze({ id: "malecon", label: "Malecón", minX: -6.05, maxX: -4.2, minZ: -10, maxZ: 10 }),
  Object.freeze({ id: "plaza", label: "Plazoleta", minX: -4.2, maxX: 10, minZ: -10, maxZ: 10 }),
]);

/** Superficies caminables. `ramp` interpola y entre yFrom (en xFrom) e yTo (en xTo). */
export const SURFACES = Object.freeze([
  Object.freeze({ id: "deck", kind: "flat", minX: -10.0, maxX: -3.4, minZ: -2.4, maxZ: 2.4, y: BRIDGE_DECK_Y }),
  Object.freeze({
    id: "ramp", kind: "ramp", minX: -3.4, maxX: -0.6, minZ: -2.4, maxZ: 2.4,
    axis: "x", xFrom: -3.4, yFrom: BRIDGE_DECK_Y, xTo: -0.6, yTo: 0,
  }),
]);

const solid = (id, minX, maxX, minZ, maxZ, yMin, yMax, note = "") =>
  Object.freeze({ id, minX, maxX, minZ, maxZ, yMin, yMax, note });

/**
 * Colisionadores. Regla de autoría: un colisionador por volumen sólido relevante;
 * el detalle decorativo (molduras, hojas, barrotes finos) no genera colisión.
 * La banda vertical permite que el puente pase POR ENCIMA de la ribera y del agua.
 */
export const SOLIDS = Object.freeze([
  // Río: volumen bajo no caminable (bloquea al peatón, no al cuerpo que va sobre el puente).
  solid("rio", -10, -6.05, -10, 10, 0, 0.06, "agua"),

  // Muro de ribera (parapeto) con hueco para el puente.
  solid("parapeto-n", -6.38, -6.02, -10, -2.62, 0, 1.05, "muro de piedra norte"),
  solid("parapeto-s", -6.38, -6.02, 2.62, 10, 0, 1.05, "muro de piedra sur"),

  // Puente: pretiles (bloquean a quien va sobre el tablero) y muros de la rampa.
  solid("pretil-puente-n", -10, -3.4, -2.58, -2.32, 1.1, 2.3, "balustrada del puente"),
  solid("pretil-puente-s", -10, -3.4, 2.32, 2.58, 1.1, 2.3, "balustrada del puente"),
  solid("muro-rampa-n", -3.4, -0.6, -2.55, -2.32, 0, 2.3, "muro lateral de rampa"),
  solid("muro-rampa-s", -3.4, -0.6, 2.32, 2.55, 0, 2.3, "muro lateral de rampa"),

  // Casona republicana (una sola caja: la arcada vive dentro de su huella).
  solid("casona", 4.6, 9.9, -6.4, 1.6, 0, 9.2, "casona de dos plantas con arcada"),

  // Samán: tronco y anillo de banca.
  solid("samar-tronco", 0.8, 1.4, -2.45, -1.85, 0, 4.2, "tronco del Samán"),
  solid("samar-banca-n", 0.15, 2.05, -2.95, -2.6, 0, 0.55, "banca circular"),
  solid("samar-banca-s", 0.15, 2.05, -1.7, -1.35, 0, 0.55, "banca circular"),
  solid("samar-banca-w", 0.15, 0.5, -2.95, -1.35, 0, 0.55, "banca circular"),
  solid("samar-banca-e", 1.7, 2.05, -2.95, -1.35, 0, 0.55, "banca circular"),

  // Mobiliario y servicios.
  solid("fuente", -2.0, -0.4, 2.8, 4.4, 0, 0.85, "pileta de la plazoleta"),
  solid("puesto-lucia", 2.9, 4.5, 3.0, 4.3, 0, 1.15, "puesto de frutas de Lucía"),
  solid("banca-1", -3.9, -1.7, 6.4, 7.0, 0, 0.5, "banca"),
  solid("banca-2", 5.6, 7.8, 6.4, 7.0, 0, 0.5, "banca"),
  solid("banca-3", -5.9, -4.9, -6.8, -4.6, 0, 0.5, "banca del malecón"),
  solid("farol-1", -5.2, -4.9, -1.1, -0.8, 0, 3.4, "farol"),
  solid("farol-2", -5.2, -4.9, 4.9, 5.2, 0, 3.4, "farol"),
  solid("farol-3", 3.6, 3.9, -3.6, -3.3, 0, 3.4, "farol"),
  solid("farol-4", -0.15, 0.15, 7.4, 7.7, 0, 3.4, "farol"),
  solid("maceta-1", 3.5, 4.3, -7.4, -6.6, 0, 0.62, "matera con buganvilla"),
  solid("maceta-2", 6.4, 7.2, -7.4, -6.6, 0, 0.62, "matera con buganvilla"),
  solid("placa", -6.34, -6.06, 4.6, 5.8, 0, 1.02, "placa conmemorativa"),
]);

/** Subconjunto de sólidos que la cámara debe respetar (evita ocultar la acción trivial). */
export const CAMERA_SOLID_IDS = Object.freeze(["casona", "parapeto-n", "parapeto-s", "samar-tronco", "puesto-lucia"]);

export const SPAWN = Object.freeze({ x: -1.6, z: 5.6, heading: Math.PI * 0.85 });

/** Puntos de interés: verbo, radio y etiqueta legible. */
export const INTERACTABLES = Object.freeze([
  Object.freeze({ id: "lucia", kind: "npc", x: 4.3, z: 4.9, radius: 2.5, verb: "Hablar", label: "Lucía · entrenadora" }),
  Object.freeze({ id: "samar", kind: "world", x: 1.1, z: -3.4, radius: 2.4, verb: "Observar", label: "Samán centenario" }),
  Object.freeze({ id: "placa", kind: "world", x: -5.6, z: 5.2, radius: 1.9, verb: "Leer", label: "Placa del malecón" }),
  Object.freeze({ id: "mirador", kind: "world", x: -7.4, z: 0, radius: 2.2, verb: "Mirar", label: "Mirador del puente", feetY: BRIDGE_DECK_Y }),
  Object.freeze({ id: "fuente", kind: "world", x: -1.2, z: 5.05, radius: 1.8, verb: "Beber", label: "Pileta" }),
]);

/** Misiones: cadena real de estado, recompensa explícitamente marcada como simulación local. */
export const QUEST = Object.freeze({
  id: "primera-exploracion",
  title: "Primera exploración",
  steps: Object.freeze([
    Object.freeze({ id: "hablar-lucia", objective: "Habla con Lucía en su puesto", trigger: "lucia" }),
    Object.freeze({ id: "observar-samar", objective: "Observa el Samán del centro", trigger: "samar" }),
    Object.freeze({ id: "leer-placa", objective: "Lee la placa del malecón", trigger: "placa" }),
    Object.freeze({ id: "mirador-puente", objective: "Cruza el puente y mira el río", trigger: "mirador" }),
    Object.freeze({ id: "volver-lucia", objective: "Vuelve con Lucía", trigger: "lucia" }),
  ]),
  rewardXp: 120,
  rewardLabel: "+120 XP (simulación local · no acredita progreso real)",
});

/**
 * Familias de props instanciadas: misma data para colisión decorativa, presupuesto y render.
 * `instances` son [x, z, rotY, scale].
 */
export const PROP_FAMILIES = Object.freeze([
  Object.freeze({ id: "palma", geometry: "palm", instances: Object.freeze([
    Object.freeze([-5.2, -8.2, 0.3, 1.0]), Object.freeze([-5.2, -3.9, 1.1, 0.9]),
    Object.freeze([-5.2, 8.4, 2.2, 1.05]), Object.freeze([-7.6, -6.2, 0.7, 0.85]),
    Object.freeze([-8.4, 6.4, 1.7, 0.95]),
  ]) }),
  Object.freeze({ id: "banca", geometry: "bench", instances: Object.freeze([
    Object.freeze([-2.8, 6.7, 0, 1]), Object.freeze([6.7, 6.7, Math.PI, 1]), Object.freeze([-5.4, -5.7, Math.PI / 2, 1]),
  ]) }),
  Object.freeze({ id: "farol", geometry: "lamp", instances: Object.freeze([
    Object.freeze([-5.05, -0.95, 0, 1]), Object.freeze([-5.05, 5.05, 0, 1]),
    Object.freeze([3.75, -3.45, 0, 1]), Object.freeze([0, 7.55, 0, 1]),
  ]) }),
  Object.freeze({ id: "bolardo", geometry: "bollard", instances: Object.freeze([
    Object.freeze([-4.1, 0.4, 0, 1]), Object.freeze([-4.1, -0.9, 0, 1]), Object.freeze([-4.1, 1.7, 0, 1]),
    Object.freeze([-4.1, 3.4, 0, 1]), Object.freeze([-4.1, -2.2, 0, 1]), Object.freeze([-4.1, 5.6, 0, 1]),
  ]) }),
  Object.freeze({ id: "maceta", geometry: "planter", instances: Object.freeze([
    Object.freeze([3.9, -7.0, 0, 1]), Object.freeze([6.8, -7.0, 0, 1]),
  ]) }),
  Object.freeze({ id: "papelera", geometry: "bin", instances: Object.freeze([
    Object.freeze([-4.3, -3.6, 0, 1]), Object.freeze([2.2, 7.9, 0, 1]),
  ]) }),
  Object.freeze({ id: "caja-puesto", geometry: "crate", instances: Object.freeze([
    Object.freeze([3.2, 4.55, 0.2, 1]), Object.freeze([3.9, 4.62, -0.3, 0.9]), Object.freeze([3.5, 4.05, 0.1, 0.8]),
  ]) }),
  Object.freeze({ id: "buganvilla", geometry: "flower", instances: Object.freeze([
    Object.freeze([3.9, -7.25, 0, 1, 0.62]), Object.freeze([6.8, -7.25, 0, 1.4, 0.62]),
    Object.freeze([4.62, -1.4, 0, 1.1, 2.4]), Object.freeze([4.62, 0.2, 0, 0.9, 3.1]),
    Object.freeze([4.62, 1.2, 0, 1.2, 2.0]),
  ]) }),
  Object.freeze({ id: "hierba", geometry: "grassTuft", instances: Object.freeze([
    Object.freeze([-0.6, -4.6, 0.4, 1]), Object.freeze([2.6, -4.9, 1.2, 0.9]),
    Object.freeze([3.4, -3.2, 2.1, 1.1]), Object.freeze([-0.9, -2.2, 0.7, 0.85]),
    Object.freeze([1.9, -0.6, 1.6, 1.0]), Object.freeze([2.9, 1.4, 0.2, 0.95]),
    Object.freeze([-2.6, -3.9, 2.6, 1.05]), Object.freeze([3.9, 2.6, 1.1, 0.9]),
    Object.freeze([-3.2, 1.1, 0.5, 0.9]), Object.freeze([2.2, 3.2, 1.9, 1.0]),
    Object.freeze([-1.9, -6.2, 0.9, 1.15]), Object.freeze([0.2, -5.6, 2.3, 0.95]),
  ]) }),
  Object.freeze({ id: "balustrada", geometry: "baluster", instances: Object.freeze([
    // 18 balaustres repartidos en el pretil del puente.
    ...Array.from({ length: 9 }, (_, i) => Object.freeze([-9.6 + i * 0.75, -2.45, 0, 1])),
    ...Array.from({ length: 9 }, (_, i) => Object.freeze([-9.6 + i * 0.75, 2.45, 0, 1])),
  ]) }),
  Object.freeze({ id: "paloma", geometry: "pigeon", instances: Object.freeze([
    Object.freeze([0.4, 5.4, 0.6, 1]), Object.freeze([1.1, 5.9, -1.2, 0.95]), Object.freeze([-0.3, 6.3, 2.4, 1.05]),
  ]) }),
  Object.freeze({ id: "teja", geometry: "roofTile", instances: Object.freeze(
    // Teja de barro corrida a lo largo del alero que mira a la plazoleta (y = altura del alero).
    Array.from({ length: 26 }, (_, i) => Object.freeze([4.52, -6.3 + i * 0.312, 0, 1, 7.78]))
  ) }),
  Object.freeze({ id: "barrote", geometry: "railingBar", instances: Object.freeze(
    // Barrotes del balcón republicano (banda continua sobre la arcada).
    Array.from({ length: 15 }, (_, i) => Object.freeze([4.5, -5.6 + i * 0.47, 0, 1, 3.72]))
  ) }),
]);

/**
 * Presupuesto de draw calls por construcción (no medido en GPU).
 * Se usa en dos sitios: test de contrato (mapa ⇒ presupuesto) y overlay ?perf=1
 * (planificado vs renderer.info.render.calls real).
 */
export const DRAW_BUDGET = Object.freeze({
  statics: Object.freeze({
    "sky-dome": 1, "sun-glow": 1,
    "plaza-floor": 1, "malecon-stone": 1, "river-bed": 1, water: 1, "river-wall": 1,
    "bridge-deck": 1, "facade-walls": 1, "facade-trim": 1, "facade-accent": 1, "facade-roof": 1,
    "facade-foliage": 1, "samar-trunk": 1, "samar-canopy": 2, "samar-bench": 1,
    fountain: 2, "stall-structure": 1, "stall-parasol": 1, plaque: 1, "distant-ridges": 3,
  }),
  instanced: 14,
  characters: Object.freeze({ salamander: 10, lucia: 8 }),
  shadowCasters: 26,
});

export const PLAZOLETA_MAP = Object.freeze({
  id: "plazoleta-del-rio",
  label: "Plazoleta del Río · Cali",
  unit: UNIT,
  widthMetres: BOUNDS.maxX - BOUNDS.minX,
  depthMetres: BOUNDS.maxZ - BOUNDS.minZ,
  bounds: BOUNDS,
  playArea: PLAY_AREA,
  stepUp: STEP_UP,
  bridgeDeckY: BRIDGE_DECK_Y,
  zones: ZONES,
  surfaces: SURFACES,
  solids: SOLIDS,
  cameraSolidIds: CAMERA_SOLID_IDS,
  spawn: SPAWN,
  interactables: INTERACTABLES,
  quest: QUEST,
  propFamilies: PROP_FAMILIES,
  drawBudget: DRAW_BUDGET,
  timeOfDay: Object.freeze({ preset: "golden", sunAzimuth: 2.35, sunElevation: 0.42, label: "4:40 p. m." }),
});

/** Sólidos que la cámara debe respetar. */
export function cameraSolids(map = PLAZOLETA_MAP) {
  return map.solids.filter((s) => map.cameraSolidIds.includes(s.id));
}

/**
 * ¿Bloquea este sólido a un cuerpo cuya banda vertical es [feetY, headY]?
 * Test inclusivo (bordes cuentan), coherente con la semántica M1.
 */
export function solidBlocksBody(s, feetY, headY) {
  return feetY < s.yMax && headY > s.yMin;
}

/** ¿La posición (x,z) está bloqueada para un cuerpo con radio y banda vertical? */
export function blockedAt(map, x, z, feetY, radius, headHeight = 1.25) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return true;
  const headY = feetY + headHeight;
  for (const s of map.solids) {
    if (x + radius <= s.minX || x - radius >= s.maxX || z + radius <= s.minZ || z - radius >= s.maxZ) continue;
    if (solidBlocksBody(s, feetY, headY)) return true;
  }
  return false;
}

/**
 * Altura de la superficie caminable bajo el cuerpo, dado el paso máximo permitido.
 * Devuelve la superficie más alta que el cuerpo puede pisar sin "trepar".
 */
export function surfaceHeightAt(map, x, z, feetY, stepUp = map.stepUp) {
  let best = 0;
  const limit = feetY + stepUp;
  for (const surface of map.surfaces) {
    if (x < surface.minX || x > surface.maxX || z < surface.minZ || z > surface.maxZ) continue;
    const y = surfaceHeightOf(surface, x);
    if (y <= limit && y > best) best = y;
  }
  return best;
}

/** Altura de una superficie concreta en la coordenada x (soporta rampas). */
export function surfaceHeightOf(surface, x) {
  if (surface.kind === "flat") return surface.y;
  const t = (x - surface.xFrom) / (surface.xTo - surface.xFrom);
  const clamped = Math.min(1, Math.max(0, t));
  return surface.yFrom + (surface.yTo - surface.yFrom) * clamped;
}

/** Zona que contiene el punto (o la más cercana si está fuera). */
export function zoneAt(map, x, z) {
  for (const zone of map.zones) {
    if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) return zone;
  }
  return map.zones[map.zones.length - 1];
}

/**
 * Validación de contrato del mapa. Devuelve todas las violaciones, no la primera.
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateMap(map = PLAZOLETA_MAP) {
  const errors = [];
  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  const inBounds = (box) =>
    box.minX >= map.bounds.minX && box.maxX <= map.bounds.maxX &&
    box.minZ >= map.bounds.minZ && box.maxZ <= map.bounds.maxZ;

  if (map.widthMetres !== 20 || map.depthMetres !== 20) {
    errors.push(`el recinto debe ser 20x20 m, es ${map.widthMetres}x${map.depthMetres}`);
  }
  if (!(map.playArea.minX > map.bounds.minX && map.playArea.maxX < map.bounds.maxX &&
        map.playArea.minZ > map.bounds.minZ && map.playArea.maxZ < map.bounds.maxZ)) {
    errors.push("playArea debe estar estrictamente dentro de bounds");
  }

  const ids = new Set();
  for (const s of map.solids) {
    if (ids.has(s.id)) errors.push(`sólido duplicado: ${s.id}`);
    ids.add(s.id);
    for (const key of ["minX", "maxX", "minZ", "maxZ", "yMin", "yMax"]) {
      if (!finite(s[key])) errors.push(`sólido ${s.id}: ${key} no finito`);
    }
    if (s.maxX <= s.minX || s.maxZ <= s.minZ) errors.push(`sólido ${s.id}: caja degenerada`);
    if (s.yMax <= s.yMin) errors.push(`sólido ${s.id}: banda vertical vacía`);
    if (!inBounds(s)) errors.push(`sólido ${s.id} fuera de bounds`);
    if (!s.note) errors.push(`sólido ${s.id} sin nota de autoría visual`);
  }

  for (const surface of map.surfaces) {
    if (!inBounds(surface)) errors.push(`superficie ${surface.id} fuera de bounds`);
    if (surface.kind === "ramp" && !(finite(surface.xFrom) && finite(surface.xTo) && surface.xFrom !== surface.xTo)) {
      errors.push(`rampa ${surface.id} mal definida`);
    }
    if (surface.kind === "flat" && !finite(surface.y)) errors.push(`superficie ${surface.id} sin altura`);
  }

  for (const poi of map.interactables) {
    if (!finite(poi.x) || !finite(poi.z) || !(poi.radius > 0)) errors.push(`POI ${poi.id} inválido`);
    if (!poi.verb || !poi.label) errors.push(`POI ${poi.id} sin verbo o etiqueta`);
  }

  const triggers = new Set(map.quest.steps.map((s) => s.trigger));
  for (const trigger of triggers) {
    if (!map.interactables.some((p) => p.id === trigger)) {
      errors.push(`la misión referencia un trigger inexistente: ${trigger}`);
    }
  }

  if (blockedAt(map, map.spawn.x, map.spawn.z, 0, 0.4)) errors.push("el spawn está dentro de un sólido");
  for (const poi of map.interactables) {
    if (blockedAt(map, poi.x, poi.z, poi.feetY ?? 0, 0.35)) errors.push(`el POI ${poi.id} está dentro de un sólido`);
  }

  for (const family of map.propFamilies) {
    if (!Array.isArray(family.instances) || family.instances.length === 0) {
      errors.push(`familia de props ${family.id} sin instancias`);
    }
    for (const inst of family.instances) {
      if (inst.length < 4) { errors.push(`familia ${family.id}: instancia incompleta`); break; }
      if (!finite(inst[0]) || !finite(inst[1]) || !finite(inst[2]) || !finite(inst[3])) {
        errors.push(`familia ${family.id}: instancia no finita`); break;
      }
      if (!inBounds({ minX: inst[0], maxX: inst[0], minZ: inst[1], maxZ: inst[1] })) {
        errors.push(`familia ${family.id}: instancia fuera de bounds en (${inst[0]}, ${inst[1]})`); break;
      }
    }
  }

  const planned = plannedDrawCalls(map);
  if (planned > 90) errors.push(`presupuesto de draw calls excedido: ${planned} > 90`);

  return { ok: errors.length === 0, errors };
}

/** Draw calls planificados (pase principal) según el contrato del mapa. */
export function plannedDrawCalls(map = PLAZOLETA_MAP) {
  const sum = (value) => (typeof value === "number" ? value : Object.values(value).reduce((a, b) => a + b, 0));
  return sum(map.drawBudget.statics) + sum(map.drawBudget.instanced) + sum(map.drawBudget.characters);
}

/** Draw calls planificados incluyendo el pase de sombra. */
export function plannedDrawCallsWithShadows(map = PLAZOLETA_MAP) {
  return plannedDrawCalls(map) + map.drawBudget.shadowCasters;
}
