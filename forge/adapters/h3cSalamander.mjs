import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashObject, sha256FileLF, stableStringify } from "../core/hash.mjs";

export const DEFAULT_H3C_DIR = fileURLToPath(new URL("../fixtures/h3c", import.meta.url));
const TOLERANCE_M = 0.001;

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

export function importH3CSalamander({ dir = DEFAULT_H3C_DIR } = {}) {
  const anatomyPath = join(dir, "MASTER_ANATOMY.json");
  const crestPath = join(dir, "MASTER_CREST_MAP.json");
  const measurementsPath = join(dir, "MASTER_MEASUREMENTS.json");
  const anatomy = readJson(anatomyPath);
  const crest = readJson(crestPath);
  const snapshot = readJson(measurementsPath);

  const heightM = round(Math.max(
    ...anatomy.ellipsoids.map((e) => e.center[1] + e.radii[1]),
    ...crest.tongues.map((t) => t.base[1] + t.height),
  ));
  const shoulderM = round(Math.max(...anatomy.ellipsoids.filter((e) => e.id === "torso").map((e) => e.center[1] + e.radii[1])));
  const noseZ = anatomy.anchors["nose.tip"][2];
  const tailTip = anatomy.tail.points[anatomy.tail.points.length - 1];
  const lengthM = round(noseZ - tailTip[2]);
  const torso = anatomy.ellipsoids.find((e) => e.id === "torso");
  const bodyWidthM = round(torso.radii[0] * 2);
  const eyes = anatomy.eyes;
  const eye = eyes[0];
  const eyeDiameterM = round(eye.radius * 2);
  const eyeGapM = round(Math.abs(eye.center[0] * 2) - eye.radius * 2);
  const tailOffsetM = round(tailTip[0]);
  const feetY = round(Math.min(...anatomy.ellipsoids.filter((e) => e.id.startsWith("paw.")).map((e) => e.center[1] - e.radii[1])));
  const toesPerPaw = {};
  for (const toe of anatomy.toes) {
    const key = `${toe.paw}.${toe.side}`;
    toesPerPaw[key] = (toesPerPaw[key] || 0) + 1;
  }

  const measurements = {
    heightM,
    shoulderHeightM: shoulderM,
    lengthM,
    bodyWidthM,
    eyeDiameterM,
    eyeGapM,
    tailOffsetM,
    crestMainCount: crest.count,
    toesPerPaw,
    feetY,
    up: anatomy.axes.up,
    forward: anatomy.axes.forward,
  };

  const discrepancies = [];
  const add = (code, field, expected, actual, message) => discrepancies.push({ code, field, expected, actual, message });

  const snapshotMap = {
    height_m: "heightM",
    shoulder_m: "shoulderHeightM",
    length_m: "lengthM",
    body_width_m: "bodyWidthM",
    eye_diameter_m: "eyeDiameterM",
    eye_gap_m: "eyeGapM",
    tail_offset_m: "tailOffsetM",
    feet_bottom_m: "feetY",
  };
  for (const [sourceKey, targetKey] of Object.entries(snapshotMap)) {
    if (typeof snapshot[sourceKey] !== "number") continue;
    if (Math.abs(snapshot[sourceKey] - measurements[targetKey]) > TOLERANCE_M) {
      add("SNAPSHOT_DRIFT", targetKey, measurements[targetKey], snapshot[sourceKey],
        `provided snapshot says ${snapshot[sourceKey]} m but the geometry computes ${measurements[targetKey]} m`);
    }
  }

  const contract = anatomy.contract || {};
  const rangeMap = {
    heightM: contract.height,
    shoulderHeightM: contract.shoulderHeight,
    lengthM: contract.length,
    bodyWidthM: contract.bodyWidth,
    eyeDiameterM: contract.eyeDiameter,
    eyeGapM: contract.eyeGap,
    tailOffsetM: contract.tailOffset,
  };
  for (const [metric, range] of Object.entries(rangeMap)) {
    if (!Array.isArray(range)) continue;
    if (measurements[metric] < range[0] || measurements[metric] > range[1]) {
      add("CONTRACT_RANGE", metric, range, measurements[metric], `${metric}=${measurements[metric]} is outside [${range[0]}, ${range[1]}]`);
    }
  }
  if (Array.isArray(contract.crestCount) && (crest.count < contract.crestCount[0] || crest.count > contract.crestCount[1])) {
    add("CREST_COUNT_MISMATCH", "crestMainCount", contract.crestCount, crest.count, "crest count is outside the contract");
  }

  const sourceHashes = {
    anatomy: sha256FileLF(anatomyPath),
    crest: sha256FileLF(crestPath),
    measurements: sha256FileLF(measurementsPath),
  };
  const sourceHash = hashObject({ anatomy, crest, snapshot });

  return {
    schemaVersion: "1.0.0",
    speciesId: "salamander",
    adapter: "h3c-salamander",
    status: "DRAFT",
    measurements,
    anchors: anatomy.anchors,
    crest: {
      count: crest.count,
      order: crest.order,
      ids: crest.tongues.map((t) => t.id),
      tailFlame: crest.tailFlame?.id ?? null,
    },
    geometry: {
      ellipsoids: anatomy.ellipsoids,
      segments: anatomy.segments,
      tail: anatomy.tail,
      toes: anatomy.toes,
      eyes: anatomy.eyes,
      palette: anatomy.palette,
    },
    flames: [...crest.tongues, crest.tailFlame],
    sourceHashes,
    sourceHash,
    discrepancies,
    ok: discrepancies.length === 0,
    notes: "Datos H3-C experimentales (v0.2). No son identidad artistica aprobada ni un asset publicable.",
    canonical: stableStringify({ measurements, crest: crest.count, sourceHash }),
  };
}

export function applySnapshotToSpecies(species, imported) {
  return {
    ...species,
    measurements: imported.measurements,
    measurementsSource: {
      adapter: "h3c-salamander",
      sourceHash: imported.sourceHash,
    },
  };
}
