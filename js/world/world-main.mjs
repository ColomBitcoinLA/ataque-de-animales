/**
 * Cali Viva — Controlador principal del prototipo 3D (Plazoleta del Río).
 *
 * Integra:
 *  - Detección de WebGL con pantalla de error visible.
 *  - Tone mapping ACESFilmic, sRGBEncoding y sombras suaves calibradas.
 *  - Entorno 3D modular batched (Puente Ortiz, Samán, Fachada, Río Cali).
 *  - Mascota protagonista (Salamander por defecto, intercambiable por Neptuno o Tierrudo).
 *  - Lucía (NPC humana con animaciones de respiración, mirada y saludo).
 *  - Cámara en 3ª persona con órbita yaw/pitch/zoom y evasión de muros.
 *  - Locomoción y colisión con elevación sobre el arco del puente.
 *  - Guion de exploración local con progreso y XP demo claramente no autoritativa.
 *  - Monitor de rendimiento en tiempo real (?perf=1 o botón "Métricas").
 *  - Liberación determinista de recursos GPU (ResourceTracker).
 */
import * as THREE from 'three';
import {
  SPAWN,
  SOLIDS,
  CAMERA_OBSTACLES,
  INTERACTIONS,
  INTERACTION_RADIUS,
  groundHeight,
  isInsideMirador,
} from './cali-viva/layout.mjs';
import {
  createOrbit,
  applyOrbitInput,
  orbitDirection,
  resolveCameraDistance,
  smoothCameraDistance,
  CAMERA_LIMITS,
} from './cali-viva/camera-rig.mjs';
import {
  createLocomotionState,
  updateLocomotion,
  cameraRelativeInput,
} from './cali-viva/locomotion.mjs';
import {
  createQuestState,
  currentStep,
  completeStep,
} from './cali-viva/quest.mjs';
import { ResourceTracker } from './cali-viva/disposal.mjs';
import { FrameStats, formatPerfLines } from './cali-viva/perf-monitor.mjs';
import { col } from './cali-viva/kit.mjs';
import { buildEnvironment } from './cali-viva/environment.mjs';
import { buildSalamander, buildNeptuno, buildTierrudo } from './cali-viva/creatures.mjs';
import { buildLucia } from './cali-viva/lucia.mjs';
import { advance, closestInteraction } from './world-core.mjs';
import { SPECIES_DEFAULT_AFFINITIES, ELEMENTAL_METADATA } from '../rules/index.mjs';

// -------------------------------------------------------------
// 1. DETECCIÓN DE WEBGL
// -------------------------------------------------------------
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

const loadingEl = document.getElementById('loading');
const webglErrorEl = document.getElementById('webgl-error');

if (!isWebGLAvailable()) {
  if (loadingEl) loadingEl.hidden = true;
  if (webglErrorEl) webglErrorEl.hidden = false;
  throw new Error('WebGL is not supported on this device/browser.');
}

// -------------------------------------------------------------
// 2. ELEMENTOS DEL DOM Y ESTADO
// -------------------------------------------------------------
const container = document.getElementById('world-scene');
const objectiveEl = document.getElementById('objective');
const demoXpValEl = document.getElementById('demo-xp-val');
const proximityEl = document.getElementById('proximity');
const nearNameEl = document.getElementById('near-name');
const dialogEl = document.getElementById('dialog');
const dialogTitleEl = document.getElementById('dialog-title');
const dialogBodyEl = document.getElementById('dialog-body');
const dialogActionsEl = document.getElementById('dialog-actions');
const petNameEl = document.getElementById('pet-name');
const petBadgeEl = document.getElementById('pet-badge');
const petAffinityLabelEl = document.getElementById('pet-affinity-label');
const changePetBtn = document.getElementById('change-pet');
const perfOverlayEl = document.getElementById('perf-overlay');
const togglePerfBtn = document.getElementById('toggle-perf');
const mobileInteractBtn = document.getElementById('mobile-interact');

