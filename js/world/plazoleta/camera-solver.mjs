/**
 * camera-solver.mjs — Solucionador PURO de cámara en tercera persona (M2 + R1-A).
 *
 * Sin three.js, sin DOM: recibe estado (posición/objetivo), intención de cámara
 * (yaw/pitch/distancia) y los volúmenes sólidos de cámara del mapa; devuelve la
 * pose resuelta. Al ser puro, se prueba en Node (tests/unit/plazoleta-camera.test.cjs)
 * y el adaptador de render sólo copia el resultado a la PerspectiveCamera.
 *
 * Garantías (verificadas por tests):
 *   - brazo (spring arm) que se acorta ante oclusión y se alarga con calma (histéresis)
 *   - tres etapas anti-recorte: quitar hombro → colapsar brazo → mínimo absoluto
 *   - pitch y distancia acotados; yaw libre
 *   - suavizado independiente del frame rate: 1 - exp(-k·dt)
 *
 * R1-A añade:
 *   - zoom suavizado (la rueda mueve un objetivo, no la distancia final)
 *   - recentrado automático tras la cámara cuando el jugador avanza y no toca la cámara
 *   - encuadre con desplazamiento de hombro: la mascota no queda centrada ni tapada
 *   - encuadre de diálogo: mezcla el objetivo de mirada hacia el interlocutor
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
  /* --- R1-A --- */
  /** Suavizado del zoom pedido (rueda/pinza). */
  zoomSmoothing: 7.5,
  /** Tiempo sin tocar la cámara tras el cual puede recentrarse sola (s). */
  recenterDelay: 1.1,
  /** Velocidad de recentrado (rad/s). */
  recenterRate: 1.9,
  /** Zona muerta: no recentra si ya está casi detrás (rad ≈ 14°). */
  recenterDeadzone: 0.24,
  /** Velocidad mínima del sujeto para considerar que "va hacia adelante" (m/s). */
  recenterMinSpeed: 0.8,
  /** Desplazamiento lateral máximo de encuadre (m). */
  shoulderOffset: 0.42,
  /** Brazo por debajo del cual el hombro entra al 100 % (m). */
  shoulderBoom: 3.0,
  /** Peso de la mirada hacia el interlocutor durante un diálogo (0-1). */
  focusBlend: 0.45,
  /** Brazo objetivo durante un diálogo (m). */
  focusBoom: 5.0,
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
    /** Objetivo de zoom: la rueda mueve esto y `distance` lo persigue suavemente. */
    distanceTarget: distance,
    boom: distance,
    position: { x: 0, y: 3, z: 6 },
    target: { x: 0, y: 1, z: 0 },
    initialized: false,
    occluded: false,
    /** Segundos restantes de "control manual": bloquea el recentrado automático. */
    manualTimer: 0,
    recenterActive: false,
    /** 0-1: cuánto hombro se está aplicando (informativo para tests/HUD). */
    shoulder: 0,
    /** 0-1: cuánto encuadre de diálogo está activo. */
    focus: 0,
    fov: CAMERA_LIMITS.fovBase,
  };
}

/**
 * Resuelve la pose de cámara para este frame.
 * @param {object} state estado de cámara (se muta; cero asignaciones por frame)
 * @param {object} params
 * @param {{x:number,y:number,z:number}} params.subject posición de los pies del protagonista
 * @param {number} [params.subjectSpeed] velocidad horizontal (FOV, recentrado)
 * @param {number|null} [params.subjectHeading] rumbo del protagonista (recentrado)
 * @param {Array} params.cameraSolids sólidos con banda vertical
 * @param {number} params.dt
 * @param {{x:number,y:number,z:number}} params.outPosition destino (reutilizado)
 * @param {{x:number,y:number,z:number}} params.outTarget destino (reutilizado)
 * @param {{x:number,y:number,z:number}|null} [params.focusTarget] interlocutor u objeto de interés
 */
