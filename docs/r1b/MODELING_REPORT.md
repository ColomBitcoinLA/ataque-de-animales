# R1-B.2 — Informe de modelado Salamander (modelo estático)

**Estado: READY FOR ART REVIEW.** Primera versión 3D original, estática y reproducible, de Salamander. **No hay rigging ni animaciones** (fuera de alcance por instrucción), no está integrada en el runtime del juego y no se declara aprobada: requiere revisión visual humana antes de pasar a animación.

## 1. Preflight verificado

| Comprobación | Resultado |
|---|---|
| Worktree | `ataque-de-animales-r1b` |
| Rama | `feat/r1-b2-salamander-modeling` |
| HEAD base | `359a53c156c2beef064795065da64d4dc465a721` |
| Árbol al iniciar | Limpio |
| Blender | 5.2.2 LTS (`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`, hash `d13f752e3b9c`) |
| Otros worktrees | No modificados; sin checkout ni merge |

Documentos consultados: `docs/R1B_SALAMANDER_ASSET_BRIEF.md`, `docs/r1b-salamander-orthos.svg`, `docs/ASSET_LICENSES.md`, `js/world/plazoleta/characters.mjs`, `js/world/plazoleta/camera-solver.mjs`. Las cuatro capturas adjuntas se usaron sólo como **dirección visual**; no se copiaron mallas, texturas ni diseños de mascotas ajenas.

## 2. Fase A — decisiones previas

Documentadas antes de modelar en [GEOMETRY_PLAN.md](./GEOMETRY_PLAN.md): silueta, proporciones, envolvente dimensional del brief, ejes, topología esperada, paleta, estrategia de fuego sólido y presupuesto. Ajustes declarados antes de implementarlos:

- **Paleta:** se sustituye el cuerpo naranja del brief por basalto gris cálido oscuro con grietas incandescentes, vientre marrón cálido y fuego ámbar, siguiendo la ficha aportada. El contrato dimensional del brief se conserva.
- **Cola:** se eleva sobre la grupa para que sea legible desde la cámara trasera de R1-A; no cambia la huella de colisión (no se tocó la simulación).
- **Texturas:** tras la primera malla, las fisuras por vértice producían dentado; se pasó a dos atlas horneados originales (base color y emisión) y un solo material de piel.

## 3. Fase B — construcción

`tools/blender/build_salamander.py` genera todo desde cero, sin geometría externa:

1. **Cuerpo/cabeza/cuello** por secciones elípticas diseñadas y muestreadas con Catmull-Rom (silueta continua, no esfera deformada). Hocico ancho, frente abovedada, garganta plana.
2. **Cuatro extremidades** con secciones curvadas de radios variables, codo/rodilla y tres dedos por pata con garras minerales; pies apoyados a Y≈0.
3. **Cola** de secciones curvas con ascenso sobre la grupa.
4. **Fusión voxel** (0.0075 m) del cuerpo y extremidades en un volumen único, suavizado, reducción a densidad de revisión y eliminación de triángulos degenerados.
5. **Cuencas oculares** booleanas, globos oculares, iris pigmentado, pupila, brillo especular, párpados superior/inferior y cejas barridas.
6. **Boca** por costura oscura y labio inferior; narinas; crestas de mejilla.
7. **Cresta ígnea** de cuatro llamas con ramas laterales y núcleo, más llama de cola y escamas dorsales de unión; todas con masa (sin partículas, bloom ni tarjetas).
8. **Atlas** 2048×2048 base color y emisión, horneados de un campo Voronoi 3D perturbado original.

Presupuesto de triángulos respetado: **77.010** (objetivo ≤80.000). El script conserva una colección `CONSTRUCTION_SOURCE` oculta y otra `STUDIO_NOT_EXPORTED` (suelo, luces, cámara) que no entra en el GLB.

## 4. Fase C — materiales

8 materiales en el GLB; emisión moderada y color propio en la base, de modo que el personaje mantiene identidad sin bloom:

| Material | Uso | Roughness | Emisión |
|---|---|---|---|
| `01 Basalto y vientre - atlas original` | piel, vientre y grietas (atlas base + emisión) | 0.74 | 0.45 con máscara de grieta |
| `04 Parpados - basalto pulido` | párpados, cejas, labio | — | no |
| `05 Boca y pupilas - obsidiana` | pupila, boca, narinas | 0.24 | no |
| `06 Iris ambar` | iris | 0.22 | 0.12 |
| `07 Garras - cuerno mineral` | garras y escamas | 0.48 | no |
| `08 Fuego solido - amber` | llamas | 0.50 | 0.25 |
| `09 Nucleo fuego - oro` | núcleos | 0.52 | 0.25 |
| `10 Catchlight` | brillo ocular | 0.16 | no |

