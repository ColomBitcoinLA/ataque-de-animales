/** Pure client-side prototype geometry. Server world authority is planned for M2/M3. */
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

export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function canOccupy(x, z, solids = SOLID_OBJECTS, radius = PLAYER_RADIUS) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) return false;
  if (Math.abs(x) + radius > WORLD_LIMIT || Math.abs(z) + radius > WORLD_LIMIT) return false;
  return !solids.some(s => x + radius > s.minX && x - radius < s.maxX && z + radius > s.minZ && z - radius < s.maxZ);
}
export function advance(position, direction, speed, dt, solids = SOLID_OBJECTS) {
  if (!Number.isFinite(dt) || dt < 0 || dt > 0.1) throw new RangeError('Invalid frame delta');
  if (!Number.isFinite(speed) || speed < 0) throw new RangeError('Invalid movement speed');
  const dx = Number(direction.x), dz = Number(direction.z);
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) throw new TypeError('Invalid movement vector');
  const magnitude = Math.hypot(dx,dz);
  if (!magnitude || !dt) return { x: position.x, z: position.z };
  const stepX = dx / magnitude * speed * dt;
  const stepZ = dz / magnitude * speed * dt;
  let x = position.x, z = position.z;
  if (canOccupy(x + stepX, z, solids)) x += stepX;
  if (canOccupy(x, z + stepZ, solids)) z += stepZ;
  return { x, z };
}
export function closestInteraction(position, locations = LANDMARKS, threshold = 3.2) {
  return locations.reduce((nearest, candidate) => {
    const distance = Math.hypot(position.x - candidate.x, position.z - candidate.z);
    return distance <= threshold && (!nearest || distance < nearest.distance)
      ? { ...candidate, distance } : nearest;
  }, null);
}
