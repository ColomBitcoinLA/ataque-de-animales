/**
 * control-feel.mjs — Mapeo de intención y sensación de control (R1-A).
 *
 * Módulo PURO: sin three, sin DOM, sin red. Es la única fuente de verdad sobre
 * cómo el input del jugador se convierte en movimiento del protagonista:
 *
 *   1. `intentFromInput(raw, cameraYaw)` — movimiento RELATIVO A LA CÁMARA, normalizado.
 *   2. `stepControl(state, intent, dt)` — aceleración, frenada, rampa de carrera y giro
 *      suavizado con velocidad angular limitada.
 *   3. `alignFactor` — mientras la mascota se alinea con la dirección pedida avanza menos:
 *      se elimina el "deslizamiento de lado" al girar 90°/180°.
 *
 * Reglas de diseño (R1-A):
 *   - Arrancar es más lento que frenar (accel < decel) ⇒ respuesta con peso, no instantánea.
 *   - Correr exige mantener Shift: la carrera entra con una rampa corta.
 *   - Girar parado es rápido; girar corriendo es algo más lento pero con tope duro.
 *   - Todo es determinista y sin asignaciones: el estado vive en objetos reutilizados.
 */

export const MOVEMENT = Object.freeze({
  /** Velocidad de paso (m/s). */
  walkSpeed: 2.5,
  /** Velocidad de carrera sostenida (m/s). */
  runSpeed: 5.4,
  /** Aceleración al arrancar (m/s²). */
  accel: 9.0,
  /** Desaceleración al soltar (m/s²). Mayor que `accel`: frenar se siente más firme. */
  decel: 15.0,
  /** Tiempo de rampa para que el trote se convierta en carrera con Shift sostenido (s). */
  sprintRampSeconds: 0.34,
  /** Tiempo de vuelta a trote al soltar Shift (s). */
  sprintReleaseSeconds: 0.22,
  /** Velocidad angular máxima girando casi parado (rad/s). */
  turnRateIdle: 4.6,
  /** Velocidad angular máxima girando a velocidad de carrera (rad/s). */
  turnRateMoving: 3.6,
  /** Aceleración angular: evita que el giro arranque de golpe (rad/s²). */
  turnAccel: 24.0,
  /** Ganancia proporcional del control de rumbo (1/s). */
  turnGain: 7.5,
  /** Fracción mínima de avance mientras la mascota termina de alinearse. */
  alignMin: 0.15,
  /** Por debajo de esta velocidad se considera reposo (m/s). */
  idleSpeed: 0.08,
  /** Fracción de `runSpeed` a partir de la cual la locomoción se clasifica como carrera. */
  runThreshold: 0.62,
});

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

/** Mueve `current` hacia `target` como máximo `maxDelta`. */
export function approach(current, target, maxDelta) {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return target;
}

/** Diferencia angular más corta (rad), en (-π, π]. */
export function shortestAngle(from, to) {
  let delta = (to - from) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta <= -Math.PI) delta += TAU;
  return delta;
}

/** Envuelve un ángulo a (-π, π]. */
export function wrapAngle(angle) {
  let value = angle % TAU;
  if (value > Math.PI) value -= TAU;
  if (value <= -Math.PI) value += TAU;
  return value;
}

/**
 * Estado de control del protagonista (objeto plano reutilizado).
 * @param {{heading?: number, speed?: number}} [options]
 */
export function createControlState({ heading = 0, speed = 0 } = {}) {
  return {
    heading: wrapAngle(heading),
    speed: clamp(speed, 0, MOVEMENT.runSpeed),
    sprint: 0,
    turnVelocity: 0,
    moving: false,
    aligning: false,
    dirX: 0,
    dirZ: 0,
    align: 1,
    /** Velocidad realmente aplicada (ya escalada por la alineación del giro). */
    effectiveSpeed: 0,
    locomotion: "idle",
  };
}

/**
 * Convierte el input en espacio de cámara a dirección de MUNDO normalizada.
 * `forward` positivo = alejarse de la cámara; `strafe` positivo = derecha.
 * Escribe en `out` para no asignar memoria.
 * @param {{forward: number, strafe: number}} raw
 * @param {number} cameraYaw
 * @param {{x: number, z: number}} out
 * @returns {{x: number, z: number, magnitude: number}} el mismo `out` + magnitud
 */
