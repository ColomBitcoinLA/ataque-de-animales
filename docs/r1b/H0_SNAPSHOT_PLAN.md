# R1-B.2B · H0 — Preflight, inventario y preservación

**Estado: READY FOR SNAPSHOT REVIEW.** No se ejecutaron commits, push, merges, cambios de rama ni comandos destructivos. No se generó V3 ni se contactó ningún proveedor externo.

## 1. Preflight

| Comprobación | Resultado |
|---|---|
| Carpeta real | `...\03 - Curso de Programación Básica\ataque-de-animales-r1b` (verificada con `pwd` y `Get-Location`) |
| `git rev-parse --show-toplevel` | `.../ataque-de-animales-r1b` (worktree propio, no el repo principal) |
| Rama | `feat/r1-b2-salamander-modeling` |
| HEAD | `359a53c` · `docs(r1-b): add salamander asset brief and orthographic concept` |
| `git status --short` | `M docs/ASSET_LICENSES.md`; `?? assets/characters/`, `?? docs/r1b/`, `?? tools/blender/` |
| `git diff --check` | Limpio |
| Worktrees | `ataque de animales` (otra rama), `ataque-de-animales-deepseek-poc`, `ataque-de-animales-r1b` (este) |

No se exige árbol limpio: los cambios sin commit son el trabajo V1/V2 a preservar.

## 2. Inventario

55 archivos no rastreados/modificados, **57.075.102 B (≈54,4 MiB)**. Sin duplicados por hash. Mayor archivo: `salamander-v2.blend` (5.757.170 B), muy por debajo de límites de Git/GitHub. `.git` de este worktree es un puntero al repositorio principal (no infla el worktree).

| Grupo | Archivos | Bytes | Contenido |
|---|---|---|---|
| V1 assets | 4 | 12.388.390 | `salamander.blend`, `salamander-preview.glb`, atlas base/emisión |
| V1 docs/renders | 11 | 8.371.724 | `MODELING_REPORT.md`, `GEOMETRY_PLAN.md`, métricas, validación, 6 render/contactos |
| V2 assets | 5 | 14.951.608 | `salamander-v2.blend`, GLB, atlas base/emisión/rugosidad |
| V2 docs/renders | 22 | 21.234.491 | informe, métricas, 2 validaciones, 8 vistas, comparativa, 4 A/B, 4 clay |
| Herramientas | 11 | 114.816 | generadores, validadores, verificadores, compositores |
| Licencias | 1 | 6.727 | `docs/ASSET_LICENSES.md` (modificado) |
| Este plan | 1 | 7.346 | `docs/r1b/H0_SNAPSHOT_PLAN.md` |

- **Duplicados:** ninguno (0 grupos por hash).
- **Secretos/credenciales:** 0 coincidencias en `password`, `secret`, `api_key`, `token`, claves de proveedor, bloques `PRIVATE KEY`.
- **Datos personales/rutas absolutas:** 0 coincidencias de `C:\Users\...` o `D:\Nws Code` en el texto inventariado. Única dependencia de ruta de sistema: `C:/Windows/Fonts/segoeui*.ttf` en `make_comparison.py` (compositor de contactos, no del modelo).
- **Temporales:** 5 logs (`build.log`, `build-check.log`, `validation.log`, `gameplay-render.log`, `v1-comparison.log`) ya cubiertos por `*.log` en `.gitignore`; 4 previews `clay-*.png` (iteración intermedia).
- **Respaldos dentro del repo:** ninguno (están fuera del worktree).

## 3. Preservación

### V1 (existente, verificado)

