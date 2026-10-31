import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

/**
 * Resolve a path that must stay inside an authorized root.
 * Follows symlinks of existing parents so a link cannot redirect writes outside.
 */
export function resolveAuthorizedDir(rootDir, requested, { create = true } = {}) {
  const root = resolve(rootDir);
  if (create) mkdirSync(root, { recursive: true });
  const rootReal = realpathSync(root);
  const target = resolve(requested);

  let resolved;
  if (existsSync(target)) {
    resolved = realpathSync(target);
  } else {
    const parent = dirname(target);
    const parentReal = existsSync(parent) ? realpathSync(parent) : parent;
    resolved = join(parentReal, basename(target));
  }

  const rel = relative(rootReal, resolved);
  if (rel === "") return resolved;
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`OUTSIDE_AUTHORIZED_DIR: ${resolved} is outside ${rootReal}`);
  }
  return resolved;
}
