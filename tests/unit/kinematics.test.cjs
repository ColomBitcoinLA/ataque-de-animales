"use strict";

/**
 * Paridad cinemática entre modos (M2 / Cali Viva POC).
 *
 * Objetivo: demostrar que el modo clásico (2D, píxeles) y el mundo (x/z, metros)
 * comparten UNA sola aritmética de movimiento (js/simulation/kinematics.mjs)
 * y que ninguno de los dos introdujo una segunda verdad.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

let kinematics;
let MovementSystem;
let worldCore;

test.before(async () => {
  kinematics = await import("../../js/simulation/kinematics.mjs");
  ({ MovementSystem } = require("../../js/simulation/index.cjs"));
  worldCore = await import("../../js/world/world-core.mjs");
});

const EPS = 1e-9;

test("kinematics: clásico y mundo usan la misma fórmula de integración", () => {
  const cases = [
    { position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 }, speed: 180, dt: 1 / 60 },
    { position: { x: 123.5, y: 77.25 }, velocity: { x: -1, y: 0.5 }, speed: 13, dt: 0.25 },
    { position: { x: -40, y: 40 }, velocity: { x: 0, y: 0 }, speed: 7, dt: 0.5 },
    { position: { x: 1e6, y: 1e6 }, velocity: { x: 1, y: -1 }, speed: 0.001, dt: 0.016 },
  ];
  for (const c of cases) {
    const shared = kinematics.integrateVelocity(c.position, c.velocity, c.speed, c.dt);
    const classic = MovementSystem.calculateNextPosition(c.position, c.velocity, c.speed, c.dt);
    assert.ok(Math.abs(shared.x - classic.x) < EPS, `x: ${shared.x} != ${classic.x}`);
    assert.ok(Math.abs(shared.y - classic.y) < EPS, `y: ${shared.y} != ${classic.y}`);
  }
});

test("kinematics: el mundo (x/z) integra con la misma fórmula que el clásico (x/y)", () => {
  const speed = 3.4;
  const dt = 0.05;
  const direction = { x: 0.6, z: -0.8 };
  const magnitude = Math.hypot(direction.x, direction.z);
  const classicEquivalent = kinematics.integrateVelocity(
    { x: 2, y: 5 },
    { x: direction.x / magnitude, y: direction.z / magnitude },
    speed,
    dt
  );
  const world = kinematics.integrateDirected({ x: 2, z: 5 }, direction, speed, dt);
  assert.ok(Math.abs(classicEquivalent.x - world.x) < EPS);
  assert.ok(Math.abs(classicEquivalent.y - world.z) < EPS);
});

test("kinematics: el mundo normaliza diagonales (velocidad constante en toda dirección)", () => {
  const cardinal = kinematics.integrateDirected({ x: 0, z: 0 }, { x: 1, z: 0 }, 10, 0.1);
  const diagonal = kinematics.integrateDirected({ x: 0, z: 0 }, { x: 1, z: 1 }, 10, 0.1);
  const dCardinal = Math.hypot(cardinal.x, cardinal.z);
  const dDiagonal = Math.hypot(diagonal.x, diagonal.z);
  assert.ok(Math.abs(dCardinal - dDiagonal) < EPS, "diagonal no debe ser más rápida");
  assert.ok(Math.abs(dDiagonal - 1) < EPS);
});

test("kinematics: el recorte clásico replica exactamente MovementSystem.clampToBounds", () => {
  const bounds = { width: 800, height: 600 };
  const dims = { ancho: 80, alto: 80 };
  const probes = [-500, 0, 1, 359.9, 719.9, 720, 720.1, 5e4, Number.MIN_VALUE];
  for (const value of probes) {
    const classic = MovementSystem.clampToBounds({ x: value, y: value }, bounds, dims);
    const shared = kinematics.clampToMapDimensions(
      { x: value, y: value },
      { mapW: bounds.width, mapH: bounds.height, entityW: dims.ancho, entityH: dims.alto }
    );
    assert.equal(shared.x, classic.x, `x=${value}`);
    assert.equal(shared.y, classic.y, `y=${value}`);
  }
});

test("kinematics: el recorte degradado (mapa menor que la entidad) coincide con el clásico", () => {
  const classic = MovementSystem.clampToBounds({ x: 50, y: 50 }, { width: 40, height: 40 }, { ancho: 80, alto: 80 });
  const shared = kinematics.clampToMapDimensions({ x: 50, y: 50 }, { mapW: 40, mapH: 40, entityW: 80, entityH: 80 });
  assert.deepEqual(shared, classic);
  assert.deepEqual(shared, { x: 0, y: 0 });
});

test("kinematics: world-core.advance() delega en las primitivas compartidas", () => {
  const area = {
    minX: -worldCore.WORLD_LIMIT,
    maxX: worldCore.WORLD_LIMIT,
    minZ: -worldCore.WORLD_LIMIT,
    maxZ: worldCore.WORLD_LIMIT,
  };
  const cases = [
    { position: { x: 0, z: 0 }, direction: { x: 1, z: 1 }, speed: 10, dt: 0.1 },
    { position: { x: 20, z: -13 }, direction: { x: -0.3, z: 0.9 }, speed: 7, dt: 1 / 60 },
    { position: { x: 48, z: 0 }, direction: { x: 1, z: 0 }, speed: 13, dt: 0.1 },
  ];
  for (const c of cases) {
    const legacy = worldCore.advance(c.position, c.direction, c.speed, c.dt);
    const shared = kinematics.advanceDirected({
      position: c.position,
      direction: c.direction,
      speed: c.speed,
      dt: c.dt,
      solids: worldCore.SOLID_OBJECTS,
      area,
      radius: worldCore.PLAYER_RADIUS,
    });
    assert.ok(Math.abs(legacy.x - shared.x) < EPS, `x ${legacy.x} != ${shared.x}`);
    assert.ok(Math.abs(legacy.z - shared.z) < EPS, `z ${legacy.z} != ${shared.z}`);
  }
});

test("kinematics: la semántica de deslizamiento (slide) es la misma en ambos modos", () => {
  const obstacle = [{ minX: 1, maxX: 4, minZ: -2, maxZ: 2 }];
  const legacy = worldCore.advance({ x: 0, z: 0 }, { x: 1, z: 1 }, 10, 0.1, obstacle);
  assert.equal(legacy.x, 0, "el eje X queda bloqueado");
  assert.ok(legacy.z > 0, "el eje Z desliza");
  const shared = kinematics.slideStep({ x: 0, z: 0 }, { x: Math.SQRT1_2, z: Math.SQRT1_2 }, (x, z) =>
    !kinematics.canOccupy(x, z, worldCore.PLAYER_RADIUS, obstacle, null)
  );
  assert.equal(shared.blockedX, true);
  assert.equal(shared.blockedZ, false);
  assert.ok(shared.z > 0);
});

test("kinematics: rechaza entradas corruptas sin coercionar en silencio", () => {
  assert.throws(() => kinematics.integrateVelocity({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, NaN), TypeError);
  assert.throws(() => kinematics.integrateVelocity({ x: 0, y: 0 }, { x: 1, y: 0 }, -1, 0.1), RangeError);
  assert.throws(() => kinematics.integrateDirected({ x: 0, z: 0 }, { x: NaN, z: 0 }, 10, 0.1), TypeError);
  assert.throws(() => kinematics.clampToArea({ x: 0, z: 0 }, { minX: 0, maxX: NaN, minZ: 0, maxZ: 1 }), TypeError);
  assert.equal(kinematics.canOccupy(NaN, 0, 1), false);
});

test("kinematics: la dirección nula o dt=0 no desplazan (y no lanzan)", () => {
  assert.deepEqual(kinematics.integrateDirected({ x: 3, z: 4 }, { x: 0, z: 0 }, 10, 0.1), { x: 3, z: 4 });
  assert.deepEqual(kinematics.integrateDirected({ x: 3, z: 4 }, { x: 1, z: 0 }, 10, 0), { x: 3, z: 4 });
});
