/** Static asset smoke test in the repository's real Three.js version. ISC.
 * No renderer/browser or game runtime changes; not a frame-performance test.
 * Run: node tools/blender/verify_glb.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { decodePng } from './decode_png.mjs';
const decodedImages = [];
// Headless Node lacks ImageBitmap. Decode actual embedded PNG pixels, not a mock.
// This tests loading/decoding only; there is no browser canvas or GPU upload.
globalThis.self = globalThis;
globalThis.createImageBitmap = async blob => {
  const image = decodePng(await blob.arrayBuffer());
  decodedImages.push({ width: image.width, height: image.height, rgbaBytes: image.data.length });
  return image;
};
const url = new URL('../../assets/characters/salamander/v2/salamander-v2-preview.glb', import.meta.url);
const reportUrl = new URL('../../docs/r1b/v2/three-validation.json', import.meta.url);
let sourceSha256 = null;
try {
const bytes = await readFile(url);
sourceSha256 = createHash('sha256').update(bytes).digest('hex');
const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const gltf = await new GLTFLoader().parseAsync(data, '');
assert.equal(gltf.animations.length, 0, 'No animations permitted in R1-B.2');
let meshCount = 0, triangles = 0, positionVertices = 0, colorMeshes = 0;
const materials = new Set();
const details = [];
gltf.scene.updateMatrixWorld(true);
gltf.scene.traverse((node) => {
  assert.ok(!node.isSkinnedMesh && !node.isBone, 'No rigging permitted');
  assert.ok(!node.isCamera && !node.isLight, 'Export must exclude studio');
  if (!node.isMesh) return;
  meshCount++;
  const geometry = node.geometry;
  const positions = geometry.attributes.position;
  assert.ok(positions.count > 0);
  assert.ok([...positions.array].every(Number.isFinite), `finite position: ${node.name}`);
  assert.ok(geometry.attributes.normal, `normals: ${node.name}`);
  assert.ok([...geometry.attributes.normal.array].every(Number.isFinite));
  assert.equal(geometry.attributes.normal.count, positions.count);
  assert.equal((geometry.index?.count ?? positions.count) % 3, 0);
  assert.ok(node.matrixWorld.elements.every(Number.isFinite));
  if (geometry.index) {
    for (const index of geometry.index.array) assert.ok(index < positions.count);
  }
  if (geometry.attributes.color) {
    colorMeshes++;
    assert.ok([...geometry.attributes.color.array].every(Number.isFinite));
  }
  positionVertices += positions.count;
  const count = (geometry.index?.count ?? positions.count) / 3;
  triangles += count;
  for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m.name);
  details.push({ name: node.name, vertices: positions.count, triangles: count, vertexColors: Boolean(geometry.attributes.color) });
});
const bounds = new THREE.Box3().setFromObject(gltf.scene);
const size = bounds.getSize(new THREE.Vector3());
assert.ok([...bounds.min.toArray(), ...bounds.max.toArray(), ...size.toArray()].every(Number.isFinite));
assert.ok(meshCount > 0 && colorMeshes > 0);
assert.equal(decodedImages.length, 3, 'Three original embedded maps');
assert.ok(decodedImages.every(image => image.width === 2048 && image.height === 2048));
assert.ok(bounds.min.y >= -0.0001 && bounds.min.y < 0.02, 'Feet near Y=0');
assert.ok(bounds.max.y <= 1.07, 'Crest height within review envelope');
assert.ok(bounds.max.z > .80 && bounds.max.z < .90, 'Muzzle forward +Z');
assert.ok(bounds.min.z < -.95 && bounds.min.z > -1.10, 'Tail behind -Z');
assert.ok(triangles < 80000, 'Art-review geometry budget');
const result = {
  passed: true, sourceSha256, validatedAt: new Date().toISOString(), threeRevision: THREE.REVISION, node: process.version,
  source: 'assets/characters/salamander/salamander-preview.glb', bytes: bytes.length,
  meshPrimitives: meshCount, triangles, positionVertices, colorMeshes, materials: [...materials],
  boundsGltf: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() },
  animations: gltf.animations.length, decodedImages,
  note: 'GLTFLoader.parseAsync measured in Node, not a browser render, FPS or draw-call measurement.',
  details,
};
await writeFile(new URL('../../docs/r1b/v2/three-validation.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, details: undefined }, null, 2));
const geometries = new Set(), materialObjects = new Set();
gltf.scene.traverse(o => {
  if (o.isMesh) {
    geometries.add(o.geometry);
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materialObjects.add(m));
  }
});
for (const geometry of geometries) geometry.dispose();
const textures = new Set();
for (const material of materialObjects) {
  for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  material.dispose();
}
for (const texture of textures) { texture.dispose(); texture.image?.close?.(); }
console.log('PASS: static GLB loaded by Three.js; resources released.');
} catch (error) {
  await writeFile(reportUrl, JSON.stringify({ passed: false, sourceSha256, validatedAt: new Date().toISOString(), error: String(error) }, null, 2) + '\n');
  throw error;
}
