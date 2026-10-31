# AF-0 — Informe de QA y estado de entrega

**Estado:** `AF-0 READY FOR ENGINEERING REVIEW`
**Rama:** `feat/af-0-animal-forge-core` · **Worktree:** `ataque-de-animales-af` · **Base:** `7279aa4`
**Fecha:** 2026-10-30 · **Node:** 24.18.0 · **pnpm:** 12.3.4 · **Blender:** 5.2

## 1. Aislamiento

| Comprobación | Resultado |
|---|---|
| Worktree separado del arte H3-C | OK (`ataque-de-animales-af`) |
| Rama nueva desde base M1/M2 verificada | OK (`feat/af-0-animal-forge-core` ← `7279aa4`) |
| H3-C, V1/V2 y `clay-*.png` intactos | OK, no se tocaron |
| Dominio, simulación, runtime, combate | Sin cambios |
| Push / merge / PR | No realizados |

## 2. Línea base (antes de AF)

| Gate | Resultado |
|---|---|
| `pnpm test` | **124/124 pass** |
| `pnpm check` | **42 archivos Node + 5 browser ESM OK** |
| `pnpm gate:m0` | **FALLA** en el check 12 (auditoría de dependencias) |

El fallo de M0 es **preexistente** y no lo introduce AF-0: `body-parser` (vía `express`) tiene una vulnerabilidad *high* (`GHSA-27r3-jxmh-p828`); el audit reporta 6 vulnerabilidades (1 high, 4 moderate, 1 low). No se actualizó ninguna dependencia porque el alcance prohíbe cambios innecesarios y la actualización debe evaluarse aparte.

## 3. Resultados después de AF-0

| Gate | Resultado |
|---|---|
| `pnpm test` | **147/147 pass** (124 existentes + 23 nuevas) |
| `pnpm check` | **64 Node/CJS/MJS + 5 browser ESM OK** |
| `node forge/cli.mjs validate` | **OK** — 1 arquetipo, 2 especies, 2 variantes, 1 evolución, 4 assets de mundo |
| `node forge/cli.mjs inspect salamander.v3` | OK — longitud **1.845 m**, `publishable=false`, `adapter.discrepancies=0` |
| `node forge/cli.mjs build-reference salamander` | OK — `blockoutHash cbc2f0c6800f3c363346c9306df95870050e3f4f8889219552e6b41fbeb70276` |
| `node forge/cli.mjs verify-assets` | OK — 6 assets comprobados |
| `node forge/cli.mjs render-preview salamander` | OK — Blender 5.2 generó `studio-preview.png`, `.blend` y `.glb` |

## 4. Pruebas nuevas (23)

- Esquema: requeridos, enum, patrón, `additionalProperties`.
- IDs estables válidos/inválidos.
- Hash determinista e independiente del orden de claves.
- Art Bible y arquetipo cuadrúpedo; medidas válidas y fuera de rango.
- Pipeline global verde con conteos esperados.
- Contratos de dominio intactos (`SpeciesDefinition`, `CreatureIndividual`, registro).
- **Negativa de publicación:** especie `DRAFT` con todas las medidas correctas → `publishable=false`.
- **Aprobación falsificada:** `APPROVED` sin aprobador/evidencia → error de validación.
- Variante cosmética aceptada; override de rasgo inmutable rechazado; variante sin rasgos preservados rechazada.
- Evolución cíclica rechazada; evolución que pierde un rasgo identitario rechazada.
- Asset de mundo con material inexistente y LOD no decreciente rechazado.
- **Deriva 1.865 vs 1.845:** el adaptador reporta `SNAPSHOT_DRIFT` y recalcula 1.845.
- Hash del adaptador estable y coincidente con el snapshot.
- CLI: `validate --json` (exit 0), `inspect` (1.845, no publicable), `build-reference` determinista entre dos directorios, `verify-assets` (exit 0), comandos inválidos (exit 2).
- Blockout: OBJ determinista, IDs (`head`, `flame.1`), sin NaN, hash estable.

## 5. Evidencia del blockout

- `forge/examples/salamander/blockout.json` — 13.326 B.
- `forge/examples/salamander/blockout-report.md`.
- `forge/examples/salamander/studio-preview.png` — 1024², render Workbench técnico.
- El blockout es una **verificación geométrica**, no un personaje final ni un asset aprobado.

## 6. Hallazgos y límites

1. **M0 sigue fallando** por la auditoría de dependencias, no por AF-0. Es el único gate no verde.
2. **Salamander v3 no está aprobado**: `status=DRAFT`, `artApproved=false`, `model=null`. El framework lo impide publicar.
3. **Sin modelo 3D final, rig, UV ni animación.** El blockout usa primitivas.
4. **Solo cuadrúpedo**: aves y reptiles tienen contrato, sin datos.
5. **Arte**: el blockout no sustituye la dirección artística; la ficha H3-C no se modifica.
6. **Dependencias**: no se añadieron paquetes; todo usa Node built-ins.
7. **H3-C como fixture**: se copiaron únicamente los tres JSON, con hashes y procedencia; no imágenes.

## 7. Archivos principales

```
forge/ (núcleo, datos, esquemas, CLI, adaptador, blockout, Blender)
forge/fixtures/h3c/ (3 JSON + PROVENANCE.md)
forge/examples/salamander/ (blockout JSON, informe, render)
tests/unit/forge-core.test.cjs
tests/unit/forge-registry.test.cjs
tests/unit/forge-cli.test.cjs
docs/ANIMAL_FORGE_AF0.md
docs/AF0_QA_REPORT.md
package.json (scripts forge:*)
scripts/check-syntax.cjs (incluye forge)
.gitignore (forge/out/)
```

## 8. Conclusión

**AF-0 READY FOR ENGINEERING REVIEW.** Código ejecutable, contratos, CLI, caso Salamander, pruebas y aislamiento confirmados. Sin aprobación artística inventada, sin push, sin merge y sin cambios en el juego.
