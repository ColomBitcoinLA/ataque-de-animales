/** Pure client-side prototype geometry. Server world authority is planned for M2/M3.
 *
 * M2: la aritmética de movimiento de este módulo se delegó en
 * js/simulation/kinematics.mjs (fuente única compartida con el modo clásico).
 * La semántica observada no cambia: avance por ejes con deslizamiento, bloqueo
 * con radio incluido y rechazo explícito de dt/speed inválidos.
 */
import { advanceDirected, canOccupy as canOccupyShared, clamp as clampShared } from "../simulation/kinematics.mjs";

export const WORLD_LIMIT = 49;
export const PLAYER_RADIUS = 0.72;
export const SPAWN = Object.freeze({ x: -23, z: 6 });

export const LANDMARKS = Object.freeze([
  Object.freeze({ id: 'boulevard', x: -19, z: -16, label: 'Bulevar del Río', kind: 'place' }),
  Object.freeze({ id: 'plazoleta', x: 14, z: -15, label: 'Plazoleta del barrio', kind: 'place' }),
  Object.freeze({ id: 'trainer', x: -11, z: 13, label: 'Lucía · Entrenadora', kind: 'npc' }),
  Object.freeze({ id: 'wild', x: 24, z: 20, label: 'Criatura silvestre', kind: 'wild' }),
]);

export const SOLID_OBJECTS = Object.freeze([
  [-37, -28, 12, 15], [-18, -8, -38, -25], [9, 23, -38, -26],
  [28, 43, -12, 4], [-44, -30, 24, 39], [2, 17, 28, 43],
  [-5, 9, 5, 15], [19, 33, -29, -14],
].map(([minX,maxX,minZ,maxZ]) => Object.freeze({ minX,maxX,minZ,maxZ })));

const WORLD_AREA = Object.freeze({
  minX: -WORLD_LIMIT,
  maxX: WORLD_LIMIT,
  minZ: -WORLD_LIMIT,
  maxZ: WORLD_LIMIT,
});

/** @param {number} value @param {number} min @param {number} max @returns {number} */
export function clamp(value, min, max) {
  return clampShared(value, min, max);
}

export function canOccupy(x, z, solids = SOLID_OBJECTS, radius = PLAYER_RADIUS) {
  return canOccupyShared(x, z, radius, solids, WORLD_LIMIT);
}

export function advance(position, direction, speed, dt, solids = SOLID_OBJECTS) {
  if (!Number.isFinite(dt) || dt < 0 || dt > 0.1) throw new RangeError('Invalid frame delta');
  if (!Number.isFinite(speed) || speed < 0) throw new RangeError('Invalid movement speed');
  const dx = Number(direction?.x), dz = Number(direction?.z);
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) throw new TypeError('Invalid movement vector');
  const result = advanceDirected({
    position: { x: Number(position?.x), z: Number(position?.z) },
    direction: { x: dx, z: dz },
    speed,
    dt,
    solids,
    area: WORLD_AREA,
    radius: PLAYER_RADIUS,
  });
  return { x: result.x, z: result.z };
}

export function closestInteraction(position, locations = LANDMARKS, threshold = 3.2) {
  return locations.reduce((nearest, candidate) => {
    const distance = Math.hypot(position.x - candidate.x, position.z - candidate.z);
    return distance <= threshold && (!nearest || distance < nearest.distance)
      ? { ...candidate, distance } : nearest;
  }, null);
}
