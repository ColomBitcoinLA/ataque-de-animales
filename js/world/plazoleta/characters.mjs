/**
 * characters.mjs — Protagonista y NPC articulados (M2 / Cali Viva POC).
 *
 * Arte original generado por código (primitivas compartidas), sin assets de terceros.
 * Cada personaje es un rig de partes rígidas independientes: se anima por código a
 * partir del ESTADO DE SIMULACIÓN (fase de locomoción acumulada por distancia, rumbo,
 * alerta), nunca al revés. La presentación no escribe estado de juego.
 *
 * Presupuesto de dibujo: Salamander 10 mallas, Lucía 8 mallas (documentado en
 * map-v1.DRAW_BUDGET y verificado por tests/unit/plazoleta-scene.test.cjs).
 */

import * as THREE from "../../vendor/three/three.module.min.mjs";
import { mergeGeometries, place, box, cyl, ico, cone } from "./geometry-utils.mjs";
import { linear } from "./render-kit.mjs";

const CHARACTER_COLORS = Object.freeze({
  petBody: "#f0733c",
  petBelly: "#ffd08a",
  petEye: "#16262c",
  skin: "#c98d63",
  dress: "#e0603f",
  hair: "#2a1f1b",
});

/** Materiales propios de personajes (compartidos entre todos los rigs). */
export function createCharacterMaterials() {
  const materials = new Map();
  const spec = {
    petBody: { roughness: 0.62 },
    petBelly: { roughness: 0.7 },
    petEye: { roughness: 0.28 },
    skin: { roughness: 0.78 },
    dress: { roughness: 0.82 },
    hair: { roughness: 0.86 },
  };
  for (const [name, color] of Object.entries(CHARACTER_COLORS)) {
    materials.set(name, new THREE.MeshStandardMaterial({
      color: linear(color),
      roughness: spec[name].roughness,
    }));
  }
  return {
    get(name) { return materials.get(name); },
    count() { return materials.size; },
    dispose() { for (const material of materials.values()) material.dispose(); materials.clear(); },
  };
}

