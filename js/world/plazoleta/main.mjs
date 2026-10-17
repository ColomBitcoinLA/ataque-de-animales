/**
 * main.mjs — Raíz de composición del POC "Cali Viva / Plazoleta del Río" (M2).
 *
 * Este archivo SOLO compone y traduce intención. No contiene reglas de juego,
 * ni fórmulas de movimiento, ni lógica de cámara: esas viven en world-sim,
 * kinematics y camera-solver respectivamente.
 *
 *   entrada (teclado/ratón/táctil)  →  intención en espacio de mundo
 *   world-sim (fijo 60 Hz)          →  estado del mundo
 *   camera-solver (puro)            →  pose de cámara
 *   characters/props (three)        →  presentación que LEE el estado
 *
 * Ninguna recompensa sale del cliente: la XP del POC es explícitamente de demostración.
 */

import { PLAZOLETA_MAP, cameraSolids, plannedDrawCalls, plannedDrawCallsWithShadows } from "./map-v1.mjs";
import { createWorldState, stepWorld, activate, drainEvents, worldSummary, playerBlocked, SIM } from "./world-sim.mjs";
import { dialogs } from "./behaviors.mjs";
import { intentFromInput } from "./control-feel.mjs";
import {
  createSelfTestTracker,
  trackSelfTest,
  summarizeSelfTest,
  selfTestTitle,
  SELFTEST_STEPS,
  SELFTEST_DURATION,
} from "./selftest.mjs";
import { createRenderKit, QUALITY_TIERS } from "./render-kit.mjs";
import { createMaterialLibrary, createCanvasTextures, buildStaticScene } from "./props.mjs";
import { createCharacterMaterials, createSalamanderRig, createLuciaRig, updateSalamanderRig, updateLuciaRig, setAnimationClock } from "./characters.mjs";
import { createCameraState, solveCamera, adjustZoom, applyLook, pointInsideSolids, CAMERA_LIMITS } from "./camera-solver.mjs";
import { createHud } from "./hud.mjs";
import { createPerfMonitor, onPerfSample } from "./perf.mjs";

const params = new URLSearchParams(location.search);
const qualityName = QUALITY_TIERS[params.get("quality")] ? params.get("quality") : "high";
const perfEnabled = params.get("perf") === "1";
const selfTestEnabled = params.get("selftest") === "1";
const seed = Number.parseInt(params.get("seed") ?? "20261006", 10) || 20261006;

const container = document.getElementById("world-scene");
const hud = createHud({ perfEnabled });

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

if (!supportsWebGL()) {
  hud.setLoading(null);
  hud.showFallback("Tu navegador no puede iniciar WebGL. Puedes seguir jugando en el modo clásico 2D.");
} else {
  start();
}

