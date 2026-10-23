# Recuperación independiente de Git LFS — evidencia H1

**Fecha:** 2026-10-20 · **Origen:** `https://github.com/ColomBitcoinLA/ataque-de-animales.git` · **Rama:** `feat/r1-b2-salamander-modeling` · **Commit:** `6e078e1780ee0e44ba453649af53ca929dcfa1f3`

**Carpeta de prueba (conservada, no eliminada):**
`..\_h1-lfs-verify-20261020` (carpeta hermana del worktree, fuera de Git)

Procedimiento: clon independiente por HTTPS, `--single-branch --depth 1`, fuera de los worktrees existentes; no se hizo pull, checkout ni modificación en el worktree de trabajo.

```bash
git clone --branch feat/r1-b2-salamander-modeling --single-branch --depth 1 \
  https://github.com/ColomBitcoinLA/ataque-de-animales.git _h1-lfs-verify-20261020
```

## Resultado: 9/9 objetos recuperados y verificados

| Archivo | Puntero en Git (bytes) | Binario materializado (bytes) | SHA-256 vs manifiesto |
|---|---:|---:|---|
| `assets/characters/salamander/salamander.blend` | 132 | 4.870.725 | ✅ `730cfd13…` |
| `assets/characters/salamander/salamander-preview.glb` | 132 | 4.646.424 | ✅ `633c9157…` |
| `assets/characters/salamander/salamander-basecolor.png` | 132 | 1.931.733 | ✅ `0d40ac3b…` |
| `assets/characters/salamander/salamander-emission.png` | 131 | 939.508 | ✅ `39f8cb5a…` |
| `assets/characters/salamander/v2/salamander-v2.blend` | 132 | 5.757.170 | ✅ `e29199d7…` |
| `assets/characters/salamander/v2/salamander-v2-preview.glb` | 132 | 5.338.812 | ✅ `c885047e…` |
| `assets/characters/salamander/v2/salamander-v2-basecolor.png` | 132 | 2.433.697 | ✅ `7d0330b9…` |
| `assets/characters/salamander/v2/salamander-v2-emission.png` | 131 | 616.882 | ✅ `a3e27001…` |
| `assets/characters/salamander/v2/salamander-v2-roughness.png` | 131 | 805.047 | ✅ `06d723a3…` |

- **0 discrepancias** de SHA-256 frente a los manifiestos de respaldo V1 (`V1_BACKUP_MANIFEST.sha256`, 20/20) y V2 (`V2_BACKUP_MANIFEST.sha256`, 46/46).
- `git lfs fsck` en el clon: **Git LFS fsck OK**.
- Diferencia puntero/binario: los objetos del índice pesan 131–132 B mientras los archivos materializados suman **27.339.998 B**; el contenido real viaja por LFS, no por el historial Git normal.
- `git lfs ls-files --long` del clon lista los 9 archivos con sus OID completos, coincidentes con el worktree de origen.
- El clon está limpio y en el mismo commit que el remoto (`6e078e1`).
- Cabeceras comprobadas en el clon: los GLB empiezan por `glTF` (magic válido) y los `.blend` por el magic **zstd** (`28 B5 2F FD`), coherente con el guardado comprimido de Blender 5.x. La apertura real de los `.blend` ya quedó verificada por los validadores de V1/V2 sobre archivos con el mismo SHA-256.

## Conclusión

La recuperación independiente **funciona**: cualquier colaborador con acceso al repositorio puede clonar la rama y obtener los `.blend`, `.glb` y atlas completos desde LFS, con integridad verificada. La carpeta de prueba se conserva para auditoría; no se eliminó ni se modificó el worktree de trabajo.
