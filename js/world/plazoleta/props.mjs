/**
 * props.mjs — Construcción de la escena estática desde MAP_V1 (M2 / Cali Viva POC).
 *
 * Objetivos de ingeniería (prioridades 4-7 del encargo):
 *   - UNA sola fuente de datos (map-v1) produce colisión, presupuesto y geometría.
 *   - Materiales y geometrías COMPARTIDOS: una instancia por concepto, no por malla.
 *   - Props repetidos por InstancedMesh (1 draw call por familia).
 *   - Grupos estáticos fusionados a un solo draw call por volumen de interés.
 *   - `dispose()` explícito de todo lo creado.
 *   - Texturas procedurales originales (canvas) — sin assets de terceros.
 *
 * El módulo NO necesita GPU para construirse, por lo que la composición y el conteo
 * de draw calls se verifican en Node (tests/unit/plazoleta-scene.test.cjs).
 */

import * as THREE from "../../vendor/three/three.module.min.mjs";
import {
  mergeGeometries, place, box, cyl, ico, cone, torusArc, plane, buildInstanced,
} from "./geometry-utils.mjs";
import { PALETTE, linear } from "./render-kit.mjs";

export const WATER_Y = -0.45;
export const RIVER_BED_Y = -1.75;

const MATERIAL_SPECS = Object.freeze({
  stone: { color: PALETTE.stone, roughness: 0.92 },
  stoneEdge: { color: PALETTE.stoneEdge, roughness: 0.88 },
  stoneParapet: { color: PALETTE.parapet, roughness: 0.9 },
  stoneBridge: { color: PALETTE.bridge, roughness: 0.86 },
  water: { color: PALETTE.water, roughness: 0.16, metalness: 0.06 },
  facadeWall: { color: PALETTE.facadeWall, roughness: 0.82 },
  facadeTrim: { color: PALETTE.facadeTrim, roughness: 0.75 },
  facadeAccent: { color: PALETTE.facadeAccent, roughness: 0.8 },
  roofTile: { color: PALETTE.roofTile, roughness: 0.78 },
  wood: { color: PALETTE.wood, roughness: 0.85 },
  metal: { color: PALETTE.metal, roughness: 0.45, metalness: 0.55 },
  brass: { color: "#c9a227", roughness: 0.34, metalness: 0.8 },
  foliageDark: { color: PALETTE.foliageDark, roughness: 0.95 },
  foliageLight: { color: PALETTE.foliageLight, roughness: 0.93 },
  grass: { color: PALETTE.grass, roughness: 0.96 },
  cloth: { color: PALETTE.cloth, roughness: 0.88 },
  soil: { color: PALETTE.soil, roughness: 0.98 },
  ridge: { color: "#ffffff", roughness: 1, vertexColors: true, basic: true },
});

/** Biblioteca de materiales compartidos (una instancia por concepto). */
export function createMaterialLibrary() {
  const materials = new Map();
  for (const [name, spec] of Object.entries(MATERIAL_SPECS)) {
    if (spec.basic) {
      materials.set(name, new THREE.MeshBasicMaterial({
        color: linear(spec.color),
        vertexColors: true,
        fog: true,
        toneMapped: true,
        side: THREE.DoubleSide,
      }));
      continue;
    }
    materials.set(name, new THREE.MeshStandardMaterial({
      color: linear(spec.color),
      roughness: spec.roughness ?? 0.9,
      metalness: spec.metalness ?? 0,
    }));
  }
  // El agua se ve desde arriba y desde la orilla.
  materials.get("water").side = THREE.DoubleSide;
  return {
    get(name) {
      const material = materials.get(name);
      if (!material) throw new Error(`props: material desconocido '${name}'`);
      return material;
    },
    names() { return [...materials.keys()]; },
    count() { return materials.size; },
    dispose() {
      for (const material of materials.values()) material.dispose();
      materials.clear();
    },
  };
}

