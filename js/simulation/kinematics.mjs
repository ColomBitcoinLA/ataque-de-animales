/**
 * kinematics.mjs — Primitivas cinemáticas compartidas (M2 / Cali Viva POC).
 *
 * Módulo puro: sin three.js, sin DOM, sin red, sin estado global.
 * Fuente única de verdad para:
 *   - la fórmula de integración           (pos + vel * speed * dt)
 *   - el recorte a límites de mapa        (clásico: [0, mapW - entW])
 *   - la prueba de ocupación AABB+radio   (mundo: disco contra cajas)
 *   - la resolución por ejes (slide)      (mundo: deslizar en lugar de atravesar)
 *
 * Consumidores:
 *   - js/simulation/MovementSystem.mjs   (clásico 2D x/y en píxeles)
 *   - js/world/world-core.mjs            (prototipo v0, x/z en metros)
 *   - js/world/plazoleta/world-sim.mjs   (POC Cali Viva, x/z en metros)
 *
 * Regla: ninguna de esas capas vuelve a escribir la aritmética de movimiento.
 * tests/unit/kinematics.test.cjs compara la salida de cada consumidor contra
 * estas primitivas para el mismo input (paridad cruzada clásico ↔ mundo).
 *
 * Semántica de frontera (idéntica al legacy caracterizado en M1):
 *   el avance se BLOQUEA por eje, no se recorta. Si el paso de un eje es inválido,
 *   ese eje no se mueve y el otro continúa (deslizamiento). No hay clamp final
 *   silencioso: la posición inicial nunca se corrige sin que el llamador lo pida.
 */

/** @param {unknown} value @returns {boolean} */
export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function assertPoint(point, name, fields) {
  if (!point || typeof point !== "object") {
    throw new TypeError(`kinematics: ${name} debe ser un objeto.`);
  }
  for (const field of fields) {
    if (!isFiniteNumber(point[field])) {
      throw new TypeError(`kinematics: ${name}.${field} debe ser un número finito.`);
    }
  }
  return point;
}

function assertScalar(value, name, { min = null, max = null } = {}) {
  if (!isFiniteNumber(value)) {
    throw new TypeError(`kinematics: ${name} debe ser un número finito.`);
  }
  if (min !== null && value < min) {
    throw new RangeError(`kinematics: ${name} debe ser >= ${min}.`);
  }
  if (max !== null && value > max) {
    throw new RangeError(`kinematics: ${name} debe ser <= ${max}.`);
  }
  return value;
}

/**
 * Integración clásica: respeta el vector de velocidad tal cual (sin normalizar),
 * porque en el modo clásico la normalización diagonal la hace la capa de input.
 * @param {{x:number,y:number}} position
 * @param {{x:number,y:number}} velocity
 * @param {number} speed
 * @param {number} dt
 * @returns {{x:number,y:number}}
 */
export function integrateVelocity(position, velocity, speed, dt) {
  assertPoint(position, "position", ["x", "y"]);
  assertPoint(velocity, "velocity", ["x", "y"]);
  assertScalar(speed, "speed", { min: 0 });
  assertScalar(dt, "dt", { min: 0 });
  return {
    x: position.x + velocity.x * speed * dt,
    y: position.y + velocity.y * speed * dt,
  };
}

/**
 * Integración dirigida (mundo x/z): normaliza la dirección antes de aplicar la velocidad.
 * Misma fórmula que la clásica; lo único que cambia es quién normaliza.
 * @param {{x:number,z:number}} position
 * @param {{x:number,z:number}} direction
 * @param {number} speed
 * @param {number} dt
 * @returns {{x:number,z:number}}
 */
export function integrateDirected(position, direction, speed, dt) {
  assertPoint(position, "position", ["x", "z"]);
  assertPoint(direction, "direction", ["x", "z"]);
  assertScalar(speed, "speed", { min: 0 });
  assertScalar(dt, "dt", { min: 0 });
  const magnitude = Math.hypot(direction.x, direction.z);
  if (magnitude === 0 || dt === 0) {
    return { x: position.x, z: position.z };
  }
  const scale = (speed * dt) / magnitude;
  return { x: position.x + direction.x * scale, z: position.z + direction.z * scale };
}

