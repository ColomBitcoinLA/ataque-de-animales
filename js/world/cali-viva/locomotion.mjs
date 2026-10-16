/**
 * Cali Viva — locomoción pura de la mascota (sin Three.js).
 * Aceleración, giro con tasa máxima, clasificación de marcha y entrada relativa a cámara.
 * Las velocidades son ajustes de PRESENTACIÓN del POC (m/s); no reemplazan
 * SpeciesDefinition.movementProfile (unidades legacy en px/s).
 */

export const GAIT = Object.freeze({ IDLE: 'idle', WALK: 'walk', RUN: 'run', TURN: 'turn' });

export const LOCOMOTION_TUNING = Object.freeze({
  walkSpeed: 2.6,
  runSpeed: 5.6,
  accel: 12,
  decel: 16,
  turnRate: 9,
  turnInPlaceThreshold: 2.2,
  idleSpeed: 0.15,
});

const TAU = Math.PI * 2;

export function wrapAngle(angle) {
  let a = (angle + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function shortestAngle(from, to) {
  return wrapAngle(to - from);
}

export function stepHeading(current, target, maxRate, dt) {
  const delta = shortestAngle(current, target);
  const max = maxRate * dt;
  return wrapAngle(current + Math.max(-max, Math.min(max, delta)));
}

export function approach(current, target, rate, dt) {
  const step = rate * dt;
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

/**
 * Convierte entrada local (ix: derecha +1, iz: adelante +1) en dirección mundial
 * para una cámara cuya posición está en (sin yaw, cos yaw) respecto al objetivo.
 */
export function cameraRelativeInput(ix, iz, yaw) {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return { x: rx * ix + fx * iz, z: rz * ix + fz * iz };
}

export function classifyGait(speed, angularVelocity, tuning = LOCOMOTION_TUNING) {
  if (speed < tuning.idleSpeed) {
    return Math.abs(angularVelocity) > tuning.turnInPlaceThreshold ? GAIT.TURN : GAIT.IDLE;
  }
  return speed > (tuning.walkSpeed + tuning.runSpeed) / 2 ? GAIT.RUN : GAIT.WALK;
}

export function createLocomotionState(heading = 0) {
  return Object.freeze({ heading: wrapAngle(heading), speed: 0, angularVelocity: 0, gait: GAIT.IDLE, stride: 0, moveX: 0, moveZ: 0 });
}

/**
 * Avanza el estado de locomoción. La colisión NO se resuelve aquí:
 * el llamador aplica world-core.advance() con (moveX, moveZ, speed).
 */
export function updateLocomotion(state, input, dt, tuning = LOCOMOTION_TUNING) {
  if (!Number.isFinite(dt) || dt < 0 || dt > 0.1) throw new RangeError('Invalid frame delta');
  const dirX = Number(input?.dirX) || 0;
  const dirZ = Number(input?.dirZ) || 0;
  const magnitude = Math.hypot(dirX, dirZ);
  const wants = magnitude > 1e-6;
  const targetSpeed = wants ? (input.run ? tuning.runSpeed : tuning.walkSpeed) : 0;
  const speed = approach(state.speed, targetSpeed, targetSpeed > state.speed ? tuning.accel : tuning.decel, dt);
  const heading = wants ? stepHeading(state.heading, Math.atan2(dirX, dirZ), tuning.turnRate, dt) : state.heading;
  const angularVelocity = dt > 0 ? shortestAngle(state.heading, heading) / dt : 0;
  const mx = wants ? dirX / magnitude : Math.sin(heading);
  const mz = wants ? dirZ / magnitude : Math.cos(heading);
  return Object.freeze({
    heading,
    speed,
    angularVelocity,
    gait: classifyGait(speed, angularVelocity, tuning),
    stride: state.stride + speed * dt,
    moveX: mx * speed,
    moveZ: mz * speed,
  });
}