- Ruta: `...\03 - Curso de Programación Básica\_r1b-v1-backup-20261018\`
- Manifiesto: `V1_BACKUP_MANIFEST.sha256` · **20/20 entradas verificadas, 0 discrepancias**.
- Equivalencia con el estado actual: `salamander.blend` `730cfd13…`, GLB `633c9157…`, `build_salamander.py` `a295b7a3…` (idénticos live↔backup).
- V1 no fue sobrescrita ni borrada.

### V2 (creada en H0)

- Ruta: `...\03 - Curso de Programación Básica\_r1b-v2-backup-20261018\`
- Manifiesto: `V2_BACKUP_MANIFEST.sha256` (hash `9faaa5ea3253602df9269837dd6559c7a9980696a876a746056953e86f98a314`).
- **46 archivos, 41.984.874 B, 46/46 verificados, 0 discrepancias.**
- Contenido: assets V2 (5), docs V2 sin logs ni clay (18), docs/renders V1 (11), herramientas (11), registro de licencias (1).
- Assets V2 principales: `salamander-v2.blend` `e29199d7…`, GLB `c885047e…`.

## 4. Qué entra y qué no entra en Git

### Conservar en Git (51 archivos, 54.380.610 B ≈ 51,9 MiB)

- `assets/characters/salamander/` completo (V1 y `v2/`).
- `docs/r1b/` (informes, planes, métricas, validaciones, renders V1).
- `docs/r1b/v2/` **excepto** `clay-*.png` y `*.log` (22 archivos → 18).
- `tools/blender/` (11 scripts reproducibles).
- `docs/ASSET_LICENSES.md` modificado.

### Permanecer fuera de Git

- `docs/r1b/v2/clay-*.png` — previews intermedios de iteración (2,69 MiB), no son entregables.
- `docs/r1b/v2/*.log` — ya ignorados por `*.log`.
- `node_modules/`, `data/` y cualquier base local (ignorados/excluidos).
- Respaldos `_r1b-v1-backup-20261018` y `_r1b-v2-backup-20261018` (fuera del worktree).

## 5. Propuesta de snapshot (no ejecutada)

Recomendación: **tres commits explícitos**, sin `git add -A`, revisando `git diff --cached --stat` antes de cada uno.

```bash
# 1) V1 + licencias
git add -- assets/characters/salamander/salamander.blend \
             assets/characters/salamander/salamander-preview.glb \
             assets/characters/salamander/salamander-basecolor.png \
             assets/characters/salamander/salamander-emission.png \
             docs/r1b/MODELING_REPORT.md docs/r1b/GEOMETRY_PLAN.md \
             docs/r1b/build-metrics.json docs/r1b/validation.json docs/r1b/three-validation.json \
             docs/r1b/salamander-*.png docs/ASSET_LICENSES.md
git commit -m "feat(r1-b): add original Salamander V1 static asset, pipeline and validation"

# 2) Herramientas
git add -- tools/blender
git commit -m "chore(r1-b): add reproducible Blender build, validation and GLB verification tools"

# 3) V2 + evidencia A/B
git add -- assets/characters/salamander/v2 \
             docs/r1b/v2/ART_REDESIGN_REPORT.md docs/r1b/v2/build-metrics.json \
             docs/r1b/v2/validation.json docs/r1b/v2/three-validation.json \
             docs/r1b/v2/salamander-*.png docs/r1b/v2/v1-comparison-*.png \
             docs/r1b/H0_SNAPSHOT_PLAN.md
git commit -m "feat(r1-b): add Salamander V2 iteration with A/B renders and H0 snapshot plan"
```

Alternativa de un solo commit: mismo conjunto de rutas y mensaje `feat(r1-b): preserve Salamander V1/V2 static assets, tools and art-review evidence`.

Antes de commitear: `git status --short` debe mostrar exactamente los archivos previstos; `git diff --cached --check` limpio; `git diff --cached --stat` sin binarios inesperados; ningún `.log` ni `clay-*.png` en el índice.

## 6. Riesgos detectados

1. **Tamaño/historial:** ≈54 MiB de binarios en un commit. Aceptable para revisión, pero Git no diffa `.blend`/`.glb`; futuras iteraciones inflarán el historial. Opciones: LFS o publicar GLB/renders como release y dejar en Git sólo scripts e informes. Decisión del usuario.
2. **Licencias:** las capturas de referencia del usuario (`bfad6732…`, `7e987954…`, `a61ba607…`, `b32c0bcf…`) **no se commitearon** y su autoría no está verificada. El modelo se declara original; si se usa un proveedor 3D externo en H1, habrá que registrar términos de redistribución y evitar subir referencias sin derechos.
3. **Reproducibilidad:** `make_comparison.py` depende de fuentes de Windows; los validadores requieren Blender 5.2.2 y three 0.160. Documentado, no bloqueante.
4. **Estado artístico:** V1 y V2 siguen en 4/10 humano. Este snapshot preserva el trabajo, **no** lo aprueba.
5. **Riesgo de mezcla:** no incluir logs ni previews evita ruido; no usar `git add -A` evita arrastrar `node_modules` o temporales.

## 7. Plan H1–H4 (borrador, sin ejecutar)

- **H1 — Referencia y proveedor.** Congelar la ficha artística aprobada; verificar procedencia y licencia de cada referencia. Elegir **un único** proveedor de generación 3D, sin cuentas, tokens ni pagos en esta fase; documentar términos de uso y si el resultado es redistribuible. Definir prompt/hoja de estilo, escala (m), orientación +Z y presupuesto (<80k triángulos).
- **H2 — Candidatos.** Generar **3–5 candidatos originales** con ese proveedor, misma entrada y sin retoque manual entre ellos. Guardar GLB crudos fuera de Git con manifiesto de hashes.
- **H3 — Comparación y selección humana.** Renderizar cada candidato con las cuatro cámaras canónicas y la de juego (6,4 m/55°); comparar silueta, rostro, ojos, patas, cresta y cola. **El usuario elige** uno; no se importa ninguno definitivo sin esa selección.
- **H4 — Refinamiento, materiales y compuerta.** Refinar el elegido en Blender con revisiones clay (frente, lateral, posterior, tres cuartos) antes de materiales; hornear atlas, renders finales y comparativa con V1/V2; validación técnica y **compuerta artística mínima 7/10 evaluada por el usuario**. Sólo entonces se discutiría retopología/rigging en otra fase.

## 8. Bloqueos

Ninguno para H0. La generación 3D (H1) **no se autoriza** en esta ejecución: se detiene aquí a la espera de aprobación del snapshot y de decisión sobre el proveedor.