function part(parent, name, geometry, material, { cast = true } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = cast;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

/**
 * Salamander: cuerpo bajo y alargado, cabeza ancha, cresta dorsal, cola larga y
 * cuatro patas. Orientación: +Z es "hacia adelante" (coherente con atan2(dx,dz)).
 */
export function createSalamanderRig(materials) {
  const root = new THREE.Group();
  root.name = "salamander";

  const bodyPivot = new THREE.Group();
  bodyPivot.name = "body-pivot";
  root.add(bodyPivot);

  const bodyGeometry = place(ico(0.34, 1), { sy: 0.78, sz: 1.22, y: 0.32 });
  const body = part(bodyPivot, "body", bodyGeometry, materials.get("petBody"));

  const bellyGeometry = place(ico(0.26, 1), { sy: 0.5, sz: 0.95, y: 0.2 });
  const belly = part(bodyPivot, "belly", bellyGeometry, materials.get("petBelly"), { cast: false });

  const headGeometry = mergeGeometries([
    place(ico(0.21, 1), { sy: 0.86, sz: 1.1, y: 0.44, z: 0.4 }),
    place(ico(0.15, 1), { sy: 0.6, sz: 0.7, y: 0.34, z: 0.58 }),
  ]);
  const headPivot = new THREE.Group();
  headPivot.name = "head-pivot";
  headPivot.position.set(0, 0.44, 0.4);
  bodyPivot.add(headPivot);
  const head = part(headPivot, "head", place(headGeometry, { y: 0, z: 0 }), materials.get("petBody"));

  const eyeGeometry = mergeGeometries([
    place(ico(0.052, 1), { x: -0.13, y: 0.09, z: 0.16 }),
    place(ico(0.052, 1), { x: 0.13, y: 0.09, z: 0.16 }),
  ]);
  part(headPivot, "eyes", eyeGeometry, materials.get("petEye"), { cast: false });

  const crestGeometry = mergeGeometries([
    place(cone(0.09, 0.3, 5), { y: 0.2, z: 0.28, rx: -0.5 }),
    place(cone(0.075, 0.24, 5), { y: 0.24, z: 0.1, rx: -0.35 }),
    place(cone(0.06, 0.2, 5), { y: 0.24, z: -0.06, rx: -0.2 }),
  ]);
  const crest = part(bodyPivot, "crest", crestGeometry, materials.get("petBelly"), { cast: false });

  const tailPivot = new THREE.Group();
  tailPivot.name = "tail-pivot";
  tailPivot.position.set(0, 0.3, -0.34);
  bodyPivot.add(tailPivot);
  const tailGeometry = place(ico(0.17, 1), { sy: 0.5, sz: 2.4, z: -0.3 });
  const tail = part(tailPivot, "tail", tailGeometry, materials.get("petBody"));

  // Una sola malla por pata (pierna + pieza de apoyo fusionadas) para respetar el
  // presupuesto de 10 draw calls del protagonista.
  const legGeometry = mergeGeometries([
    place(cyl(0.055, 0.07, 0.26, 6), { y: -0.13 }),
    place(ico(0.075, 0), { sy: 0.5, z: 0.03, y: -0.26 }),
  ]);
  const legPart = (name, x, z, phaseOffset) => {
    const pivot = new THREE.Group();
    pivot.name = `${name}-pivot`;
    pivot.position.set(x, 0.24, z);
    bodyPivot.add(pivot);
    part(pivot, name, legGeometry.clone(), materials.get("petBody"));
    return { pivot, phaseOffset };
  };
  const legs = [
    legPart("leg-front-left", -0.24, 0.2, 0),
    legPart("leg-front-right", 0.24, 0.2, 0.5),
    legPart("leg-back-left", -0.24, -0.22, 0.5),
    legPart("leg-back-right", 0.24, -0.22, 0),
  ];

  return {
    root,
    parts: { bodyPivot, body, belly, headPivot, head, crest, tailPivot, tail, legs },
    kind: "salamander",
  };
}

/** Lucía: figura humana estilizada (blusa, falda, moño) con pose de ventorrillo. */
export function createLuciaRig(materials) {
  const root = new THREE.Group();
  root.name = "lucia";

  const hipsPivot = new THREE.Group();
  hipsPivot.name = "hips";
  hipsPivot.position.set(0, 0.86, 0);
  root.add(hipsPivot);

  const skirt = part(hipsPivot, "skirt", place(cyl(0.19, 0.42, 0.86, 10), { y: -0.43 }), materials.get("dress"));
  const torso = part(hipsPivot, "torso", place(cyl(0.17, 0.2, 0.62, 8), { y: 0.31 }), materials.get("dress"));

  const armGeometry = mergeGeometries([
    place(cyl(0.045, 0.055, 0.46, 6), { y: -0.2 }),
    place(ico(0.06, 0), { y: -0.44 }),
  ]);
  const armPivots = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? "arm-left" : "arm-right";
    pivot.position.set(side * 0.2, 0.5, 0);
    pivot.rotation.z = side * 0.16;
    hipsPivot.add(pivot);
    part(pivot, `arm-${side < 0 ? "l" : "r"}`, armGeometry.clone(), materials.get("skin"));
    return pivot;
  });

  const legGeometry = mergeGeometries([
    place(cyl(0.055, 0.05, 0.5, 6), { y: -0.25 }),
    place(ico(0.07, 0), { sy: 0.55, sz: 1.25, y: -0.5 }),
  ]);
  for (const side of [-1, 1]) {
    part(hipsPivot, `leg-${side < 0 ? "l" : "r"}`, place(legGeometry.clone(), { x: side * 0.1, y: -0.72 }), materials.get("hair"));
  }

  const neckPivot = new THREE.Group();
  neckPivot.name = "neck";
  neckPivot.position.set(0, 0.66, 0);
  hipsPivot.add(neckPivot);
  const head = part(neckPivot, "head", place(ico(0.115, 1), { sy: 1.12, y: 0.1 }), materials.get("skin"));
  const hair = part(neckPivot, "hair", mergeGeometries([
    place(ico(0.125, 1), { sy: 0.9, sz: 0.95, y: 0.15, z: -0.02 }),
    place(ico(0.075, 0), { y: 0.06, z: -0.16 }),
    place(ico(0.06, 0), { y: 0.27, z: -0.05 }),
  ]), materials.get("hair"));
  hair.scale.set(1.02, 1.02, 1.02);

  return { root, parts: { hipsPivot, skirt, torso, head, hair, armPivots, neckPivot }, kind: "lucia" };
}

