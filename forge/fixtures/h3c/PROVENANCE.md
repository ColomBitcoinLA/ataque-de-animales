# H3-C — Procedencia de los fixtures experimentales

**Estado:** `DRAFT v0.2` · datos históricos experimentales, **no** identidad artística aprobada.

Animal Forge usa tres JSON de H3-C como caso de prueba del adaptador y de la validación de una sola fuente. No se copiaron imágenes, modelos ni la ficha artística.

| Archivo | SHA-256 |
|---|---|
| `MASTER_ANATOMY.json` | `3bc908f22b74ef88acd6f3236135018adc4d9d02ca730f00aa35290f4c6b6d3b` |
| `MASTER_CREST_MAP.json` | `4473ac310e07cd1fd785951807fb96f63b3e1352f14631330e3e898636670ca8` |
| `MASTER_MEASUREMENTS.json` | `c0f1a0080fe08bf3a50df1666fa2dce1a041c6ba091596229a93134fd4ff4ee3` |

- Los hashes se verifican en `forge/data/asset-manifest.json` y en `pnpm forge:validate` (`HASH_MISMATCH`).
- El adaptador recalcula las medidas desde la geometría; el valor de longitud es **1.845 m**, no 1.865 m. Cualquier discrepancia se reporta como `SNAPSHOT_DRIFT`.
- La ausencia de aprobación artística se conserva: `approval.artApproved=false` y `status=DRAFT`.
