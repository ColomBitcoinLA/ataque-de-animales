/**
 * Barrel export para la capa de compatibilidad legacy (M1-B).
 */

export { resolveLegacySpecies, LEGACY_SPECIES_MAP } from "./speciesResolver.mjs";
export {
  LegacyAnimalAdapter,
  generateCompatId,
  resetCompatIdCounter,
} from "./LegacyAnimalAdapter.mjs";
