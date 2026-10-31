export function resultOk(extra = {}) {
  return { ok: true, errors: [], warnings: [], ...extra };
}

export function resultFail(errors, warnings = []) {
  return { ok: false, errors, warnings };
}

export function mergeResults(results) {
  const errors = results.flatMap((r) => r.errors || []);
  const warnings = results.flatMap((r) => r.warnings || []);
  return { ok: errors.length === 0, errors, warnings };
}
