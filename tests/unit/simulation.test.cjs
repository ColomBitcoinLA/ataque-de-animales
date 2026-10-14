"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MovementSystem,
  interpolateScalar,
  interpolatePosition,
  CollisionSystem,
  DEFAULT_COLLIDER,
} = require("../../js/simulation/index.cjs");

// ============================================================================
// 1. MovementSystem Tests (M1.6)
// ============================================================================

test("MovementSystem: dt=0 produces zero displacement", () => {
  const pos = { x: 100, y: 150 };
  const vel = { x: 1, y: 0 };
  const next = MovementSystem.calculateNextPosition(pos, vel, 180, 0);

  assert.equal(next.x, 100);
  assert.equal(next.y, 150);
});

test("MovementSystem: positive movement integrates correctly", () => {
  const pos = { x: 100, y: 100 };
  const vel = { x: 1, y: 0.5 };
  const speed = 200;
  const dt = 0.5; // dt = 0.5s -> dx = 100, dy = 50

  const next = MovementSystem.calculateNextPosition(pos, vel, speed, dt);
  assert.equal(next.x, 200);
  assert.equal(next.y, 150);
});

test("MovementSystem: negative movement integrates correctly", () => {
  const pos = { x: 300, y: 250 };
  const vel = { x: -1, y: -0.5 };
  const speed = 100;
  const dt = 1;

  const next = MovementSystem.calculateNextPosition(pos, vel, speed, dt);
  assert.equal(next.x, 200);
  assert.equal(next.y, 200);
});

test("MovementSystem: diagonal movement maintains mathematical consistency", () => {
  const pos = { x: 50, y: 50 };
  const vel = { x: 1, y: 1 };
  const speed = 180;
  const dt = 0.25;

  const next = MovementSystem.calculateNextPosition(pos, vel, speed, dt);
  assert.equal(next.x, 50 + 180 * 0.25);
  assert.equal(next.y, 50 + 180 * 0.25);
});

test("MovementSystem: map boundary clamping prevents out-of-bounds positioning", () => {
  const bounds = { width: 800, height: 600 };
  const entitySize = { width: 80, height: 80 };

  // 1. Clamping en borde superior/izquierdo (negativo)
  const clampedMin = MovementSystem.clampToBounds({ x: -50, y: -20 }, bounds, entitySize);
  assert.equal(clampedMin.x, 0);
  assert.equal(clampedMin.y, 0);

  // 2. Clamping en borde inferior/derecho (mapW - ancho, mapH - alto)
  const clampedMax = MovementSystem.clampToBounds({ x: 900, y: 700 }, bounds, entitySize);
  assert.equal(clampedMax.x, 720); // 800 - 80
  assert.equal(clampedMax.y, 520); // 600 - 80
});

test("MovementSystem: updateLocal integrates, clamps and mutates position once", () => {
  const pos = {
    x: 750,
    y: 550,
    set(x, y) {
      this.x = x;
      this.y = y;
    },
  };
  const vel = { x: 1, y: 1 };
  const bounds = { width: 800, height: 600 };
  const entitySize = { ancho: 80, alto: 80 };

  const res = MovementSystem.updateLocal(pos, vel, 180, 1, bounds, entitySize);
  assert.equal(res.x, 720);
  assert.equal(res.y, 520);
  assert.equal(pos.x, 720);
  assert.equal(pos.y, 520);
});

test("MovementSystem: rejects invalid dt, speed, velocity, or bounds", () => {
  const validPos = { x: 0, y: 0 };
  const validVel = { x: 1, y: 0 };

  // dt inválido
  assert.throws(() => MovementSystem.calculateNextPosition(validPos, validVel, 180, -0.1), RangeError);
  assert.throws(() => MovementSystem.calculateNextPosition(validPos, validVel, 180, NaN), RangeError);
  assert.throws(() => MovementSystem.calculateNextPosition(validPos, validVel, 180, Infinity), RangeError);

  // speed inválido
  assert.throws(() => MovementSystem.calculateNextPosition(validPos, validVel, -10, 0.1), RangeError);
  assert.throws(() => MovementSystem.calculateNextPosition(validPos, validVel, NaN, 0.1), RangeError);

  // velocity inválida
  assert.throws(() => MovementSystem.calculateNextPosition(validPos, null, 180, 0.1), TypeError);
  assert.throws(() => MovementSystem.calculateNextPosition(validPos, { x: NaN, y: 0 }, 180, 0.1), TypeError);

  // bounds inválidos
  assert.throws(() => MovementSystem.clampToBounds(validPos, { width: 0, height: 600 }), RangeError);
  assert.throws(() => MovementSystem.clampToBounds(validPos, { width: -100, height: 600 }), RangeError);
});

test("MovementSystem: deterministic computation across multiple steps", () => {
  const pos = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
  const vel = { x: 1, y: 0 };

  for (let i = 0; i < 10; i++) {
    MovementSystem.updateLocal(pos, vel, 100, 0.1);
  }

  // 10 pasos de 10px = 100px exactos
  assert.equal(Math.round(pos.x), 100);
  assert.equal(pos.y, 0);
});

// ============================================================================
// 2. Interpolation Helper Tests (Presentation / Smoothing)
// ============================================================================

test("interpolateScalar: dt=0 returns exact current value", () => {
  const result = interpolateScalar(50, 100, 0, 12);
  assert.equal(result, 50);
});

