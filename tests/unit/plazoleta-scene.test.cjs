"use strict";

/**
 * Composición de escena y presupuesto de dibujo (M2 / Cali Viva POC).
 *
 * Estos tests construyen el grafo de escena REAL en Node (sin GPU ni DOM):
 * verificación objetiva de draw calls, materiales, geometrías y triángulos.
 * Además comprueban la licencia de assets y la ausencia de recursos de terceros.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

let THREE;
let props;
let characters;
let mapModule;
let map;

test.before(async () => {
  // Se importa el MISMO build vendorizado que usa la página (misma instancia de three).
  THREE = await import("../../js/vendor/three/three.module.min.mjs");
  props = await import("../../js/world/plazoleta/props.mjs");
  characters = await import("../../js/world/plazoleta/characters.mjs");
  mapModule = await import("../../js/world/plazoleta/map-v1.mjs");
  map = mapModule.PLAZOLETA_MAP;
});

const ROOT = path.resolve(__dirname, "../..");

test("geometría: mergeGeometries fusiona índices y atributos correctamente", async () => {
  const utils = await import("../../js/world/plazoleta/geometry-utils.mjs");
  const merged = utils.mergeGeometries([
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.BoxGeometry(1, 1, 1),
  ]);
  assert.equal(merged.attributes.position.count, 72);
  assert.equal(merged.index.count, 108);
  assert.ok(merged.attributes.normal && merged.attributes.uv);
  assert.ok(merged.boundingSphere);
});

test("escena: el grafo construido respeta el presupuesto de dibujo", () => {
  const scene = new THREE.Scene();
  const materials = props.createMaterialLibrary();
  const textures = props.createCanvasTextures();
  assert.equal(textures.available, false, "en Node no hay DOM: las texturas deben ser nulas");

  const built = props.buildStaticScene({ scene, map, materials, textures, quality: "high" });
  const { stats } = built;

  assert.ok(stats.drawCalls >= 30, `muy pocos draws, ¿falta escena? ${stats.drawCalls}`);
  assert.ok(stats.drawCalls <= 44, `pase principal de props excedido: ${stats.drawCalls} > 44`);
  assert.equal(stats.instanced, 14, `se esperan 14 mallas instanciadas, hay ${stats.instanced}`);
  assert.ok(stats.uniqueMaterials <= 22, `demasiados materiales únicos: ${stats.uniqueMaterials}`);
  assert.ok(stats.triangles < 90000, `triángulos excesivos: ${stats.triangles}`);

  // Evidencia de instancing: muchas instancias renderizadas en pocas llamadas.
  const totalInstances = map.propFamilies.reduce((sum, family) => sum + family.instances.length, 0);
  assert.ok(totalInstances >= 60, `pocas instancias de props: ${totalInstances}`);
  assert.ok(
    stats.instanced <= 15,
    `demasiadas mallas para props repetidos: ${stats.instanced} (familias: ${map.propFamilies.length})`
  );
  assert.ok(
    totalInstances / stats.instanced > 4,
    `las instancias deberían agruparse: ${totalInstances} instancias en ${stats.instanced} draws`
  );
  assert.ok(
    stats.uniqueGeometries <= stats.drawCalls,
    `geometrías (${stats.uniqueGeometries}) > draws (${stats.drawCalls}): falta reutilización`
  );

  const plannedProps = mapModule.plannedDrawCalls() - map.drawBudget.characters.salamander - map.drawBudget.characters.lucia;
  assert.ok(
    stats.drawCalls <= plannedProps + 6,
    `el build real (${stats.drawCalls}) excede el plan de props (${plannedProps})`
  );

  // El voladizo del techo y el tablero del puente deben existir a la altura declarada.
  const roof = built.group.getObjectByName("facade-roof");
  const bridge = built.group.getObjectByName("bridge-deck");
  assert.ok(roof && bridge, "faltan grupos estructurales (techo o puente)");
  const roofBox = roof.geometry.boundingBox;
  const bridgeBox = bridge.geometry.boundingBox;
  assert.ok(roofBox.max.y > 8.8, `el techo no llega a la altura esperada: ${roofBox.max.y}`);
  assert.ok(bridgeBox.max.y > 2.3 && bridgeBox.max.y < 2.6, `pretiles fuera de rango: ${bridgeBox.max.y}`);

  built.dispose();
  materials.dispose();
  assert.throws(() => materials.get("stone"), /material desconocido/);
});

test("escena: los personajes respetan su presupuesto de draw calls", () => {
  const materials = characters.createCharacterMaterials();
  assert.equal(materials.count(), 6, "materiales de personajes compartidos");

  const salamander = characters.createSalamanderRig(materials);
  const lucia = characters.createLuciaRig(materials);

  let salamanderMeshes = 0;
  salamander.root.traverse((object) => { if (object.isMesh) salamanderMeshes++; });
  let luciaMeshes = 0;
  lucia.root.traverse((object) => { if (object.isMesh) luciaMeshes++; });

  assert.equal(salamanderMeshes, map.drawBudget.characters.salamander, `Salamander: ${salamanderMeshes} mallas`);
  assert.equal(luciaMeshes, map.drawBudget.characters.lucia, `Lucía: ${luciaMeshes} mallas`);

  // Los rigs se animan desde el estado de simulación sin asignar objetos nuevos.
  const fakePlayer = { x: 0, feetY: 0, z: 0, heading: 0, phase: 1.2, locomotion: "walk", speed: 2.5 };
  characters.updateSalamanderRig(salamander, fakePlayer, 1 / 60, { interactionHeading: 0.3 });
  assert.ok(salamander.root.rotation.y === 0);
  assert.ok(salamander.parts.bodyPivot.position.y !== 0, "la animación debe mover el cuerpo");
  const fakeNpc = { x: 0, y: 0, z: 0, heading: 1, phase: 0.5, alert: 1 };
  characters.updateLuciaRig(lucia, fakeNpc, 1 / 60, {});
  assert.ok(lucia.parts.armPivots[1].rotation.z < -1, "el brazo debe saludar con alerta alta");

  materials.dispose();
});

test("escena: no se carga ningún recurso de terceros en el POC (solo three vendorizado)", () => {
  const html = fs.readFileSync(path.join(ROOT, "plazoleta.html"), "utf8");
  for (const host of ["cdnjs", "unpkg", "jsdelivr", "googleapis"]) {
    assert.ok(!html.includes(host), `plazoleta.html referencia un origen externo: ${host}`);
  }
  // Nada de src/href/import hacia orígenes remotos (el favicon data: sí está permitido).
  assert.ok(!/\s(?:src|href)\s*=\s*["']https?:/i.test(html), "plazoleta.html carga un recurso remoto");
  assert.ok(!/from\s+["']https?:/i.test(html), "plazoleta.html importa desde una URL absoluta");
  // Sin scripts inline ni mapa de importaciones: la página funciona con CSP estricta `script-src 'self'`.
  assert.ok(!/<script[^>]*type=["']importmap["']/i.test(html), "no debe depender de un importmap inline (CSP lo bloquea)");
  assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/i.test(html), "no debe haber scripts inline");
  assert.ok(html.includes("/js/world/plazoleta/boot-guard.mjs"), "debe usar el arranque con guardia");

  // El vendorizado se importa por ruta relativa desde los módulos del POC.
  const sources = fs.readdirSync(path.join(ROOT, "js/world/plazoleta"));
  let vendoredImports = 0;
  for (const file of sources) {
    const source = fs.readFileSync(path.join(ROOT, "js/world/plazoleta", file), "utf8");
    for (const host of ["cdnjs", "unpkg", "jsdelivr"]) {
      assert.ok(!source.includes(host), `${file} referencia ${host}`);
    }
    assert.ok(!/from\s+["']https?:/.test(source), `${file} importa desde una URL absoluta`);
    assert.ok(!/from\s+["']three["']/.test(source), `${file} usa el especificador desnudo 'three' (requiere importmap)`);
    if (source.includes("../../vendor/three/three.module.min.mjs")) vendoredImports++;
  }
  assert.ok(vendoredImports >= 3, `se esperan varios módulos importando el vendorizado, hay ${vendoredImports}`);
});

test("licencias: los assets del POC están registrados", () => {
  const licensePath = path.join(ROOT, "docs/ASSET_LICENSES.md");
  assert.ok(fs.existsSync(licensePath), "falta docs/ASSET_LICENSES.md");
  const license = fs.readFileSync(licensePath, "utf8");
  assert.match(license, /MIT/, "debe registrar la licencia MIT de three.js");
  assert.match(license, /three@0\.160\.1/, "debe fijar la versión vendorizada");
  assert.match(license, /procedural|generad[oa] por código/i, "debe declarar el arte procedural propio");
  assert.ok(fs.existsSync(path.join(ROOT, "js/vendor/three/LICENSE")), "falta la licencia vendorizada de three");
});
