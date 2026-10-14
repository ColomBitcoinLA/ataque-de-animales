/**
 * Definiciones canónicas de especies predeterminadas de Animal Combat (M1-A).
 * Representa las tres criaturas base (Neptuno, Tierrudo, Salamander) bajo el
 * nuevo modelo SpeciesDefinition puro, preservando los datos de juego existentes
 * y absteniéndose de inventar nombres de habilidades no existentes en legacy.
 */

import { SpeciesDefinition } from "./SpeciesDefinition.mjs";
import { SPECIES_DEFAULT_AFFINITIES } from "../rules/index.mjs";

export const neptunoSpecies = new SpeciesDefinition({
  speciesId: "neptuno",
  displayName: "Neptuno",
  category: "PET",
  affinity: SPECIES_DEFAULT_AFFINITIES.Neptuno,
  baseStats: {
    health: 3,
  },
  abilities: [
    { id: "botonAgua" },
    { id: "botonAgua" },
    { id: "botonAgua" },
    { id: "botonTierra" },
    { id: "botonFuego" },
  ],
  movementProfile: {
    baseSpeed: 180,
  },
});

export const tierrudoSpecies = new SpeciesDefinition({
  speciesId: "tierrudo",
  displayName: "Tierrudo",
  category: "PET",
  affinity: SPECIES_DEFAULT_AFFINITIES.Tierrudo,
  baseStats: {
    health: 3,
  },
  abilities: [
    { id: "botonTierra" },
    { id: "botonTierra" },
    { id: "botonTierra" },
    { id: "botonAgua" },
    { id: "botonFuego" },
  ],
  movementProfile: {
    baseSpeed: 180,
  },
});

export const salamanderSpecies = new SpeciesDefinition({
  speciesId: "salamander",
  displayName: "Salamander",
  category: "PET",
  affinity: SPECIES_DEFAULT_AFFINITIES.Salamander,
  baseStats: {
    health: 3,
  },
  abilities: [
    { id: "botonFuego" },
    { id: "botonFuego" },
    { id: "botonFuego" },
    { id: "botonTierra" },
    { id: "botonAgua" },
  ],
  movementProfile: {
    baseSpeed: 180,
  },
});

export function getDefaultSpeciesDefinitions() {
  return {
    neptuno: neptunoSpecies,
    tierrudo: tierrudoSpecies,
    salamander: salamanderSpecies,
    list: [neptunoSpecies, tierrudoSpecies, salamanderSpecies],
  };
}