export function intentFromInput(raw, cameraYaw, out = { x: 0, z: 0, magnitude: 0 }) {
  const forward = Number.isFinite(raw?.forward) ? raw.forward : 0;
  const strafe = Number.isFinite(raw?.strafe) ? raw.strafe : 0;
  const yaw = Number.isFinite(cameraYaw) ? cameraYaw : 0;
  // La cámara mira desde `yaw` hacia el sujeto: "avanzar" es -sin/-cos, "derecha" es cos/-sin.
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const x = forwardX * forward + rightX * strafe;
  const z = forwardZ * forward + rightZ * strafe;
  const magnitude = Math.hypot(x, z);
  if (magnitude > 1e-6) {
    out.x = x / magnitude;
    out.z = z / magnitude;
  } else {
    out.x = 0;
    out.z = 0;
  }
  out.magnitude = magnitude;
  return out;
}

/** Clasifica la locomoción a partir de la velocidad (idle | walk | run). */
export function classifyLocomotion(speed) {
  if (speed <= MOVEMENT.idleSpeed) return "idle";
  if (speed >= MOVEMENT.runSpeed * MOVEMENT.runThreshold) return "run";
  return "walk";
}

/**
 * Avanza un paso de control: rampa de carrera, aceleración/frenada y giro suavizado.
 * @param {object} control estado creado por `createControlState`
 * @param {{moveX?: number, moveZ?: number, run?: boolean}} intent dirección de mundo (normalizada o no)
 * @param {number} dt
 * @returns {object} el mismo `control`
 */
export function stepControl(control, intent, dt) {
  if (!control) throw new TypeError("stepControl: falta el estado de control.");
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError("stepControl: dt debe ser finito y >= 0.");
  const step = Math.min(dt, 1 / 30);

  const rawX = Number.isFinite(intent?.moveX) ? intent.moveX : 0;
  const rawZ = Number.isFinite(intent?.moveZ) ? intent.moveZ : 0;
  const magnitude = Math.hypot(rawX, rawZ);
  control.moving = magnitude > 1e-4;

  // 1. Rampa de carrera: mantener Shift la consolida; soltarlo vuelve al trote.
  const sprintRate = intent?.run && control.moving
    ? step / MOVEMENT.sprintRampSeconds
    : -step / MOVEMENT.sprintReleaseSeconds;
  control.sprint = clamp01(control.sprint + sprintRate);

  // 2. Velocidad objetivo y rampa de aceleración/frenada.
  const targetSpeed = control.moving
    ? MOVEMENT.walkSpeed + (MOVEMENT.runSpeed - MOVEMENT.walkSpeed) * control.sprint
    : 0;
  // Al arrancar desde parado se usa la aceleración; al soltar, la frenada (más fuerte).
  const rate = targetSpeed > control.speed ? MOVEMENT.accel : MOVEMENT.decel;
  control.speed = clamp(approach(control.speed, targetSpeed, rate * step), 0, MOVEMENT.runSpeed);

  // 3. Giro suavizado con tope de velocidad angular y aceleración angular.
  if (control.moving) {
    const desiredHeading = Math.atan2(rawX / magnitude, rawZ / magnitude);
    control.dirX = rawX / magnitude;
    control.dirZ = rawZ / magnitude;
    const delta = shortestAngle(control.heading, desiredHeading);
    const speedRatio = clamp01(control.speed / MOVEMENT.runSpeed);
    const turnCap = MOVEMENT.turnRateIdle + (MOVEMENT.turnRateMoving - MOVEMENT.turnRateIdle) * speedRatio;
    const desiredRate = clamp(delta * MOVEMENT.turnGain, -turnCap, turnCap);
    control.turnVelocity = approach(control.turnVelocity, desiredRate, MOVEMENT.turnAccel * step);
    control.heading = wrapAngle(control.heading + control.turnVelocity * step);
    // Avance escalado por alineación: nada de desplazarse de lado mientras gira.
    const alignment = Math.cos(shortestAngle(control.heading, desiredHeading));
    control.align = clamp(alignment, MOVEMENT.alignMin, 1);
    control.aligning = control.align < 0.92;
  } else {
    control.turnVelocity = approach(control.turnVelocity, 0, MOVEMENT.turnAccel * step);
    control.aligning = false;
    control.align = 1;
  }

  control.effectiveSpeed = control.speed * control.align;
  control.locomotion = classifyLocomotion(control.speed);
  return control;
}
