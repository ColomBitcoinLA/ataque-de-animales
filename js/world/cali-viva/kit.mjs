/**
 * Cali Viva — kit de utilidades Three.js (solo navegador).
 *  - col(): convierte hex sRGB a lineal (r128 no gestiona color automáticamente;
 *    sin esto la salida sRGB "lava" la paleta, que era parte del problema del baseline).
 *  - StaticBatcher: fusiona geometría estática por material con colores por vértice
 *    para mantener pocas llamadas de dibujo.
 *  - Ruido determinista y geometrías procedurales originales.
 */
import * as THREE from 'three';

export function col(hex) {
  return new THREE.Color(hex).convertSRGBToLinear();
}

export function mixCol(a, b, t) {
  return a.clone().lerp(b, Math.max(0, Math.min(1, t)));
}

/** PRNG determinista (mulberry32) para que la escena sea idéntica en cada carga. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruido de valor 3D suave en [0, 1]. */
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export function xf(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

export function mul(...matrices) {
  const out = new THREE.Matrix4();
  for (const m of matrices) out.multiply(m);
  return out;
}

/** Cápsula vía LatheGeometry (CapsuleGeometry no existe en r128). Eje Y. */
export function capsuleGeometry(radius, length, radial = 10, cap = 4) {
  const pts = [];
  for (let i = 0; i <= cap; i++) {
    const a = -Math.PI / 2 + (i / cap) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * radius), -length / 2 + Math.sin(a) * radius));
  }
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * radius), length / 2 + Math.sin(a) * radius));
  }
  return new THREE.LatheGeometry(pts, radial);
}

/** Desplaza vértices con ruido para siluetas orgánicas (copas, piedras). */
export function displace(geometry, amount, frequency, seed = 0) {
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length() || 1;
    const n = noise3(v.x * frequency + seed, v.y * frequency + seed * 0.7, v.z * frequency - seed) - 0.5;
    v.multiplyScalar(1 + (n * amount) / len);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Fusiona geometría estática por "bucket" de material.
 * color puede ser THREE.Color (lineal) o una función (posMundo, normalMundo) => THREE.Color.
 */
export class StaticBatcher {
  constructor() {
    this.buckets = new Map();
    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._nm = new THREE.Matrix3();
  }

  add(key, geometry, matrix, color, { keep = false } = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (!g.attributes.normal) g.computeVertexNormals();
    let b = this.buckets.get(key);
    if (!b) {
      b = { pos: [], nor: [], uv: [], col: [] };
      this.buckets.set(key, b);
    }
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const vc = g.attributes.color;
    this._nm.getNormalMatrix(matrix);
    const isFn = typeof color === 'function';
    for (let i = 0; i < pos.count; i++) {
      this._v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      this._n.fromBufferAttribute(nor, i).applyMatrix3(this._nm).normalize();
      b.pos.push(this._v.x, this._v.y, this._v.z);
      b.nor.push(this._n.x, this._n.y, this._n.z);
      if (uv) b.uv.push(uv.getX(i), uv.getY(i));
      else b.uv.push(0, 0);
      if (vc) b.col.push(vc.getX(i), vc.getY(i), vc.getZ(i));
      else {
        const c = isFn ? color(this._v, this._n) : color;
        b.col.push(c.r, c.g, c.b);
      }
    }
    if (g !== geometry) g.dispose();
    if (!keep) geometry.dispose();
  }

  /** @param {Record<string,{material:THREE.Material,cast?:boolean,receive?:boolean}>} specs */
  build(specs) {
    const meshes = [];
    for (const [key, b] of this.buckets) {
      const spec = specs[key];
      if (!spec) throw new Error(`StaticBatcher: no material spec for bucket "${key}"`);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, spec.material);
      mesh.name = `batch:${key}`;
      mesh.castShadow = !!spec.cast;
      mesh.receiveShadow = spec.receive !== false;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}
