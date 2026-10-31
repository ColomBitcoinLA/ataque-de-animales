import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashObject, sha256Text, stableStringify } from "./core/hash.mjs";
import { ensureDir } from "./core/fsutil.mjs";

const F = (n) => {
  const value = Math.abs(n) < 1e-9 ? 0 : n;
  return value.toFixed(6);
};

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(v) {
  const len = Math.hypot(...v) || 1;
  return v.map((x) => x / len);
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function mul(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function sphere(center, radii, segments = 16, rings = 8) {
  const verts = [];
  const faces = [];
  for (let i = 0; i <= rings; i += 1) {
    const phi = (Math.PI * i) / rings;
    for (let j = 0; j < segments; j += 1) {
      const theta = (2 * Math.PI * j) / segments;
      verts.push([
        center[0] + radii[0] * Math.sin(phi) * Math.cos(theta),
        center[1] + radii[1] * Math.cos(phi),
        center[2] + radii[2] * Math.sin(phi) * Math.sin(theta),
      ]);
    }
  }
  for (let i = 0; i < rings; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = i * segments + j;
      const b = i * segments + ((j + 1) % segments);
      const c = (i + 1) * segments + ((j + 1) % segments);
      const d = (i + 1) * segments + j;
      if (i === 0) faces.push([a, c, d]);
      else if (i === rings - 1) faces.push([a, b, c]);
      else faces.push([a, b, c, d]);
    }
  }
  return { verts, faces };
}

function cylinder(p1, p2, radius, segments = 12) {
  const axis = norm(sub(p2, p1));
  const helper = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(axis, helper));
  const v = norm(cross(axis, u));
  const verts = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (2 * Math.PI * i) / segments;
    verts.push(add(p1, add(mul(u, radius * Math.cos(a)), mul(v, radius * Math.sin(a)))));
  }
  for (let i = 0; i < segments; i += 1) {
    const a = (2 * Math.PI * i) / segments;
    verts.push(add(p2, add(mul(u, radius * Math.cos(a)), mul(v, radius * Math.sin(a)))));
  }
  const c1 = verts.length;
  verts.push(p1);
  const c2 = verts.length;
  verts.push(p2);
  const faces = [];
  for (let i = 0; i < segments; i += 1) {
    const j = (i + 1) % segments;
    faces.push([i, j, segments + j, segments + i]);
    faces.push([c1, j, i]);
    faces.push([c2, segments + i, segments + j]);
  }
  return { verts, faces };
}

function cone(base, tip, radius, segments = 12) {
  const axis = norm(sub(tip, base));
  const helper = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(axis, helper));
  const v = norm(cross(axis, u));
  const verts = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (2 * Math.PI * i) / segments;
    verts.push(add(base, add(mul(u, radius * Math.cos(a)), mul(v, radius * Math.sin(a)))));
  }
  const tipIndex = verts.length;
  verts.push(tip);
  const centerIndex = verts.length;
  verts.push(base);
  const faces = [];
  for (let i = 0; i < segments; i += 1) {
    const j = (i + 1) % segments;
    faces.push([i, j, tipIndex]);
    faces.push([centerIndex, j, i]);
  }
  return { verts, faces };
}

export function buildBlockout(imported) {
  const geometry = imported.geometry;
  const primitives = geometry.ellipsoids.map((e) => ({
    id: e.id,
    type: "ellipsoid",
    center: e.center,
    radii: e.radii,
    color: geometry.palette?.[e.color] || geometry.palette?.basalt || "#2B1F1B",
  }));
  const segments = geometry.segments.map((s) => ({
    id: s.id,
    type: "capsule",
    from: s.from,
    to: s.to,
    r1: s.r1,
    r2: s.r2,
    color: geometry.palette?.basalt || "#2B1F1B",
  }));
  const tail = {
    id: "tail",
    points: geometry.tail.points,
    radii: geometry.tail.radii,
    color: geometry.palette?.basaltMid || geometry.palette?.basalt || "#2B1F1B",
  };
  const flames = imported.flames.map((f) => ({
    id: f.id,
    base: f.base,
    height: f.height,
    halfWidthZ: f.halfWidthZ,
    leanZ: f.leanZ || 0,
    color: geometry.palette?.fireMid || "#FF5A1F",
  }));
  const anchors = Object.fromEntries(Object.entries(imported.anchors).map(([k, v]) => [k, { id: k, position: v }]));
  const core = {
    schemaVersion: "1.0.0",
    blockoutId: "salamander.v3.blockout",
    speciesVisualId: "salamander.v3",
    kind: "TECHNICAL_BLOCKOUT",
    units: "m",
    orientation: { up: "+Y", forward: "+Z", groundY: 0 },
    sourceHash: imported.sourceHash,
    measurements: imported.measurements,
    primitives,
    segments,
    tail,
    flames,
    anchors,
  };
  return { ...core, blockoutHash: hashObject(core) };
}

