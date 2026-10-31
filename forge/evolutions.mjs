import { readFileSync } from "node:fs";
import { validateSchema } from "./core/schema.mjs";
import { listJsonFiles } from "./core/fsutil.mjs";
import { idErrors } from "./core/ids.mjs";

const SCHEMA_URL = new URL("./schemas/evolution.schema.json", import.meta.url);

export function loadEvolutions(dir) {
  const schema = JSON.parse(readFileSync(SCHEMA_URL, "utf8"));
  const evolutions = [];
  const errors = [];
  for (const file of listJsonFiles(dir)) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    for (const err of validateSchema(data, schema, `evolution:${file}`)) errors.push(err);
    evolutions.push({ ...data, __file: file });
  }
  return { evolutions, errors };
}

export function detectCycles(evolutions) {
  const adjacency = new Map();
  for (const edge of evolutions) {
    if (!adjacency.has(edge.fromVisualId)) adjacency.set(edge.fromVisualId, []);
    adjacency.get(edge.fromVisualId).push(edge.toVisualId);
  }
  const state = new Map();
  const cycles = [];
  const stack = [];
  const visit = (node) => {
    state.set(node, 1);
    stack.push(node);
    for (const next of adjacency.get(node) || []) {
      if (state.get(next) === 1) {
        const start = stack.indexOf(next);
        cycles.push([...stack.slice(start), next]);
      } else if (!state.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    state.set(node, 2);
  };
  for (const node of adjacency.keys()) if (!state.has(node)) visit(node);
  return cycles;
}

export function validateEvolutions(evolutions, { speciesById, archetypes } = {}) {
  const errors = [];
  const add = (path, message, code = "EVOLUTION") => errors.push({ code, path, message });

  for (const edge of evolutions) {
    for (const err of idErrors(edge.evolutionId, `evolution.${edge.evolutionId}.evolutionId`)) errors.push(err);
    const from = speciesById?.get(edge.fromVisualId);
    const to = speciesById?.get(edge.toVisualId);
    if (!from) add(`evolution.${edge.evolutionId}.fromVisualId`, `unknown species visual ${edge.fromVisualId}`, "EVOLUTION_FROM");
    if (!to) add(`evolution.${edge.evolutionId}.toVisualId`, `unknown species visual ${edge.toVisualId}`, "EVOLUTION_TO");
    if (edge.fromVisualId === edge.toVisualId) add(`evolution.${edge.evolutionId}`, "self-evolution is a cycle", "EVOLUTION_SELF");
    if (edge.stage < 2) add(`evolution.${edge.evolutionId}.stage`, "evolution stage must be >= 2", "EVOLUTION_STAGE");

    const fromArchetype = from && archetypes?.get(from.archetypeId);
    const toArchetype = to && archetypes?.get(to.archetypeId);
    if (fromArchetype && toArchetype) {
      const compatible = fromArchetype.skeleton.compatibleWith.includes(toArchetype.family) || fromArchetype.skeleton.id === toArchetype.skeleton.id;
      if (!compatible) add(`evolution.${edge.evolutionId}`, "skeletons are not compatible", "EVOLUTION_SKELETON");
      if (edge.stage > fromArchetype.evolutionPolicy.maxStage) add(`evolution.${edge.evolutionId}.stage`, `stage exceeds maxStage ${fromArchetype.evolutionPolicy.maxStage}`, "EVOLUTION_MAX_STAGE");
      for (const trait of fromArchetype.evolutionPolicy.mustPreserve) {
        if (!edge.preservedTraits.includes(trait)) add(`evolution.${edge.evolutionId}.preservedTraits`, `evolution must preserve ${trait}`, "EVOLUTION_PRESERVE");
      }
    }
    if (!edge.provenance.origin || !edge.provenance.license) add(`evolution.${edge.evolutionId}.provenance`, "origin and license are required", "EVOLUTION_PROVENANCE");
  }

  const incoming = new Map();
  for (const edge of evolutions) {
    if (incoming.has(edge.toVisualId)) add(`evolution.${edge.evolutionId}.toVisualId`, `multiple evolutions target ${edge.toVisualId}`, "EVOLUTION_MULTI_PARENT");
    incoming.set(edge.toVisualId, edge.evolutionId);
  }

  for (const cycle of detectCycles(evolutions)) {
    add("evolutions", `cyclic lineage: ${cycle.join(" -> ")}`, "EVOLUTION_CYCLE");
  }
  return errors;
}
