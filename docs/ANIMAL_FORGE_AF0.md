# Animal Forge AF-0 — Arquitectura e integración

> Estado: **AF-0 implementado, pendiente de revisión de ingeniería**.
> Base: `7279aa4` (`feat/m2-world-vertical-slice`), worktree `ataque-de-animales-af`, rama `feat/af-0-animal-forge-core`.
> Sin cambios en dominio, simulación, combate, red ni runtime.

## 1. Problema y decisión

Cada iteración de un personaje cambiaba su identidad visual porque no existía una fuente única de medidas ni una puerta de aprobación separada de la geometría. Animal Forge separa **contenido** (especies, variantes, evolución, mundo) de **reglas** (contratos, validación, aprobación) y lo conecta al dominio existente solo por `speciesId`.

Capas, según F0.5:

```
DOMAIN (SpeciesDefinition, CreatureIndividual)   ← sin cambios
SIMULATION (Movement, Collision, ...)            ← sin cambios
PRESENTATION (Three.js, UI)                      ← sin cambios
ART TOOLING (forge/)                             ← nuevo, aislado
```

`forge/` no importa Three.js, no toca `plazoleta.html` ni `js/world`, y no escribe estado de juego. El único enlace es `forge/domain-link.mjs`, que lee los IDs de `getDefaultSpeciesDefinitions()`.

## 2. Componentes

| Módulo | Responsabilidad | Archivo |
|---|---|---|
| Art Bible | Familias, paletas, materiales, proporciones, ojos, luz, escalas, presupuestos | `forge/art-bible.mjs` + `forge/data/art-bible.json` |
| Archetype Registry | Contratos anatómicos reutilizables; cuadrúpedo implementado | `forge/archetypes.mjs` + `forge/data/archetypes/quadruped.json` |
| Species Visual Registry | Identidad visual ligada a `speciesId`, medidas, rasgos inmutables, assets, aprobación | `forge/species-registry.mjs` + `forge/data/species/` |
| Variant Contracts | Overrides cosméticos permitidos; rechazo de identidad inmutable | `forge/variants.mjs` |
| Evolution Contracts | Linaje acíclico, etapas, rasgos preservados, compatibilidad de esqueleto | `forge/evolutions.mjs` |
| World Asset Registry | Vegetación, rocas, edificios, mobiliario y módulos; LOD, colisión, licencia | `forge/world-registry.mjs` + `forge/data/world/` |
| Validation Pipeline | Esquemas, IDs, medidas, referencias, aprobación, hashes, licencias | `forge/pipeline.mjs` |
| H3-C Adapter | Importa medidas/anclas experimentales y reporta discrepancias | `forge/adapters/h3cSalamander.mjs` |
| Blockout Builder | JSON/OBJ deterministas y render técnico opcional | `forge/blockout.mjs` + `forge/blender/build_blockout.py` |
| CLI | `validate`, `inspect`, `build-reference`, `render-preview`, `verify-assets` | `forge/cli.mjs` |

## 3. Contratos de datos

### Especie visual

```json
{
  "visualId": "salamander.v3",
  "speciesId": "salamander",
  "archetypeId": "quadruped",
  "artVersion": "0.2.0-draft",
  "status": "DRAFT",
  "approval": { "artApproved": false, "approvedBy": null, "approvedAt": null, "evidence": null, "score": null },
  "measurements": { "heightM": 1.0, "lengthM": 1.845, "...": "..." },
  "measurementsSource": { "adapter": "h3c-salamander", "sourceHash": "0555c9cf..." },
  "identity": { "immutableTraits": ["silhouette.quadruped", "face.eye.integrated", "crest.family.volcanic", "tail.s-curve", "proportions.height"] },
  "visualParams": { "paletteId": "volcanic", "materialIds": ["basalt", "magma", "amberEye", "belly"], "crestCount": 5 },
  "assets": { "model": null, "textures": [] },
  "provenance": { "origin": "original-vector-h3c-experimental", "license": "ISC", "sourceFiles": ["..."] }
}
```

Reglas principales:

- `visualId` y `speciesId` son IDs estables; `speciesId` debe existir en el dominio.
- Las medidas deben caer dentro del rango del arquetipo; orientación `+Y`/`+Z`, pies en `Y=0`.
- Los rasgos inmutables del arquetipo deben estar presentes en la especie.
- `APPROVED` exige aprobador humano, fecha, evidencia y puntuación 0–10; `DRAFT` no puede llevar datos de aprobación.
- Un asset sin modelo no es publicable.