## 5. Fase D — archivos generados

| Archivo | Bytes |
|---|---|
| `assets/characters/salamander/salamander.blend` | 4.870.725 |
| `assets/characters/salamander/salamander-preview.glb` | 4.646.424 |
| `assets/characters/salamander/salamander-basecolor.png` | 1.931.733 |
| `assets/characters/salamander/salamander-emission.png` | 939.508 |
| `tools/blender/build_salamander.py` | generador reproducible |
| `tools/blender/validate_salamander.py` | reapertura + importación GLB |
| `tools/blender/verify_glb.mjs` | carga con three 0.160 + decodificación de atlas |
| `tools/blender/decode_png.mjs` | decodificador PNG mínimo para la prueba Node |
| `tools/blender/make_review_sheet.py` | hoja de contactos (Pillow) |
| `docs/r1b/salamander-front.png` | 1.266.148 |
| `docs/r1b/salamander-side.png` | 1.288.375 |
| `docs/r1b/salamander-back.png` | 1.338.631 |
| `docs/r1b/salamander-three-quarter.png` | 1.346.483 |
| `docs/r1b/salamander-wireframe.png` | 1.440.729 |
| `docs/r1b/salamander-review-sheet.png` | composición de las cuatro vistas |
| `docs/r1b/build-metrics.json` · `validation.json` · `three-validation.json` | métricas medidas |

Renders reales de Cycles (40 muestras, denoise, AgX, 1200×1000, CPU Intel i3-1005G1, 8 hilos): construcción+exportación **18,98 s**; las cinco imágenes tardaron **339,6 s** en total. El `.blend` guarda el estudio de iluminación y las cámaras; el GLB no las incluye.

La hoja `salamander-review-sheet.png` sólo reescala y rotula los cuatro fotogramas completos; no genera ni retoca píxeles del personaje.

## 6. Métricas geométricas

| Métrica | Valor |
|---|---|
| Objetos/mallas exportadas | 55 |
| Vértices | 38.615 (GLB 44.415 por splits de normales/UV) |
| Polígonos | 60.650 |
| Triángulos | **77.010** |
| Materiales | 8 |
| Texturas | 2 × 2048² (empaquetadas) |
| Bounds Blender (m) | X −0,443..0,443 · Y −0,854..1,044 · Z −0,000009..0,994 |
| Dimensiones | 0,886 × 1,898 × 0,994 m |
| Bounds glTF (Y-up, m) | X −0,443..0,443 · Y 0,000..0,994 · Z −1,034..0,854 |
| Orientación glTF | hocico **+Z**, cola **−Z**, arriba **+Y** |
| Rig / animaciones | **0 / 0** |

La envolvente respeta el brief: pies en Y≈0, altura de cresta 0,994 m ≤1,02 m, hocico a +0,854 m y cola a −1,034 m. El ancho 0,886 m supera los 0,65 m del torso porque incluye apoyos y brazos abiertos; el brief admite que los pies sobresalgan. No se modificó el radio de colisión R1-A (0,34 m).

## 7. Fase E — validación ejecutada

| Comprobación | Resultado |
|---|---|
| `blender --background --python tools/blender/validate_salamander.py` | **PASS** — 1.845 comprobaciones, 0 errores |
| `.blend` se reabre | Sí, en proceso Blender independiente |
| GLB importado en Blender | 77.010 triángulos, bounds **idénticos** al blend |
| Mallas manifold / sin modificadores / sin shape keys | PASS por malla |
| Coordenadas finitas y triángulos de área no nula | PASS |
| GLB: sin cámaras, luces, skins, animaciones ni URIs | PASS |
| `node tools/blender/verify_glb.mjs` | **PASS** con three 0.160 (misma versión del juego); 55 primitivas, 8 materiales, 2 atlas decodificados, recursos liberados |
| SHA-256 del GLB | `633c915744f444325f3964a5de3fcb67f86c2684660a9aa3ffbc22abe9f90cfd` |
| `pnpm run check` | 70 JS + 5 ESM PASS |
| `pnpm test` | **192/192** |
| `pnpm run test:integration` | **19/19** |
| `pnpm run gate:m0` | **13/13** |
| `pnpm audit --audit-level high` | exit 0; 0 high/critical (1 low, 3 moderate) |