// Parámetro de rendimiento ?perf=1
const urlParams = new URLSearchParams(window.location.search);
let perfEnabled = urlParams.get('perf') === '1';
if (perfOverlayEl) perfOverlayEl.hidden = !perfEnabled;
if (togglePerfBtn) {
  togglePerfBtn.addEventListener('click', () => {
    perfEnabled = !perfEnabled;
    perfOverlayEl.hidden = !perfEnabled;
  });
}

// -------------------------------------------------------------
// 3. INICIALIZACIÓN DE THREE.JS CON COLOR CALIBRADO
// -------------------------------------------------------------
const globalTracker = new ResourceTracker();
const scene = new THREE.Scene();

// Cielo caleño tropical
scene.background = col('#80c5de');
// Niebla lineal suave que da profundidad sin desteñir el primer plano
scene.fog = new THREE.Fog(col('#9dd3e6'), 20, 56);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 150);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

container.replaceChildren(renderer.domElement);

// Iluminación tropical calibrada
// Luz hemisférica: cielo celeste cálido, rebote de tierra tostada
const hemiLight = new THREE.HemisphereLight(col('#e1f5fe'), col('#3e2723'), 0.72);
scene.add(hemiLight);

// Sol de la tarde (luz direccional con sombras definidas)
const sunLight = new THREE.DirectionalLight(col('#fff1d0'), 1.35);
sunLight.position.set(-14, 20, 16);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.left = -15;
sunLight.shadow.camera.right = 15;
sunLight.shadow.camera.top = 15;
sunLight.shadow.camera.bottom = -15;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 48;
sunLight.shadow.bias = -0.0006;
scene.add(sunLight);

// Luz cálida puntual sobre los faroles del malecón
const lampLight1 = new THREE.PointLight(col('#ffb74d'), 1.2, 7.5, 2);
lampLight1.position.set(-1.8, 3.2, -5.5);
scene.add(lampLight1);

const lampLight2 = new THREE.PointLight(col('#ffb74d'), 1.2, 7.5, 2);
lampLight2.position.set(5.8, 3.2, -5.5);
scene.add(lampLight2);

// -------------------------------------------------------------
// 4. CONSTRUCCIÓN DEL ENTORNO Y NPC
// -------------------------------------------------------------
const { root: envRoot, updateWater } = buildEnvironment(globalTracker);
scene.add(envRoot);

const { root: luciaRoot, update: updateLucia } = buildLucia(globalTracker);
scene.add(luciaRoot);

// -------------------------------------------------------------
// 5. GESTIÓN DE LA CRIATURA PROTAGONISTA
// -------------------------------------------------------------
let creatureTracker = new ResourceTracker();
let currentCreatureName = 'Salamander';
let creatureInstance = null;
const creatureHolder = new THREE.Group();
creatureHolder.position.set(SPAWN.x, groundHeight(SPAWN.x, SPAWN.z), SPAWN.z);
creatureHolder.rotation.y = SPAWN.heading;
scene.add(creatureHolder);

const CREATURE_BUILDERS = {
  Salamander: buildSalamander,
  Neptuno: buildNeptuno,
  Tierrudo: buildTierrudo,
};

function setCreature(speciesName) {
  const builder = CREATURE_BUILDERS[speciesName];
  if (!builder) return;

  // Liberar recursos de la criatura anterior
  creatureTracker.dispose();
  creatureTracker = new ResourceTracker();
  creatureHolder.clear();

  currentCreatureName = speciesName;
  creatureInstance = builder(creatureTracker);
  creatureHolder.add(creatureInstance.root);

  // Actualizar tarjeta del HUD con metadatos canónicos
  const affinity = SPECIES_DEFAULT_AFFINITIES[speciesName] || 'FUEGO';
  const meta = ELEMENTAL_METADATA.find((m) => m.nombre === affinity) || {
    emoji: '🐾',
    nombre: affinity,
    color: '#ff5722',
  };

  if (petNameEl) petNameEl.textContent = speciesName;
  if (petBadgeEl) {
    petBadgeEl.textContent = `${meta.emoji} ${meta.nombre}`;
    petBadgeEl.style.backgroundColor = meta.color;
  }
  if (petAffinityLabelEl) {
    petAffinityLabelEl.textContent = `Afinidad elemental: ${meta.nombre}`;
  }
}

