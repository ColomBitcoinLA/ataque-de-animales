# H3-C — Procedencia de los fixtures experimentales

**Estado:** `DRAFT v0.2` · datos históricos experimentales, **no** identidad artística aprobada.

Animal Forge usa tres JSON de H3-C como caso de prueba del adaptador y de la validación de una sola fuente. No se copiaron imágenes, modelos ni la ficha artística.

| Archivo | SHA-256 (LF) |
|---|---|
| `MASTER_ANATOMY.json` | `95b908683933f8850d2f260b9e8b7421ac2a8acf047cc3b03825fcc97ea66acd` |
| `MASTER_CREST_MAP.json` | `a8e2fa49e256f6658e7fd48ae860422932914a5563fd4d81f40835f2207a5e3d` |
| `MASTER_MEASUREMENTS.json` | `8c7867f1c834edd88a9935ac9385a850ac2dcfbe08d498b505aa9379daeffdb9` |

- Los hashes se calculan sobre el contenido canónico **LF** (independiente de Windows/Linux) y se verifican en `forge/data/asset-manifest.json` y en `pnpm forge:validate` (`HASH_MISMATCH`).
- El adaptador recalcula las medidas desde la geometría; el valor de longitud es **1.845 m**, no 1.865 m. Cualquier discrepancia se reporta como `SNAPSHOT_DRIFT`.
- La ausencia de aprobación artística se conserva: `approval.artApproved=false` y `status=DRAFT`.
