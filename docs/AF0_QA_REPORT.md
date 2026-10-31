# AF-0 — Informe de QA, seguridad y entrega

**Estado:** `AF-0 READY FOR REVIEW` (Draft PR)
**Rama:** `feat/af-0-animal-forge-core` · **Worktree:** `ataque-de-animales-af` · **Base:** `7279aa4`
**Node/pnpm:** 24.18.0 / 12.3.4 · **Blender:** 5.2

## 1. Aislamiento

| Comprobación | Resultado |
|---|---|
| Worktree separado del arte H3-C | OK |
| Rama nueva desde base M1/M2 | OK (`7279aa4`) |
| H3-C, V1/V2, `clay-*.png` | Intactos |
| Dominio, simulación, runtime, combate | Sin cambios |
| Push / merge | Push normal de la rama; **sin merge**; Draft PR |

## 2. Dependencias

| Antes | Después | Motivo |
|---|---|---|
| `express@5.2.1` | `express@5.3.0` | Actualización mínima dentro de `^5.2.1` |
| `body-parser@2.2.2` | `body-parser@2.4.0` | Corrige `GHSA-27r3-jxmh-p828` (high) |
| `qs@6.15.1` | `qs@6.17.1` | Corrige advisories de `qs` (DoS) |

- Actualización por resolución normal de pnpm (`pnpm up express`); sin overrides.
- `pnpm-lock.yaml` regenerado por pnpm, no editado a mano.
- `pnpm install --frozen-lockfile`: OK.
- `pnpm audit --audit-level low`: **0 vulnerabilidades**.
- Árbol instalado: solo `body-parser@2.4.0` y `qs@6.17.1`; paquetes huérfanos purgados con `pnpm prune`.

## 3. Resultados

| Gate | Resultado |
|---|---|
| `pnpm test` | **153/153 pass** (124 base + 29 AF) |
| `pnpm check` | **66 Node/CJS/MJS + 5 browser ESM OK** |
| `pnpm gate:m0` | **13/13 checks OK** |
| `pnpm audit --audit-level low` | **0 vulnerabilidades** |
| `node forge/cli.mjs validate` | OK — 1 arquetipo, 2 especies, 2 variantes, 1 evolución, 4 assets |
| `inspect salamander.v3` | 1.845 m; `publishable=false`; `adapter.discrepancies=0` |
| `build-reference` | `blockoutHash cbc2f0c6…`, determinista |
| `render-preview` | Blender 5.2 generó PNG/BLEND/GLB |
| `verify-assets` | OK, 6 assets |
| Path traversal (`--out` fuera de `forge/out`) | **Bloqueado**, exit 2, sin archivo creado |

## 4. Pruebas de seguridad añadidas

- **Dependencia:** `body-parser` ≥2.4.0 (falla si vuelve a una versión vulnerable).
- **Cuerpo comprimido:** gzip válido llega a la ruta (401); gzip con bytes extra se maneja en <3 s y el servidor sigue sano.
- **Path traversal:** `resolveAuthorizedDir` rechaza `..` y symlinks; CLI no escribe fuera de `forge/out`.
- **Manifiesto aprobado:** `APPROVED` exige entrada en `approval-lock.json`; cambiar el manifiesto sin actualizar el lock produce `APPROVAL_LOCK_MISMATCH`.
- **Hash independiente de ruta:** copiar los fixtures a otro directorio produce el mismo `sourceHash`.
- **DRAFT no publicable:** todas las medidas correctas + `DRAFT` → `publishable=false`.
- **Aprobación sin evidencia:** `APPROVED` sin aprobador/fecha/evidencia → error.
- **Variante inmutable:** override de `face.eye.integrated` → rechazo.
- **Evolución cíclica:** A→B→A → `EVOLUTION_CYCLE`.

## 5. Auditoría de código AF

| Área | Resultado |
|---|---|
| Art Bible/esquemas | Validados con un validador propio, sin dependencias |
| Arquetipo cuadrúpedo | Rangos coherentes; identidad y política de variantes |
| Species Registry | Enlace por `speciesId`; sin Three.js; medidas y procedencia |
| Variantes/evoluciones | Overrides permitidos, rasgos preservados, DAG |
| World Registry | Categorías, LOD, colisión, materiales, licencia |
| CLI | Exit codes 0/1/2/3; salida restringida a `forge/out` |
| Adaptador H3-C | Recalcula 1.845 m; detecta 1.865 como drift |
| Hashes | Canónicos, sin ruta local; manifiesto con SHA-256 |
| Determinismo | Dos builds → mismo `blockoutHash` |
| Blender | Exporta `.blend`, `.glb` y render técnico |
| Secretos/rutas | Sin secretos ni rutas absolutas en entregables |
| CI | Fixtures H3-C **rastreados** en `forge/fixtures/`; el pipeline no depende de archivos no rastreados |

## 6. Limitaciones

- `salamander.v3` sigue `DRAFT` y sin modelo publicable; no hay aprobación artística.
- Solo cuadrípedo; sin rig, UV, animación ni modelo final.
- El approval lock protege contra cambios silenciosos, pero no es una firma criptográfica: un cambio coordinado de manifiesto y lock sigue siendo posible y requiere revisión.
- El blockout es una verificación de primitivas, no arte final.
- La CI remota se evalúa tras el push; no se afirma aprobada antes de ejecutarse.

## 7. Archivos del hardening

```
package.json / pnpm-lock.yaml        express 5.3.0, body-parser 2.4.0, qs 6.17.1
forge/core/paths.mjs                 resolución segura de directorios
forge/cli.mjs                        salida restringida a forge/out
forge/species-registry.mjs           approval lock + hash de manifiesto
forge/pipeline.mjs                   validación del lock
forge/data/approval-lock.json        manifiestos aprobados (vacío hoy)
tests/integration/body-parser-compressed.test.cjs
tests/unit/forge-core.test.cjs       lock y no-publicación
tests/unit/forge-cli.test.cjs        traversal y salida autorizada
tests/unit/forge-registry.test.cjs   hash independiente de ruta
docs/AF0_SECURITY_REVIEW.md
```

## 8. Conclusión

Los gates locales están verdes, la vulnerabilidad high está corregida y el camino de publicación está restringido. Queda pendiente la ejecución de CI remoto sobre el commit final.