export function solveCamera(state, {
  subject,
  subjectSpeed = 0,
  subjectHeading = null,
  cameraSolids,
  dt,
  outPosition,
  outTarget,
  focusTarget = null,
}) {
  const lim = CAMERA_LIMITS;
  state.pitch = Math.min(lim.pitchMax, Math.max(lim.pitchMin, state.pitch));
  state.distanceTarget = Math.min(lim.distanceMax, Math.max(lim.distanceMin, state.distanceTarget));
  // Zoom suavizado: acercar y alejar se sienten igual de controlados.
  state.distance = smooth(state.distance, state.distanceTarget, lim.zoomSmoothing, dt);

  if (state.manualTimer > 0) state.manualTimer = Math.max(0, state.manualTimer - dt);

  // Encuadre de diálogo: acerca un poco y mezcla la mirada hacia el interlocutor.
  const wantsFocus = focusTarget !== null && focusTarget !== undefined;
  state.focus = smooth(state.focus, wantsFocus ? 1 : 0, 5, dt);

  // Recentrado automático: sólo si el jugador no toca la cámara y avanza hacia adelante.
  state.recenterActive = false;
  if (
    !wantsFocus &&
    state.manualTimer <= 0 &&
    Number.isFinite(subjectHeading) &&
    subjectSpeed > lim.recenterMinSpeed
  ) {
    const behind = subjectHeading + Math.PI;
    let delta = (behind - state.yaw) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta <= -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) > lim.recenterDeadzone) {
      const stepAngle = Math.sign(delta) * Math.min(Math.abs(delta), lim.recenterRate * dt);
      state.yaw += stepAngle;
      state.recenterActive = true;
    }
  }

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

  // Distancia deseada: el zoom del jugador, acortado si hay diálogo.
  const desiredBoom = state.distance + (lim.focusBoom - state.distance) * state.focus;

  const free = freeBoomDistance(
    { x: originX, y: originY, z: originZ },
    { x: dirX, y: dirY, z: dirZ },
    desiredBoom,
    cameraSolids
  );
  state.occluded = free < desiredBoom - 1e-3;

  // Acortar rápido, alargar despacio (regla clásica anti-bombeo).
  if (free < state.boom) {
    state.boom = free;
  } else {
    const t = 1 - Math.exp(-lim.lengthenRate * Math.max(0, dt));
    state.boom = state.boom + (free - state.boom) * t;
  }

  // Encuadre con hombro: cuanto más corto el brazo, más lateral (la mascota no tapa la vista).
  // Durante un diálogo el encuadre vuelve al centro.
  const shoulderWeight = 1 - Math.min(1, state.boom / lim.shoulderBoom);
  const shoulderAmount = lim.shoulderOffset * shoulderWeight * (1 - state.focus);
  state.shoulder = shoulderAmount;
  const rightX = Math.cos(state.yaw);
  const rightZ = -Math.sin(state.yaw);

  let camX = originX + dirX * state.boom + rightX * shoulderAmount;
  let camY = originY + dirY * state.boom;
  let camZ = originZ + dirZ * state.boom + rightZ * shoulderAmount;
  if (camY < 0.35) camY = 0.35;

  // Etapa 1: si el hombro mete la cámara en un muro, se retira el hombro.
  if (shoulderAmount !== 0 && pointInsideSolids({ x: camX, y: camY, z: camZ }, cameraSolids)) {
    state.shoulder = 0;
    camX = originX + dirX * state.boom;
    camY = Math.max(0.35, originY + dirY * state.boom);
    camZ = originZ + dirZ * state.boom;
  }

  // Etapa 2: si aún queda dentro, colapsa el brazo hacia el objetivo (antes que atravesar).
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

  // Mirada: mezcla hacia el interlocutor cuando hay diálogo.
  const focusWeight = lim.focusBlend * state.focus;
  const lookX = wantsFocus ? targetX + (focusTarget.x - targetX) * focusWeight : targetX;
  const lookY = wantsFocus ? targetY + ((focusTarget.y ?? 0) + 0.9 - targetY) * focusWeight : targetY;
  const lookZ = wantsFocus ? targetZ + (focusTarget.z - targetZ) * focusWeight : targetZ;

  if (!state.initialized) {
    state.position.x = camX;
    state.position.y = camY;
    state.position.z = camZ;
    state.target.x = lookX;
    state.target.y = lookY;
    state.target.z = lookZ;
    state.initialized = true;
  } else {
    state.position.x = smooth(state.position.x, camX, lim.positionSmoothing, dt);
    state.position.y = smooth(state.position.y, camY, lim.positionSmoothing, dt);
    state.position.z = smooth(state.position.z, camZ, lim.positionSmoothing, dt);
    state.target.x = smooth(state.target.x, lookX, lim.targetSmoothing, dt);
    state.target.y = smooth(state.target.y, lookY, lim.targetSmoothing, dt);
    state.target.z = smooth(state.target.z, lookZ, lim.targetSmoothing, dt);
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

/**
 * Zoom por rueda/pinza: mueve el OBJETIVO de distancia (el solucionador lo persigue).
 * Los valores se acotan siempre al rango permitido.
 */
export function adjustZoom(state, delta) {
  const lim = CAMERA_LIMITS;
  state.distanceTarget = Math.min(lim.distanceMax, Math.max(lim.distanceMin, state.distanceTarget + delta));
  return state.distanceTarget;
}

/**
 * Rotación por arrastre (dx, dy en píxeles). Marca control manual para que el
 * recentrado automático espere antes de intervenir.
 */
export function applyLook(state, dxPixels, dyPixels, sensitivity = 0.0042) {
  state.yaw -= dxPixels * sensitivity;
  state.pitch = Math.min(CAMERA_LIMITS.pitchMax, Math.max(CAMERA_LIMITS.pitchMin, state.pitch + dyPixels * sensitivity));
  state.manualTimer = CAMERA_LIMITS.recenterDelay;
  return state;
}

/** Recentrado inmediato (útil al reiniciar fase o al abrir un diálogo). */
export function snapBehind(state, heading) {
  state.yaw = heading + Math.PI;
  state.manualTimer = 0;
  return state;
}
