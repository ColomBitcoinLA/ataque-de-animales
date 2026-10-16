/**
 * camera-solver.mjs — Solucionador PURO de cámara en tercera persona (M2 / Cali Viva).
 *
 * Sin three.js, sin DOM: recibe estado (posición/objetivo), intención de cámara
 * (yaw/pitch/distancia) y los volúmenes sólidos de cámara del mapa; devuelve la
 * pose resuelta. Al ser puro, se prueba en Node (tests/unit/plazoleta-camera.test.cjs)
 * y el adaptador de render sólo copia el resultado a la PerspectiveCamera.
 *
 * Comportamientos garantizados:
 *   - brazo (spring arm) que se acorta ante oclusión y se alarga con calma (histéresis)
 *   - nunca atraviesa un sólido de cámara (la pose final se valida y se recorta)
 *   - pitch y distancia acotados; yaw libre
 *   - suavizado independiente del frame rate: 1 - exp(-k·dt)
 */

export const CAMERA_LIMITS = Object.freeze({
  pitchMin: -0.14,
  pitchMax: 0.58,
  distanceMin: 3.2,
  distanceMax: 10.5,
  eyeHeightOffset: 0.95,
  targetHeightOffset: 0.9,
  minBoom: 1.6,
  skin: 0.28,
  shortenRate: 26,
  lengthenRate: 3.4,
  positionSmoothing: 9,
  targetSmoothing: 12,
  fovBase: 55,
  fovRun: 61,
});

/** Distancia mínima absoluta: por debajo de esto la cámara colapsa contra el objetivo. */
export const COLLAPSE_MIN = 0.18;

/** Suavizado exponencial independiente del frame rate. */
export function smooth(current, target, rate, dt) {
  const alpha = 1 - Math.exp(-rate * Math.max(0, dt));
  return current + (target - current) * alpha;
}

/**
 * Intersección rayo-AABB (slab method). Devuelve la distancia t >= 0 del primer
 * impacto, o Infinity si no hay intersección. Los sólidos son cajas axis-aligned.
 * @returns {number}
 */
export function rayAabbDistance(originX, originY, originZ, dirX, dirY, dirZ, box) {
  let tMin = 0;
  let tMax = Infinity;
  // La banda vertical del mapa usa yMin/yMax; las cajas estilo three usan minY/maxY.
  const minY = box.yMin !== undefined ? box.yMin : box.minY;
  const maxY = box.yMax !== undefined ? box.yMax : box.maxY;
  const axes = [
    [originX, dirX, box.minX, box.maxX],
    [originY, dirY, minY, maxY],
    [originZ, dirZ, box.minZ, box.maxZ],
  ];
  for (const [origin, dir, min, max] of axes) {
    if (Math.abs(dir) < 1e-9) {
      if (origin < min || origin > max) return Infinity;
      continue;
    }
    let t1 = (min - origin) / dir;
    let t2 = (max - origin) / dir;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return Infinity;
  }
  return tMin;
}

/** Distancia libre del brazo contra la lista de sólidos de cámara. */
export function freeBoomDistance(origin, direction, desired, solids, skin = CAMERA_LIMITS.skin) {
  let best = Infinity;
  for (const box of solids) {
    const t = rayAabbDistance(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, box);
    if (t < best) best = t;
  }
  // Sin obstáculo, el brazo llega a la distancia pedida (el `skin` sólo separa del muro).
  if (best === Infinity || best >= desired) return desired;
  return Math.max(CAMERA_LIMITS.minBoom, best - skin);
}

/** ¿El punto está dentro de algún sólido de cámara? (acepta yMin/maxY y minY/maxY) */
export function pointInsideSolids(point, solids) {
  for (const box of solids) {
    const minY = box.yMin !== undefined ? box.yMin : box.minY;
    const maxY = box.yMax !== undefined ? box.yMax : box.maxY;
    if (
      point.x > box.minX && point.x < box.maxX &&
      point.y > minY && point.y < maxY &&
      point.z > box.minZ && point.z < box.maxZ
    ) return true;
  }
  return false;
}

export function createCameraState({ yaw = Math.PI, pitch = 0.2, distance = 6.4 } = {}) {
  return {
    yaw,
    pitch,
    distance,
    boom: distance,
    position: { x: 0, y: 3, z: 6 },
    target: { x: 0, y: 1, z: 0 },
    initialized: false,
    occluded: false,
    fov: CAMERA_LIMITS.fovBase,
  };
}

/**
 * Resuelve la pose de cámara para este frame.
 * @param {object} state estado de cámara (se muta; cero asignaciones)
 * @param {object} params
 * @param {{x:number,y:number,z:number}} params.subject posición de los pies del protagonista
 * @param {number} params.subjectSpeed velocidad horizontal (para FOV y adelanto)
 * @param {number} params.subjectHeading rumbo del protagonista
 * @param {Array} params.cameraSolids sólidos con banda vertical
 * @param {number} params.dt
 * @param {{x:number,y:number,z:number}} params.outPosition destino (reutilizado)
 * @param {{x:number,y:number,z:number}} params.outTarget destino (reutilizado)
 */
