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
import { createWorldState, stepWorld, activate, drainEvents, worldSummary, SIM } from "./world-sim.mjs";
import { dialogs } from "./behaviors.mjs";
import { createRenderKit, QUALITY_TIERS } from "./render-kit.mjs";
import { createMaterialLibrary, createCanvasTextures, buildStaticScene } from "./props.mjs";
import { createCharacterMaterials, createSalamanderRig, createLuciaRig, updateSalamanderRig, updateLuciaRig, setAnimationClock } from "./characters.mjs";
import { createCameraState, solveCamera, adjustZoom, applyLook, CAMERA_LIMITS } from "./camera-solver.mjs";
import { createHud } from "./hud.mjs";
import { createPerfMonitor, onPerfSample } from "./perf.mjs";

const params = new URLSearchParams(location.search);
const qualityName = QUALITY_TIERS[params.get("quality")] ? params.get("quality") : "high";
const perfEnabled = params.get("perf") === "1";
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
  let intentX = 0;
  let intentZ = 0;

  const FIXED_DT = 1 / SIM.hz;

  /** Dirección de mundo derivada de la cámara (intención), sin duplicar cinemática. */
  function updateIntent() {
    const yaw = cameraState.yaw;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const x = forwardX * input.forward + rightX * input.strafe;
    const z = forwardZ * input.forward + rightZ * input.strafe;
    const magnitude = Math.hypot(x, z);
    if (magnitude > 0.001) {
      intentX = x / magnitude;
      intentZ = z / magnitude;
    } else {
      intentX = 0;
      intentZ = 0;
    }
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (paused) return;

    const frameDt = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;
    elapsed += frameDt;

    if (perfEnabled) perf.beginGpuQuery();
    const simStart = performance.now();
    accumulator += frameDt;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 5) {
      updateIntent();
      stepWorld(state, { moveX: intentX, moveZ: intentZ, run: input.run }, FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === 5) accumulator = 0;
    perf.recordSim(performance.now() - simStart);

    const animStart = performance.now();
    setAnimationClock(elapsed);
    const interaction = state.interaction;
    let interactionHeading = null;
    if (interaction.inRange) {
      const poi = state.map.interactables.find((item) => item.id === interaction.targetId);
      if (poi) interactionHeading = Math.atan2(poi.x - state.player.x, poi.z - state.player.z);
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
      subject: { x: state.player.x, y: state.player.feetY, z: state.player.z },
      subjectSpeed: state.player.speed,
      cameraSolids: cameraSolidsList,
      dt: frameDt,
      outPosition: camPosition,
      outTarget: camTarget,
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

    updateHud();

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
    hud.setPet({
      name: "Salamander",
      meta: state.player.locomotion === "idle" ? "explorando · en reposo" : `explorando · ${summary.locomotion}`,
      trust: summary.trust,
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
