/**
 * Barrel export para el dominio puro de Animal Combat (M1-A).
 */

export {
  VALID_AFFINITIES,
  LIFECYCLE_STATES,
  DEFAULT_TEMPERAMENTS,
  LEGACY_ABILITY_ELEMENTS,
} from "./constants.mjs";

export {
  Identity,
  Stats,
  Traits,
  Temperament,
  Progression,
  Position,
} from "./valueObjects.mjs";

export { SpeciesDefinition } from "./SpeciesDefinition.mjs";

export { CreatureIndividual } from "./CreatureIndividual.mjs";

export {
  neptunoSpecies,
  tierrudoSpecies,
  salamanderSpecies,
  getDefaultSpeciesDefinitions,
} from "./defaultSpecies.mjs";