setCreature('Salamander');

// Modal para cambiar de criatura
if (changePetBtn) {
  changePetBtn.addEventListener('click', () => {
    showDialog(
      'Mascota protagonista',
      'Elige cuál criatura recorrerá la Plazoleta del Río:',
      [
        ['Salamander (Fuego)', () => { setCreature('Salamander'); closeDialog(); }, currentCreatureName === 'Salamander'],
        ['Neptuno (Agua)', () => { setCreature('Neptuno'); closeDialog(); }, currentCreatureName === 'Neptuno'],
        ['Tierrudo (Tierra)', () => { setCreature('Tierrudo'); closeDialog(); }, currentCreatureName === 'Tierrudo'],
      ]
    );
  });
}

// -------------------------------------------------------------
// 6. CÁMARA EN 3ª PERSONA Y CONTROL DE ÓRBITA
// -------------------------------------------------------------
let orbit = createOrbit({ yaw: SPAWN.heading, pitch: 0.32, distance: 5.6 });
let smoothedCameraDistance = orbit.distance;

let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

window.addEventListener('mousedown', (e) => {
  if (e.target.closest('.hud') || e.target.closest('.overlay')) return;
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging || isDialogOpen) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  orbit = applyOrbitInput(orbit, {
    dYaw: dx * 0.0055,
    dPitch: -dy * 0.004,
  });
});

window.addEventListener('wheel', (e) => {
  if (isDialogOpen) return;
  const zoomFactor = e.deltaY > 0 ? 0.08 : -0.08;
  orbit = applyOrbitInput(orbit, { dZoom: zoomFactor });
}, { passive: true });

// -------------------------------------------------------------
// 7. ENTRADA DE TECLADO Y MÓVIL
// -------------------------------------------------------------
const keys = new Set();
let isDialogOpen = false;

window.addEventListener('keydown', (e) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyE'].includes(e.code)) {
    if (!isDialogOpen) e.preventDefault();
  }
  keys.add(e.code);

  if (e.code === 'KeyE' && !e.repeat) {
    handleInteraction();
  }
  if (e.code === 'Escape' && isDialogOpen) {
    closeDialog();
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

window.addEventListener('blur', () => {
  keys.clear();
  isDragging = false;
});

// Controles táctiles
for (const btn of document.querySelectorAll('[data-move]')) {
  const code = 'Key' + btn.dataset.move.toUpperCase();
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    keys.add(code);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
    btn.addEventListener(evt, () => keys.delete(code));
  });
}

if (mobileInteractBtn) {
  mobileInteractBtn.addEventListener('click', handleInteraction);
}

// -------------------------------------------------------------
// 8. GUION DE EXPLORACIÓN Y DIÁLOGOS
// -------------------------------------------------------------
let quest = createQuestState();

function updateQuestUI() {
  const step = currentStep(quest);
  if (objectiveEl) {
    objectiveEl.textContent = step ? `Objetivo: ${step.text}.` : '¡Exploración del benchmark completada!';
  }
  if (demoXpValEl) {
    demoXpValEl.textContent = quest.demoXp;
  }
}

updateQuestUI();

function showDialog(title, text, actions) {
  isDialogOpen = true;
  keys.clear();
  if (dialogTitleEl) dialogTitleEl.textContent = title;
  if (dialogBodyEl) dialogBodyEl.textContent = text;
  if (dialogActionsEl) {
    dialogActionsEl.replaceChildren();
    for (const [label, fn, isPrimary] of actions) {
      const b = document.createElement('button');
      b.textContent = label;
      if (isPrimary) b.className = 'primary';
      b.addEventListener('click', fn);
      dialogActionsEl.append(b);
    }
  }
  if (dialogEl) dialogEl.hidden = false;
}