/**
 * Recorte clásico: [0, mapW - entityW] / [0, mapH - entityH].
 * Equivale exactamente a Math.max(0, Math.min(mapW - entityW, value)).
 * @param {{x:number,y:number}} point
 * @param {{mapW:number,mapH:number,entityW:number,entityH:number}} bounds
 * @returns {{x:number,y:number}}
 */
export function clampToMapDimensions(point, { mapW, mapH, entityW, entityH }) {
  assertPoint(point, "point", ["x", "y"]);
  assertScalar(mapW, "mapW", { min: 0 });
  assertScalar(mapH, "mapH", { min: 0 });
  assertScalar(entityW, "entityW", { min: 0 });
  assertScalar(entityH, "entityH", { min: 0 });
  const maxX = Math.max(0, mapW - entityW);
  const maxY = Math.max(0, mapH - entityH);
  return {
    x: Math.max(0, Math.min(maxX, point.x)),
    y: Math.max(0, Math.min(maxY, point.y)),
  };
}

/** @param {number} value @param {number} min @param {number} max @returns {number} */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Recorte explícito de un punto a un área rectangular (el llamador decide cuándo usarlo).
 * @param {{x:number,z:number}} point
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} area
 * @returns {{x:number,z:number}}
 */
export function clampToArea(point, area) {
  assertPoint(point, "point", ["x", "z"]);
  if (!area || typeof area !== "object") throw new TypeError("kinematics: area es requerido.");
  for (const field of ["minX", "maxX", "minZ", "maxZ"]) {
    if (!isFiniteNumber(area[field])) {
      throw new TypeError(`kinematics: area.${field} debe ser un número finito.`);
    }
  }
  return { x: clamp(point.x, area.minX, area.maxX), z: clamp(point.z, area.minZ, area.maxZ) };
}

/**
 * Área efectiva para un cuerpo con radio: el centro nunca puede acercarse menos
 * que `radius` al borde, igual que el legacy (que bloqueaba con el radio incluido).
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} area
 * @param {number} radius
 * @returns {{minX:number,maxX:number,minZ:number,maxZ:number}}
 */
export function shrinkAreaByRadius(area, radius) {
  assertScalar(radius, "radius", { min: 0 });
  return {
    minX: area.minX + radius,
    maxX: area.maxX - radius,
    minZ: area.minZ + radius,
    maxZ: area.maxZ - radius,
  };
}

/**
 * Ocupación de un disco (centro + radio) contra cajas AABB y, opcionalmente,
 * contra un límite cuadrado (|x| + r <= limit).
 * Test inclusivo en bordes, igual que la semántica caracterizada en M1.
 * @param {number} x @param {number} z @param {number} radius
 * @param {Array<{minX:number,maxX:number,minZ:number,maxZ:number}>} solids
 * @param {number|null} [worldLimit]
 * @returns {boolean}
 */
export function canOccupy(x, z, radius, solids = [], worldLimit = null) {
  if (!isFiniteNumber(x) || !isFiniteNumber(z) || !isFiniteNumber(radius) || radius < 0) return false;
  if (worldLimit !== null && (Math.abs(x) + radius > worldLimit || Math.abs(z) + radius > worldLimit)) {
    return false;
  }
  return !solids.some(
    (s) => x + radius > s.minX && x - radius < s.maxX && z + radius > s.minZ && z - radius < s.maxZ
  );
}

/**
 * Resolución por ejes (slide): intenta X, luego Z, y reporta qué eje quedó bloqueado.
 * @param {{x:number,z:number}} position
 * @param {{x:number,z:number}} step
 * @param {(x:number, z:number) => boolean} isBlocked
 * @returns {{x:number,z:number,blockedX:boolean,blockedZ:boolean}}
 */
