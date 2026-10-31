import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSchema } from "./core/schema.mjs";
import { listJsonFiles } from "./core/fsutil.mjs";
import { idErrors } from "./core/ids.mjs";

const SCHEMA_URL = new URL("./schemas/world-asset.schema.json", import.meta.url);

export function loadWorldAssets(dir) {
  const schema = JSON.parse(readFileSync(SCHEMA_URL, "utf8"));
  const assets = [];
  const errors = [];
  for (const file of listJsonFiles(dir)) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    for (const err of validateSchema(data, schema, `world:${file}`)) errors.push(err);
    assets.push({ ...data, __file: file });
  }
  return { assets, errors };
}

export function validateWorldAsset(asset, { artBible } = {}) {
  const errors = [];
  const add = (path, message, code = "WORLD_ASSET") => errors.push({ code, path, message });

  for (const err of idErrors(asset.assetId, "world.assetId")) errors.push(err);

  const dims = Object.values(asset.dimensions);
  if (dims.some((v) => !(v > 0))) add("world.dimensions", "all dimensions must be positive", "WORLD_DIMENSIONS");
  for (const material of asset.materials) {
    if (artBible && !artBible.materials?.[material]) add("world.materials", `unknown material ${material}`, "WORLD_MATERIAL");
  }

  if (!asset.lods.some((lod) => lod.level === 0)) add("world.lods", "must include LOD level 0", "WORLD_LOD_ZERO");
  const levels = new Set();
  let previous = Infinity;
  for (const lod of [...asset.lods].sort((a, b) => a.level - b.level)) {
    if (levels.has(lod.level)) add("world.lods", `duplicate LOD level ${lod.level}`, "WORLD_LOD_DUPLICATE");
    levels.add(lod.level);
    if (lod.triangles > previous) add("world.lods", "triangle count must decrease as LOD level increases", "WORLD_LOD_ORDER");
    previous = lod.triangles;
  }
  const base = asset.lods.find((lod) => lod.level === 0);
  if (base && artBible?.budgets?.web?.maxTriangles && base.triangles > artBible.budgets.web.maxTriangles) {
    add("world.lods[0].triangles", `exceeds web budget ${artBible.budgets.web.maxTriangles}`, "WORLD_BUDGET");
  }

  if (asset.collision.type !== "none") {
    if (!Array.isArray(asset.collision.size) || asset.collision.size.some((v) => !(v >= 0))) add("world.collision.size", "collision size must be non-negative", "WORLD_COLLISION");
  }
  if (!asset.provenance.origin || !asset.provenance.license) add("world.provenance", "origin and license are required", "WORLD_PROVENANCE");
  return errors;
}

export function verifyAssetFiles(assets, root) {
  const errors = [];
  for (const asset of assets) {
    const model = asset.files?.model;
    if (model) {
      try {
        readFileSync(join(root, model));
      } catch {
        errors.push({ code: "WORLD_FILE_MISSING", path: `world.${asset.assetId}.files.model`, message: `missing ${model}` });
      }
    }
    for (const texture of asset.files?.textures || []) {
      try {
        readFileSync(join(root, texture));
      } catch {
        errors.push({ code: "WORLD_TEXTURE_MISSING", path: `world.${asset.assetId}.files.textures`, message: `missing ${texture}` });
      }
    }
  }
  return errors;
}