function closeDialog() {
  if (dialogEl) dialogEl.hidden = true;
  isDialogOpen = false;
}

function handleInteraction() {
  if (isDialogOpen) return;
  const currentPos = { x: creatureHolder.position.x, z: creatureHolder.position.z };
  const target = closestInteraction(currentPos, INTERACTIONS, INTERACTION_RADIUS);
  if (!target) return;

  if (target.id === 'lucia') {
    const step = currentStep(quest);
    if (!step || step.id === 'meet-lucia') {
      showDialog(
        'Lucía · Entrenadora de Cali',
        '¡Hola! Qué gusto verte en el Bulevar del Río. El río Cali baja fresco de los Farallones y cruza bajo el Puente Ortiz, construido con ladrillo y cantos rodados. Sube al mirador del puente para contemplar el agua.',
        [
          ['Iré al mirador del puente', () => {
            const { state, changed } = completeStep(quest, 'meet-lucia');
            if (changed) quest = state;
            updateQuestUI();
            closeDialog();
          }, true],
          ['Hasta luego', closeDialog, false],
        ]
      );
    } else if (step.id === 'visit-mirador') {
      showDialog(
        'Lucía · Entrenadora de Cali',
        'Sube por el arco de ladrillo del puente hasta el mirador. Desde allí se aprecia la brisa caleña y el lecho del río.',
        [['Entendido', closeDialog, true]]
      );
    } else if (step.id === 'report-lucia') {
      showDialog(
        'Lucía · Entrenadora de Cali',
        '¡Fantástico! Ya conoces la Plazoleta del Río y el Puente Ortiz. En las próximas fases este mundo crecerá con más barrios de Cali, combates autoritativos y fauna salvaje.',
        [
          ['Completar recorrido (+10 XP demo)', () => {
            const { state, changed } = completeStep(quest, 'report-lucia');
            if (changed) quest = state;
            updateQuestUI();
            closeDialog();
          }, true],
        ]
      );
    } else {
      showDialog(
        'Lucía · Entrenadora de Cali',
        'Puedes seguir explorando la plazoleta, observar el gran samán y las buganvilias, o cambiar tu mascota para probar sus movimientos.',
        [['Continuar', closeDialog, true]]
      );
    }
  } else if (target.id === 'fruit-cart') {
    showDialog(
      'Carreta de frutas tropicales',
      'Una típica carreta caleña repleta de chontaduro con miel, lulo ácido y maracuyá dulce. Las frutas llenan de energía y vigor a las criaturas.',
      [['Continuar explorando', closeDialog, true]]
    );
  } else if (target.id === 'saman') {
    showDialog(
      'El gran Samán (Albizia saman)',
      'Un árbol patrimonial de tronco masivo y copa en forma de paraguas. Su sombra fresca atenúa el sol de la tarde caleña.',
      [['Apreciar la sombra', closeDialog, true]]
    );
  }
}

// -------------------------------------------------------------
// 9. BUCLE PRINCIPAL DE ANIMACIÓN Y FÍSICA
// -------------------------------------------------------------
const clock = new THREE.Clock();
let locomotion = createLocomotionState(SPAWN.heading);
const frameStats = new FrameStats(180);
const cpuStats = new FrameStats(180);
let lastPerfUpdate = 0;