Nota de transparencia: una ejecución previa de `pnpm test` falló 11 pruebas de arranque del servidor porque Blender/Cycles estaba renderizando en paralelo en esta CPU de 2 núcleos (timeouts de 10 s, `fetch failed`). Repetida sin carga concurrente, la suite pasó 192/192, igual que la integración 19/19. No se modificó ningún test.

No se midieron FPS, draw calls reales ni memoria de GPU en navegador: el GLB no está integrado y esas cifras no deben inventarse. La carga en Node no equivale a una medición de rendimiento web.

## 8. Topología y preparación para rigging

**Evidencia:** [wireframe real](./salamander-wireframe.png), [validation.json](./validation.json).

- El cuerpo es un **volumen único cerrado** (manifold) con extremidades fusionadas, más piezas faciales y de fuego intencionalmente separadas.
- La densidad es de revisión: malla triangular de escultura, sin bucles de deformación.
- **No está lista para rigging tal cual.** Antes de animar se requiere retopología cuadrangular: bucles en hombros, caderas, cuello, base de cola y dos o más quiebros de cola; separar párpados y mandíbula; decidir si el fuego se rigidiza a huesos propios.
- El UV es un *smart project* de revisión, no un unwrap de producción. Tras retopologizar habrá que re-proyectar o re-hornear los atlas.
- Las bases de cresta y escamas **intersecan** el cuerpo a propósito (unión visual). No hay boolean final, así que las autointersecciones no están certificadas ni se afirma que no existan.
- La postura es estática y de apoyo; el rigging necesitará una pose neutral/A-pose.

## 9. Limitaciones declaradas

- Es una **primera versión de revisión**, no un personaje final ni un asset de producción validado.
- Sin rig, sin skinning, sin clips, sin LOD, sin optimización para móvil.
- 55 primitivas y 8 materiales suponen un coste de draw calls no medido; habrá que fusionar por material o instanciar antes de integrarlo.
- 2 atlas de 2048² implican ~33 MB de RGBA decodificados si la GPU los sube a 32 bits; no medido en navegador.
- La boca es una costura con labio, no una cavidad con dientes o lengua.
- El fuego es geometría sólida estilizada; sin animación no demuestra comportamiento de llama.
- No se ha probado en `plazoleta.html`, ni con la cámara del juego, ni con bloom desactivado en navegador. La afirmación de que conserva identidad sin bloom se basa en los renders de estudio, no en QA web.
- El detalle de fisuras vive en textura; un cambio de retopología exigirá re-hornear.
- Las fichas adjuntas no tienen licencia verificada; el modelo las usa sólo como referencia de dirección, no como fuente de píxeles ni geometría.

## 10. Licencias

Registrado en [docs/ASSET_LICENSES.md](../ASSET_LICENSES.md): script, `.blend`, GLB, atlas y renders son producción original de este repositorio bajo **ISC**. Sin geometría, texturas, fotografías ni audio de terceros. El campo de fisuras y todos los materiales se generaron proceduralmente en Blender. La atribución no constituye asesoría legal sobre el moodboard externo.

## 11. Checklist de revisión humana

1. Abrir `assets/characters/salamander/salamander.blend` en Blender 5.2.2 y comprobar que `SALAMANDER` contiene el modelo; `CONSTRUCTION_SOURCE` y `STUDIO_NOT_EXPORTED` son auxiliares.
2. Comparar las cuatro vistas con la ficha aprobada: proporción cabeza/cuerpo, expresividad ocular, cuatro patas, cresta y llama de cola.
3. Revisar la vista trasera pensando en la cámara de persecución a 6,4 m: ¿se distingue la silueta y la cola?
4. Revisar el wireframe: decidir si la densidad y las transiciones sirven de base para retopología.
5. Evaluar materiales sin bloom y con luz neutra: ¿el fuego sigue leyéndose?
6. Aprobar, pedir cambios de arte o rechazar. **No avanzar a animación sin esta aprobación explícita.**

## 12. Próximo paso propuesto (no ejecutado)

Tras la revisión: retopología de deformación, re-horneado de atlas y definición de esqueleto; después los clips `idle`, `walk`, `run`, `turn-left`, `turn-right`, `interact` y la integración con el estado R1-A. Nada de eso se ha implementado aquí.
