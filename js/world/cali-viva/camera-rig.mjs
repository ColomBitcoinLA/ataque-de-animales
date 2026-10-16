/**
 * Cali Viva — matemática pura de cámara en tercera persona (sin Three.js).
 * Órbita yaw/pitch/zoom, intersección rayo-AABB (slab) y resolución de oclusión.
 */

export const CAMERA_LIMITS = Object.freeze({
  minPitch: -0.08,
  maxPitch: 1.1,
  minDistance: 2.2,
  maxDistance: 9,
  defaultDistance: 5.4,
  defaultPitch: 0.3,
  collisionRadius: 0.3,
  groundClearance: 0.35,
});

const TAU = Math.PI * 2;

export function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapYaw(yaw) {
  let a = yaw % TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

export function createOrbit({ yaw = 0, pitch = CAMERA_LIMITS.defaultPitch, distance = CAMERA_LIMITS.defaultDistance } = {}, limits = CAMERA_LIMITS) {
  if (![yaw, pitch, distance].every(Number.isFinite)) throw new TypeError('Orbit values must be finite numbers');
  return Object.freeze({
    yaw: wrapYaw(yaw),
    pitch: clampNumber(pitch, limits.minPitch, limits.maxPitch),
    distance: clampNumber(distance, limits.minDistance, limits.maxDistance),
  });
}

/** Aplica deltas de entrada respetando límites de confort. Devuelve una órbita nueva. */
export function applyOrbitInput(orbit, { dYaw = 0, dPitch = 0, dZoom = 0 } = {}, limits = CAMERA_LIMITS) {
  const safe = (v) => (Number.isFinite(v) ? v : 0);
  return createOrbit({
    yaw: orbit.yaw + safe(dYaw),
    pitch: orbit.pitch + safe(dPitch),
    distance: orbit.distance * Math.exp(safe(dZoom)),
  }, limits);
}

/** Dirección unitaria desde el objetivo hacia la cámara. */
export function orbitDirection(orbit) {
  const cp = Math.cos(orbit.pitch);
  return { x: Math.sin(orbit.yaw) * cp, y: Math.sin(orbit.pitch), z: Math.cos(orbit.yaw) * cp };
}

/**
 * Distancia a lo largo del rayo (origen + dir * t) hasta la caja, o Infinity.
 * Si el origen está dentro de la caja devuelve Infinity (se ignora: el objetivo no puede ocluirse a sí mismo).
 */
export function rayAabbDistance(origin, dir, b) {
  let tMin = 0;
  let tMax = Infinity;
  for (const [o, d, lo, hi] of [
    [origin.x, dir.x, b.minX, b.maxX],
    [origin.y, dir.y, b.minY, b.maxY],
    [origin.z, dir.z, b.minZ, b.maxZ],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  if (tMin <= 0) return Infinity; // origen dentro de la caja
  return tMin;
}

function inflate(b, r) {
  return { minX: b.minX - r, maxX: b.maxX + r, minY: b.minY - r, maxY: b.maxY + r, minZ: b.minZ - r, maxZ: b.maxZ + r };
}

/**
 * Distancia máxima segura para la cámara: aproxima un sphere-cast inflando cada caja
 * con el radio de colisión (suma de Minkowski) y lanzando un rayo.
 */
export function resolveCameraDistance(target, dir, desiredDistance, obstacles, limits = CAMERA_LIMITS) {
  let best = desiredDistance;
  for (const obstacle of obstacles) {
    const t = rayAabbDistance(target, dir, inflate(obstacle, limits.collisionRadius));
    if (t < best) best = t;
  }
  return clampNumber(best, 0.6, desiredDistance);
}

/** Factor de suavizado independiente del framerate. */
export function dampFactor(lambda, dt) {
  if (!Number.isFinite(lambda) || !Number.isFinite(dt) || lambda <= 0 || dt <= 0) return 0;
  return 1 - Math.exp(-lambda * dt);
}

/**
 * Acercamiento instantáneo cuando hay oclusión (evita ver a través de muros),
 * retorno amortiguado cuando el obstáculo desaparece (evita saltos bruscos).
 */
export function smoothCameraDistance(current, target, dt, returnLambda = 5) {
  if (target < current) return target;
  return current + (target - current) * dampFactor(returnLambda, dt);
}
