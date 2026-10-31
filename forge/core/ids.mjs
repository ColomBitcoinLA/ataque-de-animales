/** Stable identifiers for Animal Forge. */
export const ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/;

export function isValidId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

export function normalizeId(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function idErrors(value, path = "$") {
  if (!isValidId(value)) {
    return [{ code: "ID_INVALID", path, message: `invalid stable id: ${JSON.stringify(value)}` }];
  }
  return [];
}