const scratch = { turn: 0 };

/**
 * Anima el Salamander a partir del estado de simulación (solo lectura).
 * @param {object} rig
 * @param {object} player estado del jugador de world-sim
 * @param {number} dt
 * @param {{interactionHeading?: number|null, alert?: number, reducedMotion?: boolean}} [options]
 */
export function updateSalamanderRig(rig, player, dt, options = {}) {
  const { bodyPivot, headPivot, tailPivot, crest, legs } = rig.parts;
  const reduced = Boolean(options.reducedMotion);
  const phase = player.phase;
  const walking = player.locomotion !== "idle";
  const running = player.locomotion === "run";

  rig.root.position.set(player.x, player.feetY, player.z);
  rig.root.rotation.y = player.heading;

  // Fase de locomoción acumulada por DISTANCIA (sin patinaje): amplitud por marcha.
  const stride = phase * Math.PI * 2;
  const legAmplitude = walking ? (running ? 0.62 : 0.4) : 0;
  for (const leg of legs) {
    const legPhase = stride + leg.phaseOffset * Math.PI;
    leg.pivot.rotation.x = Math.sin(legPhase) * legAmplitude;
    leg.pivot.rotation.z = Math.cos(legPhase) * legAmplitude * 0.12;
  }

  const bob = reduced ? 0 : Math.sin(stride * 2) * (running ? 0.045 : 0.028);
  bodyPivot.position.y = bob + 0.02;
  bodyPivot.rotation.x = walking ? (running ? -0.07 : -0.03) : Math.sin(phase * 0.6) * 0.01;
  bodyPivot.rotation.z = reduced ? 0 : Math.sin(stride) * (walking ? 0.045 : 0.012);

  tailPivot.rotation.y = Math.sin(stride - 0.6) * (walking ? 0.34 : 0.14);
  tailPivot.rotation.x = Math.sin(stride * 2) * (walking ? 0.12 : 0.05);
  crest.rotation.x = Math.sin(stride * 2 + 0.8) * 0.06;

  const idleBreath = reduced ? 0 : Math.sin(player.phase * 0.5 + performanceNowSeconds() * 2.1) * 0.012;
  headPivot.rotation.x = -0.04 + idleBreath;

  // Cabeza hacia el objetivo de interacción (micro-feedback de intención).
  if (Number.isFinite(options.interactionHeading)) {
    let delta = options.interactionHeading - player.heading;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    delta = Math.max(-0.7, Math.min(0.7, delta));
    headPivot.rotation.y = delta * 0.75;
  } else {
    headPivot.rotation.y *= 1 - Math.min(1, dt * 5);
  }
  scratch.turn = 0;
  return rig;
}

let nowSeconds = 0;
function performanceNowSeconds() {
  return nowSeconds;
}

/** La capa de composición actualiza el reloj de animación ambiental. */
export function setAnimationClock(seconds) {
  nowSeconds = seconds;
}

/** Anima a Lucía: respiración, balanceo y saludo gestual cuando el jugador se acerca. */
export function updateLuciaRig(rig, npc, dt, options = {}) {
  const { hipsPivot, torso, head, armPivots, neckPivot } = rig.parts;
  const reduced = Boolean(options.reducedMotion);
  rig.root.position.set(npc.x, npc.y, npc.z);
  rig.root.rotation.y = npc.heading;

  const breathe = reduced ? 0 : Math.sin(npc.phase) * 0.012;
  hipsPivot.position.y = 0.86 + breathe;
  torso.rotation.z = reduced ? 0 : Math.sin(npc.phase * 0.5) * 0.03;
  head.rotation.x = Math.sin(npc.phase * 0.8) * 0.04;
  neckPivot.rotation.y = Math.sin(npc.phase * 0.35) * 0.08;

  const alert = npc.alert ?? 0;
  // Brazo derecho saluda cuando el jugador está cerca (alerta alta).
  armPivots[1].rotation.z = -0.16 - alert * 1.35;
  armPivots[1].rotation.x = -alert * 0.5 + Math.sin(npc.phase * 3) * 0.12 * alert;
  armPivots[0].rotation.z = 0.16 + Math.sin(npc.phase * 0.7) * 0.05;
  return rig;
}
