/**
 * speciesResolver: Mapeador canónico de especies legacy hacia SpeciesDefinition (M1.5).
 * 
 * Reglas:
 * - Mapea "Neptuno", "Tierrudo", "Salamander" a neptunoSpecies, tierrudoSpecies, salamanderSpecies.
 * - Centraliza la resolución para no duplicar cadenas frágiles.
 * - Falla predeciblemente si la especie no es reconocida.
 */

import {
  neptunoSpecies,
  tierrudoSpecies,
  salamanderSpecies,
} from "../domain/index.mjs";

export const LEGACY_SPECIES_MAP = Object.freeze({
  neptuno: neptunoSpecies,
  tierrudo: tierrudoSpecies,
  salamander: salamanderSpecies,
});

/**
 * Resuelve una SpeciesDefinition canónica a partir del nombre legacy.
 * @param {string} name
 * @returns {SpeciesDefinition}
 */
export function resolveLegacySpecies(name) {
  if (typeof name !== "string" || !name.trim()) {
    throw new TypeError("resolveLegacySpecies: el nombre de la especie debe ser una cadena no vacía.");
  }
  const key = name.trim().toLowerCase();
  const species = LEGACY_SPECIES_MAP[key];
  if (!species) {
    throw new Error(
      `resolveLegacySpecies: especie legacy desconocida '${name}'. Especies válidas: Neptuno, Tierrudo, Salamander.`
    );
  }
  return species;
}