/* ---------------------------------------------------------------------------
 * Texturas procedurales originales (canvas). En Node devuelven null y el
 * constructor sigue funcionando: así la composición es testeable sin navegador.
 * ------------------------------------------------------------------------- */

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function stoneTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const random = seeded(7);
  ctx.fillStyle = "#cfc3ae";
  ctx.fillRect(0, 0, size, size);
  const tile = 32;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const shade = 198 + Math.floor(random() * 34);
      ctx.fillStyle = `rgb(${shade + 12},${shade + 2},${shade - 22})`;
      ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
      ctx.fillStyle = "rgba(120,108,92,0.20)";
      ctx.fillRect(x, y, tile, 1.5);
      ctx.fillRect(x, y, 1.5, tile);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.repeat.set(9, 13);
  return texture;
}

function waterNormalTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  const height = (u, v) =>
    Math.sin(u * 6.4 + v * 1.6) * 0.5 + Math.sin(v * 4.1 - u * 0.9) * 0.5 + Math.sin((u + v) * 9.2) * 0.18;
  const step = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x * step;
      const v = y * step;
      const dx = (height(u + step, v) - height(u - step, v)) / (2 * step);
      const dy = (height(u, v + step) - height(u, v - step)) / (2 * step);
      const nx = -dx * 0.045;
      const ny = -dy * 0.045;
      const nz = 1;
      const length = Math.hypot(nx, ny, nz);
      const index = (y * size + x) * 4;
      image.data[index] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
      image.data[index + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
      image.data[index + 2] = Math.round(((nz / length) * 0.5 + 0.5) * 255);
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 14);
  return texture;
}

/**
 * Texturas del POC. En un entorno sin DOM devuelve `null` en cada ranura.
 * @returns {{stone: THREE.Texture|null, water: THREE.Texture|null, available: boolean}}
 */
export function createCanvasTextures() {
  if (typeof document === "undefined") return { stone: null, water: null, available: false };
  return { stone: stoneTexture(), water: waterNormalTexture(), available: true };
}

/* ---------------------------------------------------------------------------
 * Construcción de la escena
 * ------------------------------------------------------------------------- */

function addMerged(group, materials, name, geometries, materialName, { cast = true, receive = true } = {}) {
  const merged = mergeGeometries(geometries);
  for (const geometry of geometries) geometry.dispose?.();
  const mesh = new THREE.Mesh(merged, materials.get(materialName));
  mesh.name = name;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  group.add(mesh);
  return mesh;
}