export function slideStep(position, step, isBlocked) {
  assertPoint(position, "position", ["x", "z"]);
  assertPoint(step, "step", ["x", "z"]);
  if (typeof isBlocked !== "function") throw new TypeError("kinematics: isBlocked debe ser una función.");
  let x = position.x;
  let z = position.z;
  let blockedX = false;
  let blockedZ = false;
  if (step.x !== 0) {
    if (isBlocked(x + step.x, z)) blockedX = true;
    else x += step.x;
  }
  if (step.z !== 0) {
    if (isBlocked(x, z + step.z)) blockedZ = true;
    else z += step.z;
  }
  return { x, z, blockedX, blockedZ };
}

/**
 * Paso completo de una raíz móvil en el plano x/z, escribiendo en un objeto de salida
 * reutilizable: variante de CERO asignaciones para el bucle de simulación.
 * Semántica idéntica a `advanceDirected` (bloqueo por eje con deslizamiento).
 * @param {{x:number,z:number,blockedX:boolean,blockedZ:boolean,distance:number}} out
 * @param {{x:number,z:number}} position
 * @param {{x:number,z:number}} direction
 * @param {number} speed
 * @param {number} dt
 * @param {Array<{minX:number,maxX:number,minZ:number,maxZ:number}>} solids
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}|null} area
 * @param {number} radius
 * @returns {{x:number,z:number,blockedX:boolean,blockedZ:boolean,distance:number}} out
 */
export function advanceDirectedInto(out, position, direction, speed, dt, solids = [], area = null, radius = 0) {
  assertPoint(position, "position", ["x", "z"]);
  assertPoint(direction, "direction", ["x", "z"]);
  assertScalar(speed, "speed", { min: 0 });
  assertScalar(dt, "dt", { min: 0 });
  assertScalar(radius, "radius", { min: 0 });
  if (!Array.isArray(solids)) throw new TypeError("kinematics: solids debe ser un array.");

  const minX = area ? area.minX + radius : null;
  const maxX = area ? area.maxX - radius : null;
  const minZ = area ? area.minZ + radius : null;
  const maxZ = area ? area.maxZ - radius : null;

  const magnitude = Math.hypot(direction.x, direction.z);
  const stepX = magnitude === 0 ? 0 : (direction.x / magnitude) * speed * dt;
  const stepZ = magnitude === 0 ? 0 : (direction.z / magnitude) * speed * dt;

  let x = position.x;
  let z = position.z;
  out.blockedX = false;
  out.blockedZ = false;

  if (stepX !== 0) {
    const nx = x + stepX;
    const outside = minX !== null && (nx < minX || nx > maxX);
    if (outside || !canOccupy(nx, z, radius, solids, null)) out.blockedX = true;
    else x = nx;
  }
  if (stepZ !== 0) {
    const nz = z + stepZ;
    const outside = minZ !== null && (nz < minZ || nz > maxZ);
    if (outside || !canOccupy(x, nz, radius, solids, null)) out.blockedZ = true;
    else z = nz;
  }

  out.x = x;
  out.z = z;
  out.distance = Math.hypot(x - position.x, z - position.z);
  return out;
}

/**
 * Variante con asignación: útil en tests y en llamadas fuera del bucle caliente.
 * @param {object} params
 * @param {{x:number,z:number}} params.position
 * @param {{x:number,z:number}} params.direction
 * @param {number} params.speed
 * @param {number} params.dt
 * @param {Array<{minX:number,maxX:number,minZ:number,maxZ:number}>} params.solids
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}|null} params.area
 * @param {number} params.radius
 * @returns {{x:number,z:number,blockedX:boolean,blockedZ:boolean,distance:number}}
 */
export function advanceDirected({ position, direction, speed, dt, solids = [], area = null, radius = 0 }) {
  return advanceDirectedInto(
    { x: 0, z: 0, blockedX: false, blockedZ: false, distance: 0 },
    position,
    direction,
    speed,
    dt,
    solids,
    area,
    radius
  );
}
