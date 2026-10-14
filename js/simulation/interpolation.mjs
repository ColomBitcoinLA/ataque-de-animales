/**
 * Interpolation: Ayudante matemático de suavizado visual para red (M1.6).
 * 
 * Clasificación arquitectónica: PRESENTATION / NETWORK SMOOTHING.
 * NO es parte de la verdad autoritativa de simulación ni del dominio.
 * Su propósito exclusivo es suavizar visualmente las posiciones recibidas
 * por la red de entidades remotas hacia targetX / targetY.
 * 
 * Preserva exactamente la fórmula legacy:
 * t = 1 - Math.exp(-lerpFactor * dt)
 * current += (target - current) * t
 */

/**
 * Interpola un valor escalar hacia un objetivo mediante decaimiento exponencial.
 * @param {number} current
 * @param {number} target
 * @param {number} dt
 * @param {number} [lerpFactor=12]
 * @returns {number}
 */
export function interpolateScalar(current, target, dt, lerpFactor = 12) {
  if (typeof current !== "number" || !Number.isFinite(current)) {
    throw new TypeError("interpolateScalar: current debe ser un número finito.");
  }
  if (typeof target !== "number" || !Number.isFinite(target)) {
    throw new TypeError("interpolateScalar: target debe ser un número finito.");
  }
  if (typeof dt !== "number" || !Number.isFinite(dt) || dt < 0) {
    throw new RangeError("interpolateScalar: dt debe ser un número finito no negativo.");
  }
  if (typeof lerpFactor !== "number" || !Number.isFinite(lerpFactor) || lerpFactor <= 0) {
    throw new RangeError("interpolateScalar: lerpFactor debe ser un número positivo (> 0).");
  }

  const t = 1 - Math.exp(-lerpFactor * dt);
  return current + (target - current) * t;
}

/**
 * Interpola un punto 2D hacia un punto objetivo sin mutar ninguna entrada.
 * La capa consumidora decide dónde almacenar el resultado visual.
 * @param {{ x: number, y: number, set?: Function }} currentPosition
 * @param {{ x: number, y: number }} targetPosition
 * @param {number} dt
 * @param {number} [lerpFactor=12]
 * @returns {{ x: number, y: number }}
 */
export function interpolatePosition(currentPosition, targetPosition, dt, lerpFactor = 12) {
  if (!currentPosition || !targetPosition) {
    throw new TypeError("interpolatePosition: currentPosition y targetPosition son requeridos.");
  }
  return {
    x: interpolateScalar(currentPosition.x, targetPosition.x, dt, lerpFactor),
    y: interpolateScalar(currentPosition.y, targetPosition.y, dt, lerpFactor),
  };
}
