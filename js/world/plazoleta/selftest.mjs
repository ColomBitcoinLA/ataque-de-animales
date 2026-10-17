/**
 * selftest.mjs — Autodiagnóstico del POC en el navegador (R1-A).
 *
 * Módulo PURO + un pequeño guion de entrada. Sirve para verificar, dentro del bucle
 * real del navegador (no sólo en tests de Node), que la cadena
 *   input → intención relativa a la cámara → simulación → cámara
 * está cableada y se comporta como se espera.
 *
 * Uso: `http://localhost:8080/plazoleta.html?selftest=1`
 * El resultado se publica en `document.title` (capturable con Chrome headless
 * `--dump-dom`), en consola y como aviso en el HUD.
 */

/** Guion de entrada: cada fase mantiene estas teclas hasta `until` (segundos). */
export const SELFTEST_STEPS = Object.freeze([
  Object.freeze({ until: 1.0, keys: ["KeyW"], label: "caminar" }),
  Object.freeze({ until: 2.0, keys: ["KeyW", "ShiftLeft"], label: "correr" }),
  Object.freeze({ until: 2.5, keys: ["KeyD"], label: "girar" }),
  Object.freeze({ until: 3.3, keys: ["KeyW"], label: "reanudar" }),
  Object.freeze({ until: 4.4, keys: [], label: "frenar" }),
]);

export const SELFTEST_DURATION = 4.4;

/** Observaciones que el bucle recoge frame a frame. */
export function createSelfTestTracker() {
  return {
    gaits: new Set(),
    recenterFrames: 0,
    shoulderFrames: 0,
    cameraPenetrationFrames: 0,
    bodyPenetrationFrames: 0,
    maxSpeed: 0,
    ticks: 0,
  };
}

/**
 * Registra un frame en el tracker (llamado desde el bucle).
 * @param {object} tracker
 * @param {object} state estado del mundo
 * @param {object} cameraState estado de cámara
 * @param {{cameraPenetration?: boolean, bodyPenetration?: boolean}} [flags]
 */
export function trackSelfTest(tracker, state, cameraState, flags = {}) {
  tracker.gaits.add(state.player.locomotion);
  if (cameraState.recenterActive) tracker.recenterFrames++;
  if (cameraState.shoulder > 0.01) tracker.shoulderFrames++;
  if (flags.cameraPenetration) tracker.cameraPenetrationFrames++;
  if (flags.bodyPenetration) tracker.bodyPenetrationFrames++;
  if (state.player.speed > tracker.maxSpeed) tracker.maxSpeed = state.player.speed;
  tracker.ticks++;
  return tracker;
}

/**
 * Resumen con criterios explícitos. `baseline` guarda el estado inicial.
 * @param {{state: object, cameraState: object, tracker: object, perf: object|null, baseline: object, liveCalls?: number|null}} params
 * @returns {{ok: boolean, checks: object, notes: string[]}}
 */
export function summarizeSelfTest({ state, cameraState, tracker, perf, baseline, liveCalls = null }) {
  const distance = state.player.distance - baseline.distance;
  const calls = Number.isFinite(liveCalls) ? liveCalls : perf?.snapshot?.calls ?? null;
  const checks = {
    /** La mascota se movió de verdad. */
    moved: distance > 1.5,
    /** Alcanzó velocidad de carrera (rampa de sprint completada). */
    sprintReached: tracker.maxSpeed > 3.6,
    /** Se observaron ambas locomociones. */
    walked: tracker.gaits.has("walk"),
    ran: tracker.gaits.has("run"),
    /** Volvió al reposo tras frenar (la frenada funciona). */
    stopped: state.player.locomotion === "idle",
    /** La cámara se recentró sola al menos unos frames. */
    recentered: tracker.recenterFrames > 4,
    /** El encuadre con hombro entró en acción en algún momento. */
    shoulderUsed: tracker.shoulderFrames > 0,
    /** La cámara nunca quedó dentro de un sólido. */
    cameraClean: tracker.cameraPenetrationFrames === 0,
    /** El cuerpo del jugador tampoco terminó dentro de un sólido. */
    bodyClean: tracker.bodyPenetrationFrames === 0,
    /** Presupuesto de dibujo dentro del plan. */
    drawCallsWithinPlan: calls === null || calls <= 90,
    /** Se observaron frames suficientes. */
    framesTracked: tracker.ticks > 60,
  };
  const ok = Object.values(checks).every(Boolean);
  const notes = [
    `distancia ${distance.toFixed(2)} m`,
    `velocidad máx ${tracker.maxSpeed.toFixed(2)} m/s`,
    `locomociones ${[...tracker.gaits].join("/")}`,
    `recentrado ${tracker.recenterFrames} frames`,
    `hombro ${tracker.shoulderFrames} frames`,
    `draw calls ${calls === null ? "n/d" : calls}`,
  ];
  return { ok, checks, notes };
}

/** Título compacto y parseable con el resultado. */
export function selfTestTitle(summary) {
  const failed = Object.entries(summary.checks).filter(([, value]) => !value).map(([key]) => key);
  return `selftest ${summary.ok ? "PASS" : `FAIL(${failed.join(",")})`} | ${summary.notes.join(" | ")}`;
}