export function solveCamera(state, { subject, subjectSpeed, cameraSolids, dt, outPosition, outTarget }) {
  const lim = CAMERA_LIMITS;
  state.pitch = Math.min(lim.pitchMax, Math.max(lim.pitchMin, state.pitch));
  state.distance = Math.min(lim.distanceMax, Math.max(lim.distanceMin, state.distance));

  const targetX = subject.x;
  const targetY = subject.y + lim.targetHeightOffset;
  const targetZ = subject.z;

  const cosPitch = Math.cos(state.pitch);
  const dirX = Math.sin(state.yaw) * cosPitch;
  const dirY = Math.sin(state.pitch);
  const dirZ = Math.cos(state.yaw) * cosPitch;

  const originX = targetX;
  const originY = targetY + lim.eyeHeightOffset;
  const originZ = targetZ;

  const free = freeBoomDistance(
    { x: originX, y: originY, z: originZ },
    { x: dirX, y: dirY, z: dirZ },
    state.distance,
    cameraSolids
  );
  state.occluded = free < state.distance - 1e-3;

  // Acortar rápido, alargar despacio (regla clásica anti-bombeo).
  if (free < state.boom) {
    state.boom = free;
  } else {
    const t = 1 - Math.exp(-lim.lengthenRate * Math.max(0, dt));
    state.boom = state.boom + (free - state.boom) * t;
  }

  let camX = originX + dirX * state.boom;
  let camY = originY + dirY * state.boom;
  let camZ = originZ + dirZ * state.boom;
  if (camY < 0.35) camY = 0.35;

  // Garantía dura: la pose final no puede quedar dentro de un sólido de cámara.
  // Si el brazo mínimo todavía queda dentro, colapsa hacia el objetivo (cámara pegada
  // a la espalda) antes que atravesar geometría.
  if (pointInsideSolids({ x: camX, y: camY, z: camZ }, cameraSolids)) {
    let step = state.boom;
    let guard = 0;
    while (step > COLLAPSE_MIN && guard < 32) {
      step *= 0.7;
      guard++;
      const probeY = Math.max(0.35, originY + dirY * step);
      if (!pointInsideSolids({ x: originX + dirX * step, y: probeY, z: originZ + dirZ * step }, cameraSolids)) break;
    }
    state.boom = Math.max(COLLAPSE_MIN, step);
    camX = originX + dirX * state.boom;
    camY = Math.max(0.35, originY + dirY * state.boom);
    camZ = originZ + dirZ * state.boom;
  }

  if (!state.initialized) {
    state.position.x = camX;
    state.position.y = camY;
    state.position.z = camZ;
    state.target.x = targetX;
    state.target.y = targetY;
    state.target.z = targetZ;
    state.initialized = true;
  } else {
    state.position.x = smooth(state.position.x, camX, lim.positionSmoothing, dt);
    state.position.y = smooth(state.position.y, camY, lim.positionSmoothing, dt);
    state.position.z = smooth(state.position.z, camZ, lim.positionSmoothing, dt);
    state.target.x = smooth(state.target.x, targetX, lim.targetSmoothing, dt);
    state.target.y = smooth(state.target.y, targetY, lim.targetSmoothing, dt);
    state.target.z = smooth(state.target.z, targetZ, lim.targetSmoothing, dt);
  }

  const fovTarget = subjectSpeed > 4.2 ? lim.fovRun : lim.fovBase;
  state.fov = smooth(state.fov, fovTarget, 3.2, dt);

  if (outPosition) {
    outPosition.x = state.position.x;
    outPosition.y = state.position.y;
    outPosition.z = state.position.z;
  }
  if (outTarget) {
    outTarget.x = state.target.x;
    outTarget.y = state.target.y;
    outTarget.z = state.target.z;
  }
  return state;
}

/** Zoom por rueda/pinch, con signo hacia "acercar" y acotado. */
export function adjustZoom(state, delta) {
  state.distance = Math.min(CAMERA_LIMITS.distanceMax, Math.max(CAMERA_LIMITS.distanceMin, state.distance + delta));
  return state.distance;
}

/** Rotación por arrastre (dx, dy en píxeles). */
export function applyLook(state, dxPixels, dyPixels, sensitivity = 0.0042) {
  state.yaw -= dxPixels * sensitivity;
  state.pitch = Math.min(CAMERA_LIMITS.pitchMax, Math.max(CAMERA_LIMITS.pitchMin, state.pitch + dyPixels * sensitivity));
  return state;
}