test("interpolateScalar: advancing dt exponentially approaches target", () => {
  const mid = interpolateScalar(0, 100, 0.1, 12);
  // t = 1 - Math.exp(-1.2) ≈ 0.6988
  assert.ok(mid > 69 && mid < 71);

  const large = interpolateScalar(0, 100, 2, 12);
  // t ≈ 1 - Math.exp(-24) ≈ 1
  assert.ok(Math.abs(large - 100) < 0.0001);
});

test("interpolatePosition: updates 2D coordinates in-place if set() available", () => {
  const current = { x: 10, y: 20, set(x, y) { this.x = x; this.y = y; } };
  const target = { x: 110, y: 120 };

  interpolatePosition(current, target, 0.05, 12);
  assert.ok(current.x > 10 && current.x < 110);
  assert.ok(current.y > 20 && current.y < 120);
});

test("interpolateScalar: rejects invalid inputs", () => {
  assert.throws(() => interpolateScalar(0, 100, -1, 12), RangeError);
  assert.throws(() => interpolateScalar(0, 100, 0.1, -5), RangeError);
  assert.throws(() => interpolateScalar(NaN, 100, 0.1, 12), TypeError);
});

// ============================================================================
// 3. CollisionSystem Tests (M1.7)
// ============================================================================

test("CollisionSystem: getAabb calculates correct box with default and custom colliders", () => {
  const pos = { x: 10, y: 20 };
  const defaultBox = CollisionSystem.getAabb(pos);

  // Defaults: offsetX=25, offsetY=25, width=30, height=30
  assert.equal(defaultBox.x, 35);
  assert.equal(defaultBox.y, 45);
  assert.equal(defaultBox.width, 30);
  assert.equal(defaultBox.height, 30);
  assert.equal(defaultBox.ancho, 30);
  assert.equal(defaultBox.alto, 30);

  // Custom collider
  const customBox = CollisionSystem.getAabb(pos, { width: 50, height: 60, offsetX: 5, offsetY: 10 });
  assert.equal(customBox.x, 15);
  assert.equal(customBox.y, 30);
  assert.equal(customBox.width, 50);
  assert.equal(customBox.height, 60);
});

test("CollisionSystem: intersectsAabb detects overlap", () => {
  const a = { x: 0, y: 0, width: 30, height: 30 };
  const b = { x: 20, y: 20, width: 30, height: 30 };
  assert.equal(CollisionSystem.intersectsAabb(a, b), true);
});

test("CollisionSystem: intersectsAabb detects complete separation (no overlap)", () => {
  const a = { x: 0, y: 0, width: 30, height: 30 };
  const b = { x: 100, y: 100, width: 30, height: 30 };
  assert.equal(CollisionSystem.intersectsAabb(a, b), false);
});

test("CollisionSystem: edge-touch semantics are inclusive (touching edge returns true)", () => {
  const a = { x: 0, y: 0, width: 30, height: 30 };
  // b toca exactamente el borde derecho de a (a.x + a.w === b.x)
  const b = { x: 30, y: 0, width: 30, height: 30 };
  assert.equal(CollisionSystem.intersectsAabb(a, b), true, "Contacto exacto de borde debe retornar true");

  // Si b está a 30.001 (separado), debe retornar false
  const bSeparated = { x: 30.001, y: 0, width: 30, height: 30 };
  assert.equal(CollisionSystem.intersectsAabb(a, bSeparated), false, "Separación infinitesimal debe retornar false");
});

test("CollisionSystem: detects complete containment (inside)", () => {
  const outer = { x: 0, y: 0, width: 100, height: 100 };
  const inner = { x: 20, y: 20, width: 20, height: 20 };
  assert.equal(CollisionSystem.intersectsAabb(outer, inner), true);
  assert.equal(CollisionSystem.intersectsAabb(inner, outer), true);
});

test("CollisionSystem: handles offsets and movement-then-collision flow", () => {
  const posA = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
  const posB = { x: 60, y: 0, set(x, y) { this.x = x; this.y = y; } };

  const collider = { width: 30, height: 30, offsetX: 0, offsetY: 0 };

  // Inicialmente separados (a: 0..30, b: 60..90)
  const boxA1 = CollisionSystem.getAabb(posA, collider);
  const boxB1 = CollisionSystem.getAabb(posB, collider);
  assert.equal(CollisionSystem.intersectsAabb(boxA1, boxB1), false);

  // Mover A hacia la derecha 35 unidades (a pasa a: 35..65)
  MovementSystem.updateLocal(posA, { x: 1, y: 0 }, 35, 1);
  const boxA2 = CollisionSystem.getAabb(posA, collider);
  assert.equal(CollisionSystem.intersectsAabb(boxA2, boxB1), true, "Tras movimiento, debe colisionar con B");
});

test("CollisionSystem: rejects invalid geometry explicitly", () => {
  assert.throws(() => CollisionSystem.getAabb({ x: NaN, y: 0 }), TypeError);
  assert.throws(() => CollisionSystem.getAabb({ x: 0, y: 0 }, { width: -10 }), RangeError);
  assert.throws(() => CollisionSystem.intersectsAabb(null, { x: 0, y: 0, width: 10, height: 10 }), TypeError);
  assert.throws(() => CollisionSystem.intersectsAabb({ x: 0, y: 0, width: NaN, height: 10 }, { x: 0, y: 0, width: 10, height: 10 }), TypeError);
});
