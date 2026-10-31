import { readFileSync } from "node:fs";
import { validateSchema } from "./core/schema.mjs";

const SCHEMA_URL = new URL("./schemas/art-bible.schema.json", import.meta.url);

export function loadArtBible(file) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  const schema = JSON.parse(readFileSync(SCHEMA_URL, "utf8"));
  const errors = validateSchema(data, schema, "artBible");
  errors.push(...validateArtBibleSemantics(data));
  return { data, errors, ok: errors.length === 0 };
}

export function validateArtBibleSemantics(data) {
  const errors = [];
  const add = (path, message, code = "ART_BIBLE") => errors.push({ code, path, message });

  for (const [family, def] of Object.entries(data.families || {})) {
    if (!def || typeof def !== "object") add(`families.${family}`, "family must be an object");
    else if (!Array.isArray(def.anchors) || def.anchors.length === 0) add(`families.${family}.anchors`, "family needs anchors");
  }

  for (const [palette, colors] of Object.entries(data.palettes || {})) {
    if (!colors || typeof colors !== "object") {
      add(`palettes.${palette}`, "palette must be an object");
      continue;
    }
    for (const [name, hex] of Object.entries(colors)) {
      if (typeof hex !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(hex)) add(`palettes.${palette}.${name}`, "invalid hex color");
    }
  }

  for (const [material, def] of Object.entries(data.materials || {})) {
    if (typeof def.baseColor !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(def.baseColor)) add(`materials.${material}.baseColor`, "invalid hex color");
    if (!Array.isArray(def.roughness) || def.roughness.length !== 2) add(`materials.${material}.roughness`, "roughness needs [min,max]");
    else if (def.roughness[0] > def.roughness[1]) add(`materials.${material}.roughness`, "roughness min > max");
  }

  if (data.scales?.unit !== "m") add("scales.unit", "unit must be m");
  if (data.scales?.up !== "+Y") add("scales.up", "up must be +Y");
  if (data.scales?.forward !== "+Z") add("scales.forward", "forward must be +Z");
  if (data.scales?.groundY !== 0) add("scales.groundY", "ground must be Y=0");

  for (const platform of ["web", "mobile"]) {
    const budget = data.budgets?.[platform];
    if (!budget) add(`budgets.${platform}`, "missing platform budget");
    else if (!(budget.maxTriangles > 0)) add(`budgets.${platform}.maxTriangles`, "must be positive");
  }

  return errors;
}
