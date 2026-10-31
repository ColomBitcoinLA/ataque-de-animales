#!/usr/bin/env node
import { join } from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { runValidation, verifyAssets, FORGE_ROOT } from "./pipeline.mjs";
import { importH3CSalamander } from "./adapters/h3cSalamander.mjs";
import { buildBlockout, writeBlockout } from "./blockout.mjs";
import { canPublish } from "./species-registry.mjs";
import { resolveAuthorizedDir } from "./core/paths.mjs";

const ROOT = process.cwd();
const OUT_ROOT = join(FORGE_ROOT, "out");
const BLENDER_CANDIDATES = [
  process.env.BLENDER_BIN,
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe",
  "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe",
].filter(Boolean);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function printErrors(errors) {
  for (const error of errors) console.error(`  [${error.code}] ${error.path}: ${error.message}`);
}

function findBlender() {
  return BLENDER_CANDIDATES.find((candidate) => existsSync(candidate)) || null;
}

function buildSalamander(outDir) {
  const imported = importH3CSalamander({ dir: join(FORGE_ROOT, "fixtures/h3c") });
  if (!imported.ok) {
    console.error("Adapter reported discrepancies:");
    for (const d of imported.discrepancies) console.error(`  [${d.code}] ${d.field}: ${d.message}`);
    return { code: 1, imported };
  }
  const spec = buildBlockout(imported);
  const written = writeBlockout(outDir, spec);
  return { code: 0, imported, spec, written };
}

function commandValidate(args) {
  const result = runValidation({ root: ROOT });
  if (args.json) {
    console.log(JSON.stringify({ ok: result.ok, counts: result.counts, errors: result.errors, warnings: result.warnings }, null, 2));
  } else {
    console.log(`Animal Forge validate: ${result.ok ? "OK" : "FAILED"}`);
    console.log(`  archetypes=${result.counts.archetypes} species=${result.counts.species} variants=${result.counts.variants} evolutions=${result.counts.evolutions} world=${result.counts.worldAssets}`);
    if (result.errors.length) printErrors(result.errors);
  }
  return result.ok ? 0 : 1;
}

function commandInspect(id) {
  const result = runValidation({ root: ROOT });
  const species = result.data.species.get(id);
  if (!species) {
    console.error(`Unknown species visual: ${id}`);
    return 2;
  }
  console.log(`Animal Forge inspect: ${species.visualId} (${species.status})`);
  console.log(`  speciesId=${species.speciesId} archetype=${species.archetypeId} artVersion=${species.artVersion}`);
  for (const [key, value] of Object.entries(species.measurements)) {
    if (typeof value !== "object") console.log(`  ${key}=${value}`);
  }
  console.log(`  toesPerPaw=${JSON.stringify(species.measurements.toesPerPaw)}`);
  console.log(`  sourceHash=${species.measurementsSource?.sourceHash ?? "n/a"}`);
  const publish = canPublish(species, result, { root: ROOT });
  console.log(`  publishable=${publish.allowed}${publish.allowed ? "" : ` (${publish.reasons.join("; ")})`}`);
  if (species.measurementsSource?.adapter === "h3c-salamander") {
    const imported = importH3CSalamander({ dir: join(FORGE_ROOT, "fixtures/h3c") });
    console.log(`  adapter.discrepancies=${imported.discrepancies.length}`);
    for (const d of imported.discrepancies) console.log(`    [${d.code}] ${d.field}: ${d.message}`);
  }
  return 0;
}

function resolveOut(args) {
  try {
    return resolveAuthorizedDir(OUT_ROOT, args.out || join(OUT_ROOT, "salamander"));
  } catch (error) {
    console.error(`BLOCKED: ${error.message}`);
    return null;
  }
}

function commandBuild(args) {
  const id = args._[1] || "salamander";
  if (!["salamander", "salamander.v3"].includes(id)) {
    console.error(`build-reference only supports salamander in AF-0 (got ${id})`);
    return 2;
  }
  const outDir = resolveOut(args);
  if (!outDir) return 2;
  const built = buildSalamander(outDir);
  if (built.code !== 0) return built.code;
  console.log(JSON.stringify({
    ok: true,
    blockoutHash: built.spec.blockoutHash,
    sourceHash: built.spec.sourceHash,
    json: built.written.jsonPath,
    obj: built.written.objPath,
    report: built.written.reportPath,
    measurements: built.spec.measurements,
  }, null, 2));
  return 0;
}

function commandRender(args) {
  const id = args._[1] || "salamander";
  if (!["salamander", "salamander.v3"].includes(id)) {
    console.error(`render-preview only supports salamander in AF-0 (got ${id})`);
    return 2;
  }
  const outDir = resolveOut(args);
  if (!outDir) return 2;
  const built = buildSalamander(outDir);
  if (built.code !== 0) return built.code;
  const blender = findBlender();
  if (!blender) {
    console.error("BLOCKED: Blender not found. Set BLENDER_BIN or install Blender 5.x.");
    return 3;
  }
  const script = join(FORGE_ROOT, "blender/build_blockout.py");
  const result = spawnSync(blender, ["--background", "--python", script, "--", "--input", built.written.jsonPath, "--out", outDir], {
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    console.error(result.stdout?.slice(-2000) || "");
    console.error(result.stderr?.slice(-2000) || "");
    console.error(`Blender exited with ${result.status}`);
    return 3;
  }
  const preview = join(outDir, "studio-preview.png");
  if (!existsSync(preview)) {
    console.error("Blender did not produce studio-preview.png");
    return 3;
  }
  console.log(JSON.stringify({ ok: true, preview, blend: join(outDir, "blockout.blend"), glb: join(outDir, "blockout.glb") }, null, 2));
  return 0;
}

function commandVerify() {
  const result = verifyAssets({ root: ROOT });
  console.log(`Animal Forge verify-assets: ${result.ok ? "OK" : "FAILED"} (${result.checked} assets checked)`);
  if (result.errors.length) printErrors(result.errors);
  return result.ok ? 0 : 1;
}

function usage() {
  console.error("Usage: node forge/cli.mjs <validate|inspect|build-reference|render-preview|verify-assets> [options]");
  console.error("  validate [--json]");
  console.error("  inspect <speciesVisualId>");
  console.error("  build-reference <salamander> [--out <dir>]");
  console.error("  render-preview <salamander> [--out <dir>]");
  console.error("  verify-assets");
  return 2;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
let code = 2;
if (command === "validate") code = commandValidate(args);
else if (command === "inspect") code = commandInspect(args._[1] || "salamander.v3");
else if (command === "build-reference") code = commandBuild(args);
else if (command === "render-preview") code = commandRender(args);
else if (command === "verify-assets") code = commandVerify();
else code = usage();
process.exitCode = code;