export function blockoutToObj(spec) {
  const lines = [
    "# Animal Forge technical blockout - not a final asset",
    `# blockoutHash ${spec.blockoutHash}`,
    `# sourceHash ${spec.sourceHash}`,
    "# units: metres, +Y up, +Z forward",
  ];
  let offset = 0;
  const emit = (id, geom) => {
    lines.push(`o ${id}`);
    for (const v of geom.verts) lines.push(`v ${F(v[0])} ${F(v[1])} ${F(v[2])}`);
    for (const f of geom.faces) lines.push(`f ${f.map((i) => i + 1 + offset).join(" ")}`);
    offset += geom.verts.length;
  };
  for (const p of spec.primitives) emit(p.id, sphere(p.center, p.radii));
  for (const s of spec.segments) emit(s.id, cylinder(s.from, s.to, (s.r1 + s.r2) / 2));
  for (let i = 0; i < spec.tail.points.length - 1; i += 1) {
    emit(`${spec.tail.id}.${i + 1}`, cylinder(spec.tail.points[i], spec.tail.points[i + 1], (spec.tail.radii[i] + spec.tail.radii[i + 1]) / 2));
  }
  for (let i = 0; i < spec.tail.points.length; i += 1) emit(`${spec.tail.id}.joint.${i + 1}`, sphere(spec.tail.points[i], [spec.tail.radii[i], spec.tail.radii[i], spec.tail.radii[i]]));
  for (const flame of spec.flames) {
    const tip = [flame.base[0], flame.base[1] + flame.height, flame.base[2] + flame.leanZ];
    emit(flame.id, cone(flame.base, tip, flame.halfWidthZ));
  }
  lines.push("");
  return lines.join("\n");
}

export function writeBlockout(outDir, spec) {
  ensureDir(outDir);
  const jsonPath = join(outDir, "blockout.json");
  const objPath = join(outDir, "blockout.obj");
  const reportPath = join(outDir, "blockout-report.md");
  writeFileSync(jsonPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  const obj = blockoutToObj(spec);
  writeFileSync(objPath, obj, "utf8");
  const m = spec.measurements;
  const report = [
    "# Animal Forge - technical blockout",
    "",
    `- blockoutHash: \`${spec.blockoutHash}\``,
    `- sourceHash: \`${spec.sourceHash}\``,
    "- kind: TECHNICAL_BLOCKOUT (not a final asset, not art-approved)",
    "",
    "| Measure | Value |",
    "|---|---:|",
    `| heightM | ${m.heightM} |`,
    `| shoulderHeightM | ${m.shoulderHeightM} |`,
    `| lengthM | ${m.lengthM} |`,
    `| bodyWidthM | ${m.bodyWidthM} |`,
    `| eyeDiameterM | ${m.eyeDiameterM} |`,
    `| eyeGapM | ${m.eyeGapM} |`,
    `| tailOffsetM | ${m.tailOffsetM} |`,
    `| crestMainCount | ${m.crestMainCount} |`,
    `| feetY | ${m.feetY} |`,
    "",
    "Generated deterministically from the H3-C fixtures. No Meshy, no credits, no rig.",
  ].join("\n");
  writeFileSync(reportPath, `${report}\n`, "utf8");
  return { jsonPath, objPath, reportPath, blockoutHash: spec.blockoutHash, objHash: sha256Text(obj) };
}

export function blockoutIsDeterministic(imported) {
  const a = buildBlockout(imported);
  const b = buildBlockout(imported);
  return stableStringify(a) === stableStringify(b);
}
