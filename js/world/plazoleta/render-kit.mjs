/**
 * render-kit.mjs — Configuración de render, escena, cielo y luz (M2 / Cali Viva POC).
 *
 * Corrige la cadena de sobreexposición del prototipo v0:
 *   1. Gestión de color explícita (los hex se interpretan como sRGB y se convierten a lineal).
 *   2. Tone mapping ACES con exposición controlada (rodilla en las luces, sin recorte plano).
 *   3. Intensidades de luz calibradas para el modelo físico moderno de three (r155+).
 *   4. Sombra con frustum AJUSTADO al recinto (≈1.4 cm/téxel en 2048 sobre 28 m).
 *   5. Niebla lineal del color del horizonte, usada para separar planos (no para lavar).
 *
 * Responsabilidad: SOLO presentación. No conoce la simulación ni la cámara de juego.
 */

import * as THREE from "../../vendor/three/three.module.min.mjs";
import { PLAZOLETA_MAP } from "./map-v1.mjs";

export const PALETTE = Object.freeze({
  skyZenith: "#2f7fb5",
  skyHorizon: "#cfe3ea",
  sunTint: "#fff0cf",
  fog: "#c3d9e2",
  stone: "#cfc3ae",
  stoneEdge: "#e0d6c2",
  parapet: "#c9b596",
  bridge: "#b8a892",
  water: "#2f6f7d",
  facadeWall: "#f0dcb8",
  facadeTrim: "#fbf5e8",
  facadeAccent: "#2f6b6a",
  roofTile: "#a9503f",
  wood: "#9c6b45",
  metal: "#3d464c",
  foliageDark: "#3f6b45",
  foliageLight: "#6d9a55",
  grass: "#7c9a53",
  soil: "#8a6b4a",
  cloth: "#e0603f",
  skin: "#c98d63",
  petBody: "#f0733c",
  petBelly: "#ffd08a",
  petEye: "#1a2a30",
  ridgeFar: "#7d9aa6",
  ridgeMid: "#5f7f8a",
  ridgeNear: "#47646d",
});

export const QUALITY_TIERS = Object.freeze({
  high: Object.freeze({ pixelRatioCap: 2, shadowMapSize: 2048, shadowsEnabled: true, antialias: true }),
  balanced: Object.freeze({ pixelRatioCap: 1.5, shadowMapSize: 1024, shadowsEnabled: true, antialias: true }),
  low: Object.freeze({ pixelRatioCap: 1, shadowMapSize: 512, shadowsEnabled: false, antialias: false }),
});

/**
 * Convierte un hex sRGB al espacio de trabajo lineal (r152+).
 * Se exporta porque props/characters construyen sus paletas con la misma regla.
 */
export function linear(hex) {
  // r152+: interpreta el hex como sRGB y lo convierte al espacio lineal de trabajo.
  return new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
}

function makeSkyDome() {
  const geometry = new THREE.SphereGeometry(140, 24, 16);
  const colors = [];
  const zenith = linear(PALETTE.skyZenith);
  const horizon = linear(PALETTE.skyHorizon);
  const position = geometry.attributes.position;
  const temp = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) / 140;
    const t = Math.pow(Math.max(0, Math.min(1, y)), 0.55);
    temp.copy(horizon).lerp(zenith, t);
    colors.push(temp.r, temp.g, temp.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    vertexColors: true,
    fog: false,
    toneMapped: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "sky-dome";
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  return mesh;
}

function makeSunGlow(sunDirection) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255, 238, 200, 0.95)");
  gradient.addColorStop(0.25, "rgba(255, 214, 150, 0.42)");
  gradient.addColorStop(1, "rgba(255, 200, 130, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), material);
  mesh.name = "sun-glow";
  mesh.position.set(sunDirection.x * 120, sunDirection.y * 120, sunDirection.z * 120);
  mesh.lookAt(0, mesh.position.y * 0.4, 0);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

/** Dirección del sol a partir del preset del mapa. */
export function sunDirection(map = PLAZOLETA_MAP) {
  const { sunAzimuth, sunElevation } = map.timeOfDay;
  const horizontal = Math.cos(sunElevation);
  return {
    x: Math.sin(sunAzimuth) * horizontal,
    y: Math.sin(sunElevation),
    z: Math.cos(sunAzimuth) * horizontal,
  };
}

/**
 * Crea renderer, escena, cámara, cielo y luces.
 * @param {{container: HTMLElement, quality?: keyof typeof QUALITY_TIERS, map?: object}} params
 */
export function createRenderKit({ container, quality = "high", map = PLAZOLETA_MAP }) {
  const tier = QUALITY_TIERS[quality] ?? QUALITY_TIERS.high;

  if (THREE.ColorManagement) THREE.ColorManagement.enabled = true;

  const renderer = new THREE.WebGLRenderer({
    antialias: tier.antialias,
    powerPreference: "high-performance",
    alpha: false,
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = tier.shadowsEnabled;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(linear(PALETTE.skyHorizon), 1);
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(linear(PALETTE.fog), 30, 118);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.12, 320);
  camera.position.set(0, 4.2, 8.5);

  const sunDir = sunDirection(map);
  const sun = new THREE.DirectionalLight(linear(PALETTE.sunTint), 3.1);
  sun.position.set(sunDir.x * 26, sunDir.y * 26, sunDir.z * 26);
  sun.castShadow = tier.shadowsEnabled;
  sun.target.position.set(0, 0, 0);
  sun.shadow.mapSize.set(tier.shadowMapSize, tier.shadowMapSize);
  const extent = 14.5; // ajustado al recinto de 20x20 m => ~1.4 cm/téxel a 2048
  sun.shadow.camera.left = -extent;
  sun.shadow.camera.right = extent;
  sun.shadow.camera.top = extent;
  sun.shadow.camera.bottom = -extent;
  sun.shadow.camera.near = 6;
  sun.shadow.camera.far = 68;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.022;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(linear("#bcd9ff"), linear(PALETTE.soil), 0.55);
  scene.add(hemi);

  const sky = makeSkyDome();
  scene.add(sky);
  const glow = makeSunGlow(sunDir);
  scene.add(glow);

  /** Libera GPU: geometrías, materiales y texturas de toda la escena. */
  function disposeScene(root = scene) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const material of list) {
        materials.add(material);
        for (const key of ["map", "normalMap", "roughnessMap", "alphaMap"]) {
          if (material[key]) textures.add(material[key]);
        }
      }
    });
    for (const texture of textures) texture.dispose?.();
    for (const material of materials) material.dispose?.();
    for (const geometry of geometries) geometry.dispose?.();
  }

  function dispose() {
    disposeScene(scene);
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer.domElement.remove();
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pixelRatioCap));
    renderer.setSize(width, height);
  }

  /** Ajuste adaptativo de calidad a partir de métricas MEDIDAS en runtime. */
  function applyTier(nextTierName) {
    const next = QUALITY_TIERS[nextTierName];
    if (!next) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, next.pixelRatioCap));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (renderer.shadowMap.enabled !== next.shadowsEnabled) {
      renderer.shadowMap.enabled = next.shadowsEnabled;
      renderer.shadowMap.needsUpdate = true;
      sun.castShadow = next.shadowsEnabled;
    }
    if (sun.shadow.mapSize.width !== next.shadowMapSize) {
      sun.shadow.mapSize.set(next.shadowMapSize, next.shadowMapSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    scene.traverse((object) => {
      const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const material of list) material.needsUpdate = true;
    });
  }

  return { renderer, scene, camera, sun, hemi, sky, glow, tier, qualityName: quality, resize, dispose, disposeScene, applyTier, palette: PALETTE, linear };
}