function start() {
  const kit = createRenderKit({ container, quality: qualityName, map: PLAZOLETA_MAP });
  const materials = createMaterialLibrary();
  const textures = createCanvasTextures();
  const staticScene = buildStaticScene({ scene: kit.scene, map: PLAZOLETA_MAP, materials, textures, quality: qualityName });

  const characterMaterials = createCharacterMaterials();
  const salamander = createSalamanderRig(characterMaterials);
  const luciaRig = createLuciaRig(characterMaterials);
  kit.scene.add(salamander.root);
  kit.scene.add(luciaRig.root);

  const state = createWorldState(PLAZOLETA_MAP, { seed });
  const cameraState = createCameraState({ yaw: state.player.heading + Math.PI, pitch: 0.22, distance: 6.4 });
  const cameraSolidsList = cameraSolids(PLAZOLETA_MAP);
  const camPosition = { x: 0, y: 0, z: 0 };
  const camTarget = { x: 0, y: 0, z: 0 };

  const perf = createPerfMonitor({
    enabled: perfEnabled,
    budget: { p95Ms: 16.7, calls: plannedDrawCalls(), triangles: 260000 },
  });
  if (perfEnabled) {
    hud.setPerfVisible(true);
    perf.attachGpuTimer(kit.renderer);
    onPerfSample(perf, (snapshot) => {
      hud.updatePerf(snapshot, perf.budget);
      // En modo autodiagnóstico el título lo posee el resultado del guion, no las métricas.
      if (selfTestEnabled) return;
      hud.setTitle(
        `perf p50=${snapshot.p50.toFixed(2)} p95=${snapshot.p95.toFixed(2)} fps=${snapshot.fps.toFixed(1)} ` +
        `calls=${snapshot.calls} tris=${snapshot.triangles} heapMB=${snapshot.heapMB ? snapshot.heapMB.toFixed(1) : "n/a"}`
      );
    }, 250);
    setTimeout(() => {
      const snapshot = perf.snapshot;
      console.log("[cali-viva][perf]", JSON.stringify(snapshot));
    }, 8000);
  }

  /* ----------------------------- Entrada ------------------------------- */
  const keys = new Set();
  const input = { forward: 0, strafe: 0, run: false };
  let pointerId = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  const pointers = new Map();
  let pinchDistance = 0;

  function refreshInput() {
    const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const strafe = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    input.forward = hud.isDialogOpen() ? 0 : forward;
    input.strafe = hud.isDialogOpen() ? 0 : strafe;
    input.run = keys.has("ShiftLeft") || keys.has("ShiftRight");
  }

  function onKeyDown(event) {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === "Escape") {
      hud.closeDialog();
      return;
    }
    if (event.code === "KeyE" && !event.repeat) {
      interact();
      return;
    }
    if (event.code === "KeyH" && !event.repeat && hud.els.help) {
      hud.els.help.hidden = !hud.els.help.hidden;
      return;
    }
    keys.add(event.code);
    refreshInput();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
    refreshInput();
  }

  function onPointerDown(event) {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      pointerId = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      kit.renderer.domElement.setPointerCapture?.(event.pointerId);
      document.body.classList.add("dragging");
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance > 0) adjustZoom(cameraState, (pinchDistance - distance) * 0.02);
      pinchDistance = distance;
      return;
    }
    if (pointerId === event.pointerId && !hud.isDialogOpen()) {
      applyLook(cameraState, event.clientX - lastPointerX, event.clientY - lastPointerY);
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
    }
  }

  function onPointerUp(event) {
    pointers.delete(event.pointerId);
    if (pointerId === event.pointerId) {
      pointerId = null;
      document.body.classList.remove("dragging");
    }
    if (pointers.size < 2) pinchDistance = 0;
  }

  function onWheel(event) {
    event.preventDefault();
    adjustZoom(cameraState, event.deltaY * 0.0022);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => { keys.clear(); refreshInput(); });
  window.addEventListener("resize", () => kit.resize());
  const canvas = kit.renderer.domElement;
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // Controles táctiles del HUD: misma intención que el teclado, sin duplicar lógica.
  for (const button of document.querySelectorAll("[data-move]")) {
    const code = `Key${button.dataset.move.toUpperCase()}`;
    const press = (event) => { event.preventDefault(); keys.add(code); refreshInput(); };
    const release = () => { keys.delete(code); refreshInput(); };
    button.addEventListener("pointerdown", press);
    for (const type of ["pointerup", "pointercancel", "pointerleave"]) button.addEventListener(type, release);
  }
  const interactButton = document.getElementById("mobile-interact");
  interactButton?.addEventListener("click", () => interact());

  /* --------------------------- Interacción ----------------------------- */
  function interact() {
    if (hud.isDialogOpen()) return;
    const action = activate(state, dialogs);
    if (!action) {
      hud.toast("No hay nada con qué interactuar aquí.");
      return;
    }
    const dialog = action.dialog ?? {};
    const nextStep = state.map.quest.steps[state.quest.stepIndex];
    hud.openDialog({
      title: dialog.title ?? "Plazoleta del Río",
      body: dialog.body ?? "",
      lines: [
        ...(dialog.lines ?? []),
        ...(action.completed ? ["Misión completada · explora libremente"] : []),
        ...(nextStep && !action.completed ? [`Siguiente: ${nextStep.objective}`] : []),
      ],
      reward: action.reward ? `${action.reward} · ${state.map.quest.rewardLabel}` : dialog.reward,
    });
  }

  hud.onDialogClose(refreshInput);

  /* ------------------------- Bucle principal --------------------------- */
  let rafId = 0;
  let lastTime = performance.now();
  let accumulator = 0;
  let elapsed = 0;
  let paused = false;

  const FIXED_DT = 1 / SIM.hz;

  // Buffers reutilizados: el bucle no asigna memoria.
  const intent = { x: 0, z: 0, magnitude: 0 };
  const subjectPoint = { x: 0, y: 0, z: 0 };
  const focusPoint = { x: 0, y: 0, z: 0 };
  let focusActive = false;

  /* Autodiagnóstico opcional (?selftest=1): recorre un guion y publica el resultado. */
  const selfTestTracker = selfTestEnabled ? createSelfTestTracker() : null;
  const selfTestBaseline = selfTestEnabled
    ? { x: state.player.x, z: state.player.z, distance: state.player.distance }
    : null;
  let selfTestReported = false;
  let framesSeen = 0;

  /**
   * Guion del autodiagnóstico. Se ejecuta de forma DETERMINISTA en un solo frame:
   * recorre el guion con pasos fijos de 1/60 s, aplicando el mismo mapeo de input, la
   * misma simulación y el mismo solucionador de cámara que el bucle normal. Así el
   * resultado no depende de cuántos frames logre completar el navegador (Chrome headless
   * con rasterizador por software completa muy pocos).
   */
  function runSelfTestNow() {
    const totalSteps = Math.ceil(SELFTEST_DURATION / FIXED_DT);
    for (let i = 0; i < totalSteps; i++) {
      let phaseKeys = [];
      for (const step of SELFTEST_STEPS) {
        if (state.time < step.until) { phaseKeys = step.keys; break; }
      }
      keys.clear();
      for (const code of phaseKeys) keys.add(code);
      refreshInput();
      updateIntent();
      stepWorld(state, { moveX: intent.x, moveZ: intent.z, run: input.run }, FIXED_DT);
      subjectPoint.x = state.player.x;
      subjectPoint.y = state.player.feetY;
      subjectPoint.z = state.player.z;
      solveCamera(cameraState, {
        subject: subjectPoint,
        subjectSpeed: state.player.locomotionSpeed,
        subjectHeading: state.player.heading,
        cameraSolids: cameraSolidsList,
        dt: FIXED_DT,
        outPosition: camPosition,
        outTarget: camTarget,
        focusTarget: null,
      });
      trackSelfTest(selfTestTracker, state, cameraState, {
        cameraPenetration: pointInsideSolids(cameraState.position, cameraSolidsList),
        bodyPenetration: playerBlocked(state),
      });
    }
    keys.clear();
    refreshInput();

    // Fase 2: comprobación de oclusión contra el muro oeste de la casona (a ~2,4 m).
    // Verifica en el navegador real que el brazo se acorta, entra el hombro y la cámara
    // no atraviesa geometría. El punto de apoyo está libre de sólidos (verificado en map).
    state.player.x = 2.2;
    state.player.z = 0.5;
    state.player.heading = Math.PI / 2;
    cameraState.yaw = Math.PI / 2;
    cameraState.manualTimer = 0;
    for (let i = 0; i < 45; i++) {
      subjectPoint.x = state.player.x;
      subjectPoint.y = state.player.feetY;
      subjectPoint.z = state.player.z;
      solveCamera(cameraState, {
        subject: subjectPoint,
        subjectSpeed: 0,
        subjectHeading: state.player.heading,
        cameraSolids: cameraSolidsList,
        dt: FIXED_DT,
        outPosition: camPosition,
        outTarget: camTarget,
        focusTarget: null,
      });
      trackSelfTest(selfTestTracker, state, cameraState, {
        cameraPenetration: pointInsideSolids(cameraState.position, cameraSolidsList),
        bodyPenetration: playerBlocked(state),
      });
    }
    reportSelfTest();
  }

  function reportSelfTest() {
    if (selfTestReported) return;
    selfTestReported = true;
    const summary = summarizeSelfTest({
      state,
      cameraState,
      tracker: selfTestTracker,
      perf: perfEnabled ? perf : null,
      baseline: selfTestBaseline,
      // Lectura directa del renderer: es el número medido del último frame renderizado.
      liveCalls: kit.renderer.info?.render?.calls ?? null,
    });
    const title = selfTestTitle(summary);
    hud.setTitle(title);
    // Evidencia textual persistente para revisión automática (Chrome headless --dump-dom).
    const resultElement = document.getElementById("selftest-result");
    if (resultElement) resultElement.textContent = `${title} :: ${JSON.stringify(summary.checks)}`;
    console.log("[cali-viva][selftest]", JSON.stringify(summary));
    hud.toast(summary.ok ? "Autodiagnóstico R1-A: PASS" : `Autodiagnóstico R1-A: revisar (${title})`, 6000);
  }

  /**
   * Dirección de mundo derivada de la cámara.
   * El mapeo vive en control-feel (probado en Node): aquí sólo se le pasa el input crudo.
   */
  function updateIntent() {
    intentFromInput(input, cameraState.yaw, intent);
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (paused) return;

    const frameDt = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;
    elapsed += frameDt;
    framesSeen++;
    // El autodiagnóstico corre en el segundo frame: en el primero ya hubo un render real,
    // así que `renderer.info` tiene valores medidos que reportar.
    if (selfTestEnabled && !selfTestReported && framesSeen >= 2) runSelfTestNow();

    if (perfEnabled) perf.beginGpuQuery();
    const simStart = performance.now();
    accumulator += frameDt;
    // En modo autodiagnóstico se permiten más pasos fijos por frame: un rasterizador por
    // software (o Chrome headless) completa muy pocos frames y si no, el guion no avanza.
    // Los pasos siguen siendo de 1/60 s exactos: la simulación es la misma.
    const maxStepsPerFrame = selfTestEnabled ? 20 : 5;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < maxStepsPerFrame) {
      updateIntent();
      stepWorld(state, { moveX: intent.x, moveZ: intent.z, run: input.run }, FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
    }
    // Alfa de interpolación: la cámara y la presentación leen una posición suave
    // aunque la simulación avance a pasos fijos de 60 Hz.
    const alpha = Math.min(1, Math.max(0, accumulator / FIXED_DT));
    subjectPoint.x = state.player.prevX + (state.player.x - state.player.prevX) * alpha;
    subjectPoint.z = state.player.prevZ + (state.player.z - state.player.prevZ) * alpha;
    subjectPoint.y = state.player.feetY;
    if (steps === maxStepsPerFrame) accumulator = 0;
    perf.recordSim(performance.now() - simStart);

    const animStart = performance.now();
    setAnimationClock(elapsed);
    const interaction = state.interaction;
    let interactionHeading = null;
    focusActive = false;
    if (interaction.inRange) {
      const poi = state.map.interactables.find((item) => item.id === interaction.targetId);
      if (poi) {
        interactionHeading = Math.atan2(poi.x - state.player.x, poi.z - state.player.z);
        // Durante un diálogo la cámara encuadra al interlocutor (R1-A).
        if (hud.isDialogOpen()) {
          focusPoint.x = poi.x;
          focusPoint.y = poi.feetY ?? 0;
          focusPoint.z = poi.z;
          focusActive = true;
        }
      }
    }
    updateSalamanderRig(salamander, state.player, frameDt, {
      interactionHeading,
      reducedMotion: hud.reducedMotion || qualityName === "low",
    });
    updateLuciaRig(luciaRig, state.npcs[0], frameDt, { reducedMotion: hud.reducedMotion });
    // Si el brazo colapsa contra un muro, se oculta el protagonista para no atravesar la cámara.
    salamander.root.visible = cameraState.boom > 0.95;
    if (staticScene.stats.waterMesh?.material.normalMap) {
      const map = staticScene.stats.waterMesh.material.normalMap;
      map.offset.y = (map.offset.y + frameDt * 0.012) % 1;
      map.offset.x = (map.offset.x + frameDt * 0.004) % 1;
    }
    perf.recordAnim(performance.now() - animStart);

    // Cámara: pura, resuelta contra los sólidos de cámara del mapa.
    solveCamera(cameraState, {
      subject: subjectPoint,
      subjectSpeed: state.player.locomotionSpeed,
      subjectHeading: state.player.heading,
      cameraSolids: cameraSolidsList,
      dt: frameDt,
      outPosition: camPosition,
      outTarget: camTarget,
      focusTarget: focusActive ? focusPoint : null,
    });
    kit.camera.position.set(camPosition.x, camPosition.y, camPosition.z);
    kit.camera.lookAt(camTarget.x, camTarget.y, camTarget.z);
    if (Math.abs(kit.camera.fov - cameraState.fov) > 0.01) {
      kit.camera.fov = cameraState.fov;
      kit.camera.updateProjectionMatrix();
    }

    const renderStart = performance.now();
    kit.renderer.render(kit.scene, kit.camera);
    perf.recordRender(performance.now() - renderStart);
    if (perfEnabled) perf.endGpuQuery();

    if (selfTestEnabled && !selfTestReported) runSelfTestNow();    updateHud();

    if (perfEnabled) {
      perf.endFrame(now, kit.renderer);
      if (perf.shouldDegrade() && qualityName !== "low") {
        kit.applyTier("low");
        perf.markDegraded();
        hud.toast("Calidad reducida automáticamente por presupuesto de frame medido.");
      }
    }
  }

  function updateHud() {
    const summary = worldSummary(state);
    hud.setObjective(summary.objective, summary.stepIndex, summary.stepsTotal);
    hud.setContext(summary.zone.label, PLAZOLETA_MAP.timeOfDay.label);
    const gait = summary.locomotion === "idle"
      ? "explorando · en reposo"
      : summary.locomotion === "run"
        ? "explorando · corriendo"
        : "explorando · caminando";
    hud.setPet({
      name: "Salamander",
      meta: gait,
      trust: summary.trust,
      // Velocidad normalizada para la barra (R1-A): feedback de aceleración/frenada.
      speed: summary.speed,
      maxSpeed: SIM.runSpeed,
      aligning: summary.aligning,
    });
    hud.setPrompt({
      visible: state.interaction.inRange && !hud.isDialogOpen(),
      verb: state.interaction.verb ?? "",
      label: state.interaction.label ?? "",
    });
    drainEvents(state, (event) => {
      if (event.type === "npc-greet") hud.toast("Lucía te saluda con la mano.");
      if (event.type === "quest-complete") hud.toast("Misión completada · recompensa de demostración.");
    });
  }

  /* ------------------------- Ciclo de memoria -------------------------- */
  function dispose() {
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("resize", kit.resize);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    kit.scene.remove(salamander.root);
    kit.scene.remove(luciaRig.root);
    characterMaterials.dispose();
    materials.dispose();
    kit.dispose();
    delete window.__caliViva;
  }
  window.addEventListener("pagehide", dispose, { once: true });
  document.addEventListener("visibilitychange", () => {
    paused = document.hidden;
    lastTime = performance.now();
    accumulator = 0;
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    paused = true;
    hud.showFallback("Se perdió el contexto WebGL. Reinicia la página para continuar.");
  });

  /** Diagnóstico y automatización: estado y métricas accesibles sin DevTools. */
  window.__caliViva = {
    state,
    perf,
    kit,
    map: PLAZOLETA_MAP,
    plannedDrawCalls: plannedDrawCalls(),
    plannedDrawCallsWithShadows: plannedDrawCallsWithShadows(),
    sceneStats: staticScene.stats,
    cameraState,
    dispose,
  };

  hud.setLoading(null);
  refreshInput();
  rafId = requestAnimationFrame(frame);
}
