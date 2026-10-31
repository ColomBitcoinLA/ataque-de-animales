# AF-0 — Revisión de seguridad

**Alcance:** rama `feat/af-0-animal-forge-core`, worktree `ataque-de-animales-af`, base `7279aa4`.
**Estado:** sin hallazgos abiertos de severidad alta/crítica. Quedan riesgos residuales documentados.

## 1. Modelo de amenaza AF-0

Activos: contratos de identidad visual, medidas, manifiestos, fixtures, blockout y el servidor Node existente.
Superficie: CLI local, pipeline de validación, adaptador de archivos, exportación Blender y dependencias HTTP.
Fuera de alcance: servicio público, autenticación de usuarios, base de datos, red y runtime del juego.

## 2. Hallazgos

| ID | Hallazgo | Severidad | Estado |
|---|---|---|---|
| F1 | `body-parser@2.2.2` vulnerable a DoS por bytes extra tras cuerpo comprimido (`GHSA-27r3-jxmh-p828`) | Alta | **Corregido** con `express@5.3.0` → `body-parser@2.4.0` |
| F2 | `--out` de la CLI aceptaba rutas arbitrarias (path traversal / sobrescritura) | Media | **Corregido**: resolución canónica y confinamiento a `forge/out` |
| F3 | Un manifiesto aprobado podía editarse sin dejar rastro | Media | **Mitigado**: `approval-lock.json` con hash del manifiesto |
| F4 | Un `APPROVED` sin evidencia humana podía parecer publicable | Alta (proceso) | **Corregido**: validación exige aprobador, fecha, evidencia y puntuación; `canPublish` lo revalida |
| F5 | El pipeline podía depender de H3-C no rastreado | Media | **Corregido**: fixtures H3-C rastreados en `forge/fixtures/h3c/` con manifiesto SHA-256 |
| F6 | Secretos o rutas locales en entregables | Alta | **Sin hallazgos**: escaneo de `D:\`, `C:\Users`, tokens y credenciales |
| F7 | Blender ausente en CI | Baja | **Manejado**: `render-preview` sale con código 3 y mensaje claro; no es requisito de CI |
| F8 | Lock no criptográfico | Baja | Aceptado y documentado: requiere revisión humana del cambio de lock |

## 3. Evidencia

### Dependencias

```
antes:  express@5.2.1 → body-parser@2.2.2 → qs@6.15.1   (1 high, 4 moderate, 1 low)
después: express@5.3.0 → body-parser@2.4.0 → qs@6.17.1  (0 vulnerabilidades)
```

- `pnpm audit --audit-level low` → `No known vulnerabilities found`.
- `pnpm install --frozen-lockfile` → OK.
- `pnpm prune` → sin copias huérfanas de `body-parser` ni `qs`.
- No se usaron `pnpm.overrides`; la actualización es resolución normal dentro de `^5.2.1`.

### Path traversal

```
node forge/cli.mjs build-reference salamander --out ../../af-escape-test
→ BLOCKED: OUTSIDE_AUTHORIZED_DIR ...
→ exit 2; el directorio no se crea.
```

`resolveAuthorizedDir` normaliza la ruta, resuelve symlinks existentes y compara con `path.relative`; rechaza `..`, rutas absolutas y enlaces que apunten fuera.

### Manifiestos

`speciesManifestHash` calcula SHA-256 canónico del manifiesto (sin `__file`). `validateApprovalLock` exige:

- `APPROVED` → entrada con hash coincidente; si no, `APPROVAL_LOCK_MISSING` o `APPROVAL_LOCK_MISMATCH`.
- No aprobado con entrada → `APPROVAL_LOCK_STALE`.

### Cuerpo comprimido

Test local contra un servidor efímero:

1. gzip válido a `/api/login` → 401 (la ruta se ejecuta).
2. gzip + bytes extra → 400/401/413, <3 s, sin caída.
3. `/health` sigue en 200.

No se atacó ningún servicio público ni producción.

### Hashes y ruta

Copiar los tres fixtures a un directorio temporal produce el mismo `sourceHash` (`0555c9cf…`); el hash depende del contenido, no de la ruta.

## 4. Riesgos residuales

1. **Lock no firmado.** Un cambio coordinado de manifiesto y lock es posible; la mitigación es revisión humana y control de cambios, no criptografía.
2. **Blender local.** El script confía en el JSON generado por AF; no se ejecuta con archivos de terceros en AF-0.
3. **Blockout no es arte final.** La validación geométrica no certifica calidad artística.
4. **Dependencias transitivas futuras.** El gate M0 debe seguir ejecutándose en cada PR.
5. **CI remoto.** Debe ejecutarse sobre el commit final antes de considerar la PR lista.

## 5. Conclusión

La vulnerabilidad alta está cerrada, la CLI no escribe fuera de su directorio autorizado, los manifiestos aprobados quedan anclados y el pipeline es independiente de archivos no rastreados. No hay secretos en los entregables.