### Variante

Solo puede sobrescribir `variantPolicy.allowedParams` (paleta, fisura, tinte de cresta, intensidad de fuego, semilla). Cualquier clave inmutable (`face.eye.integrated`, `silhouette.quadruped`, etc.) se rechaza con `VARIANT_IDENTITY`.

### Evolución

`fromVisualId → toVisualId`, etapa ≥2, sin ciclos (`EVOLUTION_CYCLE`), sin múltiples padres, preservando `evolutionPolicy.mustPreserve` y con esqueletos compatibles.

### Asset de mundo

Categorías: `vegetation`, `rock`, `building`, `interactive`, `streetFurniture`, `streetModule`, `plazaModule`. Exige dimensiones positivas, pivote, colisión, materiales del Art Bible, LOD 0 y triángulos decrecientes, presupuesto web y licencia.

## 4. Una sola fuente de verdad

El adaptador H3-C recalcula las medidas desde la geometría del fixture:

| Medida | Valor derivado |
|---|---:|
| Altura | 1.000 m |
| Lomo | 0.550 m |
| Longitud | 1.845 m |
| Cuerpo | 0.640 m |
| Ojo Ø / hueco | 0.090 / 0.080 m |
| Cola (offset) | 0.120 m |
| Cresta | 5 lenguas |
| Dedos | 4 por pata |

`sourceHash = 0555c9cf93659efb422a0107aad02011186e2b4cade4ad396786d31bd82df2de`. El snapshot de la especie se compara contra el adaptador en cada `validate`; si alguien edita un número a mano, falla con `SNAPSHOT_STALE` o `SNAPSHOT_HASH`.

El caso 1.865 vs 1.845 queda cubierto por un test: al alterar el snapshot a 1.865, el adaptador reporta `SNAPSHOT_DRIFT` y el valor calculado sigue siendo 1.845.

## 5. Aprobación: geometría no es arte

`canPublish(species, validation)` exige simultáneamente:

1. Validación global sin errores.
2. `status === "APPROVED"`.
3. `approval.artApproved === true`.
4. `approvedBy`, `approvedAt` y `evidence` no vacíos.
5. Modelo presente y archivo existente.

Un blockout con todas las medidas en rango pero `DRAFT` devuelve `publishable=false`. Un `APPROVED` sin evidencia es rechazado por el validador. **Ningún test numérico sustituye la revisión humana.**

Además, los manifiestos `APPROVED` se anclan por hash en `forge/data/approval-lock.json` (`validateApprovalLock`): editar medidas, rasgos o parámetros sin actualizar el lock produce `APPROVAL_LOCK_MISMATCH`. El lock no es una firma criptográfica; su cambio sigue requiriendo revisión.

## 6. CLI y flujo

```bash
pnpm forge:validate
pnpm forge:inspect
pnpm forge:build
pnpm forge:preview
pnpm forge:verify
```

Salidas: `forge/out/salamander/{blockout.json,blockout.obj,blockout-report.md,studio-preview.png,blockout.blend,blockout.glb}`.

La CLI restringe `--out` a `forge/out/`: `resolveAuthorizedDir` rechaza rutas absolutas, `..` y symlinks que apunten fuera (exit 2).

El blockout es determinista: dos builds producen el mismo `blockoutHash` (`cbc2f0c6...` con los fixtures actuales). El OBJ incluye IDs (`head`, `eye.L`, `tail`, `flame.1`…), sin NaN.

## 7. Salamander como caso de prueba

- `salamander.v3` es `DRAFT`, sin aprobación, con `assets.model=null`.
- El adaptador no encontró discrepancias: `adapter.discrepancies=0`.
- El blockout es una verificación geométrica, no una propuesta artística.
- La ficha H3-C y su dirección aprobada **no** se modifican ni se declaran aprobadas.

## 8. Límites y trabajo futuro

- Solo cuadrúpedo implementado; aves/reptiles tienen contrato sin datos.
- Sin rig, animación, UV, retopología ni modelo final.
- Sin editor de mundos; solo registro y validación.
- `express@5.3.0` → `body-parser@2.4.0` corrige la vulnerabilidad alta; `pnpm audit --audit-level low` queda en 0.
- Próximo paso lógico (AF-1): arquetipos aviar/reptil, LOD/colisión automáticos y comparación visual de siluetas.
