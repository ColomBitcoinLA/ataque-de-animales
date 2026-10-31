import { getDefaultSpeciesDefinitions } from "../js/domain/index.mjs";

export function loadDomainSpeciesIds() {
  const defs = getDefaultSpeciesDefinitions();
  return defs.list.map((species) => species.speciesId).sort();
}

export function domainContractSnapshot() {
  const defs = getDefaultSpeciesDefinitions();
  return defs.list.map((species) => Object.freeze({
    speciesId: species.speciesId,
    displayName: species.displayName,
    affinity: species.affinity,
  }));
}
