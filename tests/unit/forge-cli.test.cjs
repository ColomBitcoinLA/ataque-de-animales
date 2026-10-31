"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const forge = require("../../forge/index.cjs");
const ROOT = path.resolve(__dirname, "../..");
const CLI = path.join(ROOT, "forge/cli.mjs");

function run(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60000,
    ...options,
  });
}

test("CLI validate --json exits 0 with a structured report", () => {
  const result = run(["validate", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.counts.species, 2);
});

test("CLI inspect reports 1.845 m and denies publish for DRAFT", () => {
  const result = run(["inspect", "salamander.v3"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /lengthM=1\.845/);
  assert.match(result.stdout, /publishable=false/);
  assert.match(result.stdout, /adapter\.discrepancies=0/);
});

test("CLI build-reference is deterministic across two output directories", () => {
  const a = path.join(ROOT, "forge/out", `test-a-${crypto.randomUUID()}`);
  const b = path.join(ROOT, "forge/out", `test-b-${crypto.randomUUID()}`);
  try {
    const first = run(["build-reference", "salamander", "--out", a]);
    const second = run(["build-reference", "salamander", "--out", b]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    const one = JSON.parse(first.stdout);
    const two = JSON.parse(second.stdout);
    assert.equal(one.blockoutHash, two.blockoutHash);
    assert.ok(fs.existsSync(path.join(a, "blockout.json")));
    assert.ok(fs.existsSync(path.join(a, "blockout.obj")));
    assert.ok(fs.existsSync(path.join(a, "blockout-report.md")));
    const spec = JSON.parse(fs.readFileSync(path.join(a, "blockout.json"), "utf8"));
    assert.equal(spec.speciesVisualId, "salamander.v3");
    assert.equal(spec.kind, "TECHNICAL_BLOCKOUT");
  } finally {
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  }
});

test("CLI rejects output paths outside forge/out", () => {
  const escape = path.join(ROOT, "..", `af-escape-${crypto.randomUUID()}`);
  const result = run(["build-reference", "salamander", "--out", escape]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /OUTSIDE_AUTHORIZED_DIR/);
  assert.equal(fs.existsSync(escape), false);
});

test("resolveAuthorizedDir refuses traversal and accepts a child", () => {
  const root = path.join(ROOT, "forge/out");
  assert.throws(() => forge.resolveAuthorizedDir(root, path.join(root, "..", "escaped")), /OUTSIDE_AUTHORIZED_DIR/);
  const inside = forge.resolveAuthorizedDir(root, path.join(root, "child"));
  assert.ok(inside.startsWith(root));
});

test("CLI verify-assets exits 0", () => {
  const result = run(["verify-assets"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verify-assets: OK/);
});

test("CLI unknown command exits with usage code 2", () => {
  const result = run(["nope"]);
  assert.equal(result.status, 2);
});

test("CLI inspect unknown species exits 2", () => {
  const result = run(["inspect", "unknown.species"]);
  assert.equal(result.status, 2);
});

test("blockout: OBJ is deterministic, named and free of NaN", () => {
  const imported = forge.importH3CSalamander();
  const spec = forge.buildBlockout(imported);
  const obj = forge.blockoutToObj(spec);
  assert.equal(obj, forge.blockoutToObj(forge.buildBlockout(imported)));
  assert.match(obj, /^# Animal Forge technical blockout/);
  assert.match(obj, /^o head$/m);
  assert.match(obj, /^o flame\.1$/m);
  assert.doesNotMatch(obj, /NaN|Infinity/);
  assert.ok(obj.split("\n").length > 1000);
  assert.match(spec.blockoutHash, /^[0-9a-f]{64}$/);
  assert.equal(forge.blockoutIsDeterministic(imported), true);
});
