/**
 * Cali Viva · Plazoleta del Río — layout puro de la escena benchmark (20 m x 20 m).
 *
 * Sin DOM, sin Three.js, sin red: se puede probar en Node.
 * Unidades en metros. +X = este, -Z = norte (hacia el río). Y = arriba.
 *
 * IMPORTANTE: es una ESTILIZACIÓN inspirada en el Bulevar del Río, el Puente Ortiz
 * y La Ermita de Cali. No es una reconstrucción geográfica ni a escala.
 *
 * La autoridad del mundo (servidor) está fuera del alcance de este POC; estas
 * colisiones son de presentación local y reutilizan world-core.advance().
 */

export const PLAZA = Object.freeze({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 });

/** heading 0 = mirando hacia +Z; Math.PI = mirando al norte (río). */
export const SPAWN = Object.freeze({ x: 0, z: 6, heading: Math.PI });

export const RIVER = Object.freeze({
  minX: -40, maxX: 40,
  bankZ: -6.2,        // muro del malecón (orilla sur)
  farBankZ: -12.6,    // orilla norte (fuera del área jugable)
  waterY: -1.05,
  bedY: -1.7,
});

/** Segmento de puente inspirado en el Puente Ortiz: arco de ladrillo con balaustrada. */
export const BRIDGE = Object.freeze({
  minX: 1.4,
  maxX: 4.6,
  startZ: -5.95,
  endZ: -12.45,
  rise: 0.62,
  railWidth: 0.3,
});

export const FACADE = Object.freeze({ frontX: 7, backX: 10.6, minZ: -4.2, maxZ: 9.4, height: 7.4 });
export const SAMAN = Object.freeze({ x: -4.6, z: 2.2, planterHalf: 1.6 });
export const FRUIT_CART = Object.freeze({ x: -7.4, z: 7.2 });
export const LUCIA = Object.freeze({ x: 0.4, z: -4.75, heading: Math.PI });
export const MIRADOR = Object.freeze({ x: 3, z: -9.0, radius: 1.3 });

export const LAMPS = Object.freeze([
  Object.freeze({ x: -6.2, z: -5.55 }),
  Object.freeze({ x: -1.8, z: -5.55 }),
  Object.freeze({ x: 5.8, z: -5.55 }),
]);

export const BENCHES = Object.freeze([
  Object.freeze({ x: -0.4, z: 3.3, rotation: Math.PI / 2 }),
  Object.freeze({ x: 4.4, z: 4.6, rotation: -Math.PI / 2 }),
]);

const box = (minX, maxX, minZ, maxZ) => Object.freeze({ minX, maxX, minZ, maxZ });
const around = (x, z, hx, hz = hx) => box(x - hx, x + hx, z - hz, z + hz);

/** Obstáculos 2D (AABB XZ) compatibles con world-core.canOccupy/advance. */
export const SOLIDS = Object.freeze([
  // Límites del benchmark (setos y muros bajos visibles en escena)
  box(-11, PLAZA.minX, -11, 11),
  box(PLAZA.maxX, 11, -11, 11),
  box(-11, 11, PLAZA.maxZ, 11),
  box(-11, 11, -11, PLAZA.minZ),
  // Río + balaustrada del malecón, dejando libre el corredor del puente
  box(PLAZA.minX, BRIDGE.minX + BRIDGE.railWidth, PLAZA.minZ, BRIDGE.startZ),
  box(BRIDGE.maxX - BRIDGE.railWidth, PLAZA.maxX, PLAZA.minZ, BRIDGE.startZ),
  // Fachada colonial-republicana
  box(FACADE.frontX, FACADE.backX, FACADE.minZ, FACADE.maxZ),
  // Jardinera del samán
  around(SAMAN.x, SAMAN.z, SAMAN.planterHalf),
  // Carreta de frutas
  around(FRUIT_CART.x, FRUIT_CART.z, 1.0, 0.7),
  // Lucía (no se atraviesa)
  around(LUCIA.x, LUCIA.z, 0.35),
  // Faroles
  ...LAMPS.map((l) => around(l.x, l.z, 0.18)),
  // Bancas
  ...BENCHES.map((b) => (Math.abs(Math.sin(b.rotation)) > 0.5 ? around(b.x, b.z, 0.35, 0.95) : around(b.x, b.z, 0.95, 0.35))),
]);

/** Cajas 3D para evitar que la cámara atraviese geometría alta. */
export const CAMERA_OBSTACLES = Object.freeze([
  Object.freeze({ minX: FACADE.frontX, maxX: FACADE.backX, minY: 0, maxY: FACADE.height, minZ: FACADE.minZ, maxZ: FACADE.maxZ }),
  Object.freeze({ minX: FACADE.frontX - 0.85, maxX: FACADE.backX, minY: FACADE.height - 1.1, maxY: FACADE.height + 1.3, minZ: FACADE.minZ - 0.6, maxZ: FACADE.maxZ + 0.6 }),
  Object.freeze({ minX: FACADE.frontX - 0.9, maxX: FACADE.frontX, minY: 3.1, maxY: 4.5, minZ: FACADE.minZ + 0.6, maxZ: FACADE.maxZ - 0.6 }),
  Object.freeze({ minX: SAMAN.x - 0.45, maxX: SAMAN.x + 0.45, minY: 0, maxY: 4.2, minZ: SAMAN.z - 0.45, maxZ: SAMAN.z + 0.45 }),
  Object.freeze({ minX: SAMAN.x - 3.6, maxX: SAMAN.x + 3.6, minY: 4.9, maxY: 7.2, minZ: SAMAN.z - 3.6, maxZ: SAMAN.z + 3.6 }),
]);

/** Puntos de interacción compatibles con world-core.closestInteraction. */
export const INTERACTIONS = Object.freeze([
  Object.freeze({ id: 'lucia', x: LUCIA.x, z: LUCIA.z, label: 'Hablar con Lucía', kind: 'npc', height: 2.05 }),
  Object.freeze({ id: 'fruit-cart', x: FRUIT_CART.x, z: FRUIT_CART.z, label: 'Mirar la carreta de frutas', kind: 'place', height: 1.9 }),
  Object.freeze({ id: 'saman', x: SAMAN.x + 1.9, z: SAMAN.z + 1.2, label: 'Observar el samán', kind: 'place', height: 1.4 }),
]);

export const INTERACTION_RADIUS = 2.7;

/** Altura del suelo caminable: el tablero del puente forma una joroba suave. */
export function groundHeight(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  if (x >= BRIDGE.minX && x <= BRIDGE.maxX && z < BRIDGE.startZ && z > BRIDGE.endZ) {
    const t = (BRIDGE.startZ - z) / (BRIDGE.startZ - BRIDGE.endZ);
    return BRIDGE.rise * Math.sin(Math.PI * t);
  }
  return 0;
}

export function isInsideMirador(x, z) {
  return Math.hypot(x - MIRADOR.x, z - MIRADOR.z) <= MIRADOR.radius;
}
