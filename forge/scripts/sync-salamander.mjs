import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { importH3CSalamander, applySnapshotToSpecies } from "../adapters/h3cSalamander.mjs";
import { sha256File } from "../core/hash.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FORGE = fileURLToPath(new URL("../", import.meta.url));
const speciesFile = join(FORGE, "data/species/salamander-v3.json");
const imported = importH3CSalamander();
const current = JSON.parse(readFileSync(speciesFile, "utf8"));
const updated = applySnapshotToSpecies(current, imported);
writeFileSync(speciesFile, `${JSON.stringify(updated, null, 2)}\n`, "utf8");

const manifest = {
  schemaVersion: "1.0.0",
  files: [
    "forge/fixtures/h3c/MASTER_ANATOMY.json",
    "forge/fixtures/h3c/MASTER_CREST_MAP.json",
    "forge/fixtures/h3c/MASTER_MEASUREMENTS.json",
  ].map((path) => ({ path, sha256: sha256File(join(ROOT, path)) })),
};
writeFileSync(join(FORGE, "data/asset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  sourceHash: imported.sourceHash,
  measurements: imported.measurements,
  discrepancies: imported.discrepancies,
  ok: imported.ok,
}, null, 2));
