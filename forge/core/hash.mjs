import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

export function sha256Text(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** Canonical hash for text files: line endings are normalized to LF. */
export function sha256FileLF(file) {
  return sha256Text(readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
}

export function hashObject(value) {
  return sha256Text(stableStringify(value));
}