const targetFocus = new THREE.Vector3();
const desiredCamPos = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const frameStart = performance.now();
  const dt = Math.min(clock.getDelta(), 0.08);
  const time = clock.elapsedTime;

  // 1. Entrada de movimiento
  let ix = 0;
  let iz = 0;
  if (!isDialogOpen) {
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  }
  const isRunning = keys.has('ShiftLeft') || keys.has('ShiftRight');

  // Dirección relativa a la cámara
  const worldDir = cameraRelativeInput(ix, iz, orbit.yaw);

  // 2. Actualizar estado de locomoción pura
  locomotion = updateLocomotion(
    locomotion,
    { dirX: worldDir.x, dirZ: worldDir.z, run: isRunning },
    dt
  );

  // 3. Integración de movimiento y colisiones con world-core.advance
  if (locomotion.speed > 0.01) {
    const currentXZ = { x: creatureHolder.position.x, z: creatureHolder.position.z };
    const stepMove = { x: locomotion.moveX, z: locomotion.moveZ };
    const moved = advance(currentXZ, stepMove, 1.0, dt, SOLIDS);

    creatureHolder.position.x = moved.x;
    creatureHolder.position.z = moved.z;
    creatureHolder.rotation.y = locomotion.heading;

    // Altura del suelo caminable (arco del Puente Ortiz)
    const gy = groundHeight(moved.x, moved.z);
    creatureHolder.position.y = gy;
  }

  // 4. Comprobación automática del mirador del puente en la misión
  if (isInsideMirador(creatureHolder.position.x, creatureHolder.position.z)) {
    const step = currentStep(quest);
    if (step && step.id === 'visit-mirador') {
      const { state, changed } = completeStep(quest, 'visit-mirador');
      if (changed) {
        quest = state;
        updateQuestUI();
      }
    }
  }

  // 5. Animación de la criatura
  if (creatureInstance && creatureInstance.update) {
    creatureInstance.update(locomotion, dt, time);
  }

  // 6. Animación de Lucía y el agua
  updateLucia(creatureHolder.position, dt, time);
  updateWater(time);

  // 7. Proximidad de interacción
  const currentPos = { x: creatureHolder.position.x, z: creatureHolder.position.z };
  const nearest = closestInteraction(currentPos, INTERACTIONS, INTERACTION_RADIUS);
  if (proximityEl) {
    proximityEl.hidden = !nearest || isDialogOpen;
    if (nearest && nearNameEl) nearNameEl.textContent = nearest.label;
  }

  // 8. Cámara en 3ª persona con evasión de muros (spring-arm raycast)
  targetFocus.set(creatureHolder.position.x, creatureHolder.position.y + 0.65, creatureHolder.position.z);
  const dir = orbitDirection(orbit);

  // Resolver distancia segura evitando colisiones con cajas altas
  const safeDistance = resolveCameraDistance(targetFocus, dir, orbit.distance, CAMERA_OBSTACLES);
  smoothedCameraDistance = smoothCameraDistance(smoothedCameraDistance, safeDistance, dt, 8.0);

  desiredCamPos.set(
    targetFocus.x + dir.x * smoothedCameraDistance,
    targetFocus.y + dir.y * smoothedCameraDistance,
    targetFocus.z + dir.z * smoothedCameraDistance
  );

  // No permitir que la cámara baje del suelo
  desiredCamPos.y = Math.max(CAMERA_LIMITS.groundClearance, desiredCamPos.y);

  camera.position.copy(desiredCamPos);
  camera.lookAt(targetFocus);

  // Renderizar
  renderer.render(scene, camera);

  // 9. Medición real de rendimiento
  const frameDuration = performance.now() - frameStart;
  cpuStats.push(frameDuration);
  frameStats.push(dt * 1000);

  if (perfEnabled && perfOverlayEl && time - lastPerfUpdate > 0.25) {
    lastPerfUpdate = time;
    const heap = window.performance && window.performance.memory ? window.performance.memory.usedJSHeapSize / (1024 * 1024) : null;
    const lines = formatPerfLines({
      frame: frameStats.summary(),
      cpu: cpuStats.summary(),
      info: {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      },
      heapMB: heap,
      pixelRatio: renderer.getPixelRatio(),
    });
    perfOverlayEl.innerHTML = lines.join('<br/>');
  }
}

// -------------------------------------------------------------
// 10. RESIZE Y ARRANQUE
// -------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
});

if (loadingEl) loadingEl.hidden = true;
animate();