function addMesh(group, materials, name, geometry, materialName, { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(geometry, materials.get(materialName));
  mesh.name = name;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  group.add(mesh);
  return mesh;
}

function buildRidge(distance, height, colorHex, seed) {
  const segments = 26;
  const width = distance * 1.9;
  const random = seeded(seed);
  const positions = [];
  const colors = [];
  const color = linear(colorHex);
  const peaks = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wave = Math.sin(t * Math.PI * 2.3 + seed) * 0.35 + Math.sin(t * Math.PI * 5.7 + seed * 2) * 0.18;
    peaks.push(height * (0.62 + wave * 0.4 + random() * 0.18));
  }
  for (let i = 0; i < segments; i++) {
    const x0 = -width / 2 + (width * i) / segments;
    const x1 = -width / 2 + (width * (i + 1)) / segments;
    const y0 = peaks[i];
    const y1 = peaks[i + 1];
    positions.push(x0, -3, 0, x1, -3, 0, x1, y1, 0);
    positions.push(x0, -3, 0, x1, y1, 0, x0, y0, 0);
    for (let k = 0; k < 6; k++) colors.push(color.r, color.g, color.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return { geometry, distance };
}

/**
 * Construye la escena estática completa del recinto.
 * @param {{scene: THREE.Object3D, map: object, materials: object, textures?: object, quality?: string}} params
 */
export function buildStaticScene({ scene, map, materials, textures = { stone: null, water: null }, quality = "high" }) {
  const group = new THREE.Group();
  group.name = "plazoleta-static";
  const lowQuality = quality === "low";

  /* --- Suelo de la plazoleta y del malecón ------------------------------- */
  const plazaFloor = box(14.2, 0.4, 20);
  place(plazaFloor, { x: 2.9, y: -0.2, z: 0 });
  const plazaMesh = addMesh(group, materials, "plaza-floor", plazaFloor, "stone", { cast: false, receive: true });
  if (textures.stone) {
    materials.get("stone").map = textures.stone;
    materials.get("stone").needsUpdate = true;
  }

  const maleconParts = [
    place(box(1.85, 0.44, 20), { x: -5.125, y: -0.21, z: 0 }),
    place(box(0.28, 0.5, 20), { x: -4.2, y: -0.22, z: 0 }),
    place(box(0.2, 0.06, 20), { x: -4.2, y: 0.03, z: 0 }),
    place(box(18.8, 0.3, 0.9), { x: 0.3, y: -0.12, z: 9.6 }),
    place(box(18.8, 0.3, 0.9), { x: 0.3, y: -0.12, z: -9.6 }),
  ];
  addMerged(group, materials, "malecon-stone", maleconParts, "stoneEdge", { cast: false });

  /* --- Río, ribera y agua ------------------------------------------------ */
  const bed = place(box(4.0, 0.4, 20), { x: -8.0, y: RIVER_BED_Y, z: 0 });
  addMerged(group, materials, "river-bed", [bed], "soil", { cast: false });

  const waterGeometry = plane(4.05, 20);
  place(waterGeometry, { x: -8.0, y: WATER_Y, z: 0, rx: -Math.PI / 2 });
  const waterMesh = addMesh(group, materials, "water", waterGeometry, "water", { cast: false, receive: false });
  waterMesh.material.side = THREE.DoubleSide;
  if (textures.water) {
    waterMesh.material.normalMap = textures.water;
    waterMesh.material.normalScale.set(0.75, 0.75);
    waterMesh.material.needsUpdate = true;
  }

  const wallParts = [
    // Muro de ribera (visible desde el agua) + parapeto con hueco para el puente.
    place(box(0.34, 1.6, 20), { x: -6.21, y: -0.55, z: 0 }),
    place(box(0.36, 1.05, 7.38), { x: -6.2, y: 0.525, z: -6.31 }),
    place(box(0.36, 1.05, 7.38), { x: -6.2, y: 0.525, z: 6.31 }),
    place(box(0.5, 0.14, 7.4), { x: -6.2, y: 1.12, z: -6.31 }),
    place(box(0.5, 0.14, 7.4), { x: -6.2, y: 1.12, z: 6.31 }),
    place(box(0.5, 1.35, 0.5), { x: -6.2, y: 0.55, z: -2.62 }),
    place(box(0.5, 1.35, 0.5), { x: -6.2, y: 0.55, z: 2.62 }),
  ];
  addMerged(group, materials, "river-wall", wallParts, "stoneParapet", { cast: true, receive: true });

  /* --- Puente Ortiz: tablero, arcos, pretiles y rampa -------------------- */
  const bridgeParts = [
    place(box(6.6, 0.32, 4.8), { x: -6.7, y: 0.99, z: 0 }),
    place(box(6.9, 0.16, 5.0), { x: -6.7, y: 1.13, z: 0 }),
    place(box(0.6, 1.3, 5.2), { x: -8.65, y: -0.2, z: 0 }),
    place(box(0.6, 1.3, 5.2), { x: -7.4, y: -0.2, z: 0 }),
    place(box(0.6, 1.3, 5.2), { x: -6.15, y: -0.2, z: 0 }),
    place(box(0.45, 1.9, 5.4), { x: -9.95, y: 0.4, z: 0 }),
  ];
  for (const x of [-9.3, -8.02, -6.75]) {
    bridgeParts.push(place(torusArc(0.75, 0.28), { x, y: 0.4, z: 0 }));
  }
  // Pretiles del tablero (y 1.1..2.3, igual que su colisionador).
  for (const z of [-2.45, 2.45]) {
    bridgeParts.push(place(box(6.6, 1.2, 0.26), { x: -6.7, y: 1.7, z }));
    bridgeParts.push(place(box(6.9, 0.16, 0.42), { x: -6.7, y: 2.36, z }));
  }
  // Rampa de acceso (desciende de 1.15 a 0 entre x=-3.4 y x=-0.6).
  const rampAngle = -Math.atan(map.bridgeDeckY / 2.8);
  bridgeParts.push(place(box(3.05, 0.26, 4.8), { x: -2.0, y: map.bridgeDeckY / 2 - 0.13, z: 0, rz: rampAngle }));
  for (const z of [-2.44, 2.44]) {
    bridgeParts.push(place(box(2.8, 2.3, 0.24), { x: -2.0, y: 1.15, z }));
  }
  addMerged(group, materials, "bridge-deck", bridgeParts, "stoneBridge", { cast: true, receive: true });

  /* --- Casona republicana con arcada ------------------------------------ */
  const facadeParts = [
    place(box(4.5, 7.4, 8.0), { x: 7.65, y: 3.7, z: -2.4 }),
    place(box(0.85, 4.3, 8.0), { x: 5.02, y: 5.25, z: -2.4 }),
    place(box(0.2, 0.58, 8.0), { x: 4.56, y: 0.29, z: -2.4 }),
  ];
  const bayZ = [-4.8, -2.6, -0.3];
  for (const z of [-5.9, -3.7, -1.5, 0.8]) {
    facadeParts.push(place(box(0.6, 3.1, 0.6), { x: 4.98, y: 1.55, z }));
    facadeParts.push(place(box(0.75, 0.2, 0.75), { x: 4.98, y: 0.1, z }));
  }
  for (const z of bayZ) {
    facadeParts.push(place(torusArc(1.1, 0.2), { x: 4.98, y: 2.0, z, ry: Math.PI / 2 }));
  }
  // Vanos: puerta central y dos vitrinas.
  facadeParts.push(place(box(0.16, 2.3, 1.2), { x: 4.62, y: 1.15, z: -2.6 }));
  facadeParts.push(place(box(0.12, 1.9, 1.3), { x: 4.72, y: 1.35, z: -4.8 }));
  facadeParts.push(place(box(0.12, 1.9, 1.3), { x: 4.72, y: 1.35, z: -0.3 }));
  addMerged(group, materials, "facade-walls", facadeParts, "facadeWall", { cast: true, receive: true });

  const trimParts = [
    place(box(0.22, 0.24, 8.0), { x: 4.55, y: 3.2, z: -2.4 }),
    place(box(0.55, 0.34, 8.4), { x: 4.5, y: 7.57, z: -2.4 }),
    place(box(0.34, 0.18, 8.2), { x: 4.6, y: 7.36, z: -2.4 }),
    place(box(0.8, 0.2, 4.9), { x: 4.32, y: 3.32, z: -3.05 }),
    place(box(0.62, 0.1, 4.9), { x: 4.4, y: 4.06, z: -3.05 }),
    // Marcos de las ventanas altas.
    ...[5.5, 5.9].flatMap((y) => bayZ.map((z) => place(box(0.14, 0.12, 1.35), { x: 4.5, y, z }))),
    ...bayZ.flatMap((z) => [
      place(box(0.14, 1.5, 0.12), { x: 4.5, y: 5.7, z: z - 0.62 }),
      place(box(0.14, 1.5, 0.12), { x: 4.5, y: 5.7, z: z + 0.62 }),
    ]),
  ];
  addMerged(group, materials, "facade-trim", trimParts, "facadeTrim", { cast: true, receive: true });

  const accentParts = [
    place(box(0.1, 1.5, 1.0), { x: 4.49, y: 5.7, z: -4.8 }),
    place(box(0.1, 1.5, 1.0), { x: 4.49, y: 5.7, z: -2.6 }),
    place(box(0.1, 1.5, 1.0), { x: 4.49, y: 5.7, z: -0.3 }),
    place(box(4.6, 0.24, 8.5), { x: 5.0, y: 7.72, z: -2.4 }),
  ];
  addMerged(group, materials, "facade-accent", accentParts, "facadeAccent", { cast: false, receive: true });

  const roofAngle = Math.atan(1.13 / 2.75);
  const roofParts = [
    place(box(2.98, 0.24, 8.7), { x: 5.87, y: 8.29, z: -2.4, rz: roofAngle }),
    place(box(2.98, 0.24, 8.7), { x: 8.63, y: 8.29, z: -2.4, rz: -roofAngle }),
    place(box(0.34, 0.3, 8.7), { x: 7.25, y: 8.9, z: -2.4 }),
  ];
  addMerged(group, materials, "facade-roof", roofParts, "roofTile", { cast: true, receive: true });

  const vineParts = [];
  const vineRandom = seeded(21);
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    vineParts.push(place(ico(0.22 + vineRandom() * 0.16, 0), {
      x: 4.5 + vineRandom() * 0.2,
      y: 0.6 + t * 5.2,
      z: -5.9 + Math.sin(t * 5.4) * 1.5,
    }));
  }
  addMerged(group, materials, "facade-foliage", vineParts, "foliageDark", { cast: false, receive: true });

  /* --- Samán centenario -------------------------------------------------- */
  const trunkParts = [
    place(cyl(0.55, 0.82, 0.55, 10), { x: 1.1, y: 0.27, z: -2.15 }),
    place(cyl(0.34, 0.52, 2.3, 10), { x: 1.1, y: 1.5, z: -2.15 }),
  ];
  const branchSpecs = [
    [0.9, 0.5, 2.6, 0.55], [-0.8, 0.7, 2.7, -0.5], [0.2, -0.9, 2.5, 0.4], [-0.4, -0.6, 2.4, -0.35],
  ];
  for (const [dx, dz, length, tilt] of branchSpecs) {
    trunkParts.push(place(cyl(0.14, 0.24, length, 8), {
      x: 1.1 + dx * 0.8, y: 2.9, z: -2.15 + dz * 0.8, rz: tilt * 0.7, rx: tilt * 0.55,
    }));
  }
  addMerged(group, materials, "samar-trunk", trunkParts, "wood", { cast: true, receive: true });

  const canopyRandom = seeded(33);
  const canopyDark = [];
  const canopyLight = [];
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const radius = 1.2 + canopyRandom() * 1.9;
    const size = 1.05 + canopyRandom() * 1.15;
    const geometry = ico(size, 0);
    place(geometry, {
      x: 1.1 + Math.cos(angle) * radius,
      y: 3.5 + canopyRandom() * 1.5,
      z: -2.15 + Math.sin(angle) * radius,
      sy: 0.72,
    });
    (i % 2 === 0 ? canopyDark : canopyLight).push(geometry);
  }
  canopyDark.push(place(ico(1.9, 0), { x: 1.1, y: 4.55, z: -2.15, sy: 0.68 }));
  canopyLight.push(place(ico(1.35, 0), { x: 1.9, y: 5.15, z: -1.6, sy: 0.62 }));
  addMerged(group, materials, "samar-canopy-dark", canopyDark, "foliageDark", { cast: true, receive: false });
  addMerged(group, materials, "samar-canopy-light", canopyLight, "foliageLight", { cast: true, receive: false });

  const benchRing = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    benchRing.push(place(box(1.15, 0.42, 0.4), {
      x: 1.1 + Math.cos(angle) * 1.6, y: 0.21, z: -2.15 + Math.sin(angle) * 1.6, ry: -angle,
    }));
  }
  addMerged(group, materials, "samar-bench", benchRing, "stoneEdge", { cast: true, receive: true });

  /* --- Pileta, puesto de Lucía y placa ---------------------------------- */
  const fountainParts = [
    place(cyl(0.95, 1.05, 0.72, 10), { x: -1.2, y: 0.36, z: 3.6 }),
    place(cyl(0.78, 0.78, 0.12, 10), { x: -1.2, y: 0.74, z: 3.6 }),
    place(cyl(0.16, 0.2, 1.1, 8), { x: -1.2, y: 1.2, z: 3.6 }),
  ];
  addMerged(group, materials, "fountain", fountainParts, "stoneEdge", { cast: true, receive: true });
  const fountainWater = place(cyl(0.82, 0.82, 0.05, 12), { x: -1.2, y: 0.71, z: 3.6 });
  addMesh(group, materials, "fountain-water", fountainWater, "water", { cast: false, receive: false });

  const stallParts = [
    place(box(1.6, 0.92, 1.15), { x: 3.7, y: 0.46, z: 3.65 }),
    place(box(1.75, 0.12, 1.3), { x: 3.7, y: 0.96, z: 3.65 }),
    place(cyl(0.06, 0.06, 2.5, 6), { x: 3.0, y: 1.25, z: 3.2 }),
    place(cyl(0.06, 0.06, 2.5, 6), { x: 4.4, y: 1.25, z: 4.1 }),
  ];
  addMerged(group, materials, "stall-structure", stallParts, "wood", { cast: true, receive: true });
  const parasol = cone(1.6, 0.75, 8, true);
  place(parasol, { x: 3.7, y: 2.6, z: 3.65, rz: 0.06 });
  addMesh(group, materials, "stall-parasol", parasol, "cloth", { cast: true, receive: false });

  const plaqueParts = [
    place(box(0.06, 0.56, 1.0), { x: -5.98, y: 0.68, z: 5.2 }),
    place(box(0.09, 0.66, 1.1), { x: -6.02, y: 0.68, z: 5.2 }),
  ];
  addMerged(group, materials, "plaque", plaqueParts, "brass", { cast: false, receive: false });

  /* --- Siluetas de profundidad (Farallones, cerro, arbolado) ------------- */
  const ridgeSpecs = [
    [-62, 15.5, PALETTE.ridgeFar, 11],
    [-78, 12.0, PALETTE.ridgeMid, 23],
    [-95, 8.5, PALETTE.ridgeNear, 37],
  ];
  const ridges = new THREE.Group();
  ridges.name = "distant-ridges";
  for (const [z, height, color, seed] of ridgeSpecs) {
    const { geometry, distance } = buildRidge(z, height, color, seed);
    const mesh = new THREE.Mesh(geometry, materials.get("ridge"));
    mesh.name = `ridge-${Math.abs(z)}`;
    mesh.position.set(distance < 0 ? 0 : 0, 0, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    ridges.add(mesh);
  }
  group.add(ridges);

  /* --- Instancing de props repetidos ------------------------------------ */
  const instanced = [];
  const geometryFactories = {
    palm: () => cyl(0.16, 0.26, 4.2, 7),
    bench: () => box(1.9, 0.12, 0.55),
    lamp: () => cyl(0.08, 0.11, 3.2, 8),
    bollard: () => cyl(0.09, 0.11, 0.62, 8),
    planter: () => cyl(0.45, 0.36, 0.6, 8),
    bin: () => cyl(0.22, 0.19, 0.75, 8),
    crate: () => box(0.42, 0.34, 0.42),
    flower: () => ico(0.24, 0),
    baluster: () => cyl(0.07, 0.09, 0.62, 6),
    pigeon: () => ico(0.13, 0),
    roofTile: () => cyl(0.09, 0.09, 0.32, 6),
    railingBar: () => cyl(0.028, 0.028, 0.72, 5),
    grassTuft: () => cone(0.11, 0.42, 4),
  };
  const materialByFamily = {
    palma: "wood", banca: "wood", farol: "metal", bolardo: "metal", maceta: "stoneEdge",
    papelera: "metal", "caja-puesto": "wood", buganvilla: "foliageLight", balustrada: "stoneBridge",
    paloma: "metal", teja: "roofTile", barrote: "metal", hierba: "grass",
  };
  for (const family of map.propFamilies) {
    const factory = geometryFactories[family.geometry];
    if (!factory) continue;
    const geometry = family.geometry === "grassTuft" || family.geometry === "flower"
      ? factory()
      : new THREE.BufferGeometry().copy(factory());
    const materialName = materialByFamily[family.id] ?? "stoneEdge";
    const mesh = buildInstanced(geometry, materials.get(materialName), family.instances, {
      castShadow: !lowQuality && family.id !== "hierba",
      receiveShadow: family.id !== "hierba",
    });
    mesh.name = `instanced-${family.id}`;
    group.add(mesh);
    instanced.push(mesh);
  }

  // Palmas: tronco instanciado + corona de hojas instanciada (2 draws para N palmas).
  const palmFamily = map.propFamilies.find((f) => f.id === "palma");
  if (palmFamily) {
    const frondGeometry = new THREE.BufferGeometry().copy(cone(0.55, 1.5, 5));
    const fronds = new THREE.InstancedMesh(frondGeometry, materials.get("foliageLight"), palmFamily.instances.length * 6);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    let index = 0;
    for (const [x, z, rotY = 0, uniform = 1] of palmFamily.instances) {
      for (let k = 0; k < 6; k++) {
        const angle = (k / 6) * Math.PI * 2 + rotY;
        euler.set(Math.cos(angle) * 0.85, angle, Math.sin(angle) * 0.85);
        quaternion.setFromEuler(euler);
        position.set(x + Math.cos(angle) * 0.85, 4.35 * uniform, z + Math.sin(angle) * 0.85);
        scale.set(uniform, uniform, uniform);
        matrix.compose(position, quaternion, scale);
        fronds.setMatrixAt(index++, matrix);
      }
    }
    fronds.instanceMatrix.needsUpdate = true;
    fronds.castShadow = !lowQuality;
    fronds.name = "instanced-palma-fronds";
    group.add(fronds);
    instanced.push(fronds);
  }

  scene.add(group);

  let triangles = 0;
  const geometries = new Set();
  const usedMaterials = new Set();
  group.traverse((object) => {
    if (!object.isMesh) return;
    if (object.geometry?.index) triangles += (object.geometry.index.count / 3) * (object.isInstancedMesh ? object.count : 1);
    else if (object.geometry?.attributes?.position) {
      triangles += (object.geometry.attributes.position.count / 3) * (object.isInstancedMesh ? object.count : 1);
    }
    if (object.geometry) geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) if (material) usedMaterials.add(material);
  });

  const stats = {
    // Cada malla (incluidas las instanciadas) es un draw call: no se cuentan dos veces.
    drawCalls: countMeshes(group),
    meshes: countMeshes(group),
    instanced: instanced.length,
    uniqueGeometries: geometries.size,
    uniqueMaterials: usedMaterials.size,
    triangles: Math.round(triangles),
    waterMesh,
  };
  return { group, ridges, instanced, stats, dispose: () => disposeGroup(group) };
}

function countMeshes(root) {
  let count = 0;
  root.traverse((object) => { if (object.isMesh) count++; });
  return count;
}

/** Libera geometrías y materiales de un grupo (no toca materiales compartidos). */
export function disposeGroup(group) {
  group.traverse((object) => {
    if (object.isMesh) object.geometry?.dispose?.();
  });
}
