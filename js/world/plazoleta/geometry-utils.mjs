/**
 * geometry-utils.mjs — Utilidades de geometría compartida (M2 / Cali Viva POC).
 *
 * Sin dependencias externas (no usa addons de three): el POC debe poder construir
 * y CONTAR su grafo de escena también en Node, sin navegador ni GPU, para que el
 * presupuesto de draw calls sea verificable en los tests.
 */

import * as THREE from "../../vendor/three/three.module.min.mjs";

/**
 * Fusiona geometrías indexadas con atributos position/normal/uv en una sola.
 * Todas deben tener el mismo conjunto de atributos (es el caso de las primitivas
 * de three usadas aquí: Box, Cylinder, Cone, Sphere, Icosahedron, Plane, Torus).
 * @param {THREE.BufferGeometry[]} geometries
 * @returns {THREE.BufferGeometry}
 */
export function mergeGeometries(geometries) {
  const list = geometries.filter(Boolean);
  if (list.length === 0) throw new Error("mergeGeometries: lista vacía.");
  // Las geometrías de poliedro (Icosahedron/Cone) llegan sin índice: se sintetiza uno
  // trivial para poder fusionarlas con las indexadas en un único draw call.
  for (const geometry of list) {
    if (!geometry.index) {
      const count = geometry.attributes.position.count;
      const index = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
      for (let i = 0; i < count; i++) index[i] = i;
      geometry.setIndex(new THREE.BufferAttribute(index, 1));
    }
  }
  let vertexCount = 0;
  let indexCount = 0;
  let hasUv = true;
  for (const geometry of list) {
    if (!geometry.index) throw new Error("mergeGeometries: se esperan geometrías indexadas.");
    vertexCount += geometry.attributes.position.count;
    indexCount += geometry.index.count;
    if (!geometry.attributes.normal) throw new Error("mergeGeometries: falta el atributo normal.");
    if (!geometry.attributes.uv) hasUv = false;
  }

  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const uv = hasUv ? new Float32Array(vertexCount * 2) : null;
  const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  let vertexOffset = 0;
  let indexOffset = 0;
  for (const geometry of list) {
    const p = geometry.attributes.position.array;
    const n = geometry.attributes.normal.array;
    position.set(p, vertexOffset * 3);
    normal.set(n, vertexOffset * 3);
    if (uv) uv.set(geometry.attributes.uv.array, vertexOffset * 2);
    const srcIndex = geometry.index.array;
    for (let i = 0; i < srcIndex.length; i++) index[indexOffset + i] = srcIndex[i] + vertexOffset;
    vertexOffset += geometry.attributes.position.count;
    indexOffset += srcIndex.length;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  if (uv) merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/** Aplica una transformación (posición/rotación/escala) a una geometría y la devuelve. */
export function place(geometry, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  matrix.compose(
    new THREE.Vector3(x, y, z),
    quaternion,
    new THREE.Vector3(sx, sy, sz)
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

/** Caja con esquinas redondeadas aproximadas por bisel: ahorra un draw frente a decenas de detalles. */
export function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

export function cyl(radiusTop, radiusBottom, height, segments = 8, openEnded = false) {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, openEnded);
}

export function ico(radius, detail = 0) {
  return new THREE.IcosahedronGeometry(radius, detail);
}

export function cone(radius, height, segments = 6) {
  return new THREE.ConeGeometry(radius, height, segments);
}

export function torusArc(radius, tube, arc = Math.PI) {
  return new THREE.TorusGeometry(radius, tube, 6, 12, arc);
}

export function plane(w, h) {
  return new THREE.PlaneGeometry(w, h);
}

/**
 * Eventail de geometrías reutilizables: mismo objeto para todas las instancias.
 * @returns {{get: (key:string, factory:()=>THREE.BufferGeometry) => THREE.BufferGeometry, dispose: () => void, size: () => number}}
 */
export function createGeometryCache() {
  const cache = new Map();
  return {
    get(key, factory) {
      let geometry = cache.get(key);
      if (!geometry) {
        geometry = factory();
        cache.set(key, geometry);
      }
      return geometry;
    },
    dispose() {
      for (const geometry of cache.values()) geometry.dispose?.();
      cache.clear();
    },
    size() {
      return cache.size;
    },
  };
}

/** Instancia una familia de props sobre un InstancedMesh reutilizando geometría y material. */
export function buildInstanced(geometry, material, instances, { castShadow = true, receiveShadow = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const euler = new THREE.Euler();
  for (let i = 0; i < instances.length; i++) {
    const [x, z, rotY = 0, uniform = 1, extra = 0] = instances[i];
    euler.set(0, rotY, 0);
    quaternion.setFromEuler(euler);
    position.set(x, extra > 0 ? extra : 0, z);
    scale.set(uniform, uniform, uniform);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
