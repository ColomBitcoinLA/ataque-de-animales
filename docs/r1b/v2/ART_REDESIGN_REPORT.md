# R1-B.2A — Informe de rediseño artístico Salamander V2

**Estado final: BLOCKED — la dirección artística requerida no se alcanzó.** El paquete V2 existe, es técnicamente válido y es inspeccionable, pero **no lo presento como un personaje aprobado ni como una mejora suficiente**: la evaluación humana previa (4/10) no queda superada de forma verificable. La decisión de aprobar o rechazar corresponde al usuario; aquí no se declara ninguna nota.

## A. Identidad del trabajo

| Dato | Valor |
|---|---|
| Worktree | `ataque-de-animales-r1b` |
| Rama | `feat/r1-b2-salamander-modeling` |
| Commit base | `359a53c156c2beef064795065da64d4dc465a721` (HEAD no avanzó) |
| Estado Git | Cambios locales **sin commit**: `docs/ASSET_LICENSES.md` modificado; `assets/characters/`, `docs/r1b/`, `tools/blender/` sin rastrear |
| Blender | 5.2.2 LTS, hash `d13f752e3b9c` |
| Otras ramas/worktrees | No tocados; sin checkout, reset, merge ni push |

## B. Preservación de V1

- Respaldo externo: `D:\Nws Code\Platzi\Escuela de Programación\Ruta 01 - Fundamentos de Ingeniería de Software\03 - Curso de Programación Básica\_r1b-v1-backup-20261018\`
- Contenido: 20 archivos, 20.810.522 bytes, manifiesto `V1_BACKUP_MANIFEST.sha256`; verificación de copia: **0 discrepancias de hash**.
- V1 permanece además intacta en su ruta original y no fue sobrescrita:

| Archivo V1 | SHA-256 |
|---|---|
| `salamander.blend` | `730cfd132a25f2cc6c5b6ac972a0b948e7bc4acc3792300554de3cfa1890092e` |
| `salamander-preview.glb` | `633c915744f444325f3964a5de3fcb67f86c2684660a9aa3ffbc22abe9f90cfd` |
| `tools/blender/build_salamander.py` | `a295b7a3a5d3de5e99a6cc87dd61ace573af65c58fb0b1532675bf5eabbdb111` |

La comparativa re-renderiza V1 **sin guardar** su `.blend`.

## C. Modificaciones artísticas intentadas

- **Cabeza:** cráneo más alto y estrecho, hocico más corto, mejillas y mandíbula fusionadas al volumen, mentón definido.
- **Ojos:** globos menores y más adelantados, socket booleano, iris con degradado radial, pupila oval, brillo pequeño; párpado superior único y ceja barrida. Se eliminó el anillo tipo gafas.
- **Boca:** costura ray-casteada sobre la superficie real del hocico (sin alambre flotante), con labio inferior y comisura elevada.
- **Cresta:** hojas de fuego con contorno Bézier de tres lenguas, abanico de siete láminas por grupo y hojas cruzadas para dar volumen frontal/trasero; cuatro grupos sobre dorso y cabeza, más llamas dorsales pequeñas y llama de cola.
- **Piel:** atlas 2048 de base color + emisión + rugosidad horneados desde Voronoi 3D perturbado multiescala; vientre cálido enmascarado; roughness variable entre roca y fisura.
- **Patas:** extremidades con codo/rodilla y tres dedos con garras; se quitaron los bultos elipsoidales de hombro/cadera que rompían la silueta.
- **Cola:** S-curve elevada sobre la grupa, con llama terminal.
- **Vista posterior:** cresta con profundidad real (láminas cruzadas) y cola visible; render específico a 6,4 m y 55° verticales.

## D. Comparativa

[salamander-before-after.png](./salamander-before-after.png): V1 re-renderizada y V2 con **las mismas cámaras, luces y mundo**. La V2 se percibe más limpia en piel y cresta lateral, pero **no resuelve el rostro**: los ojos siguen leyéndose saltones y el hocico ancho mantiene el aire de rana. El fuego V2 gana silueta pero pierde saturación y volumen, y parece cristal tallado más que llama. No puedo afirmar una mejora global significativa.

## E. Métricas medidas

| Métrica | V1 | V2 |
|---|---|---|
| Triángulos | 77.010 | **61.644** |
| Vértices (Blender) | 38.615 | 30.966 |
| Polígonos | 60.650 | 53.252 |
| Primitivas/nodos GLB | 55 | 73 |
| Materiales | 8 | 10 |
| Atlas | 2 × 2048² | 3 × 2048² |
| Tamaño GLB | 4.646.424 B | 5.338.812 B |
| `salamander*.blend` | 4.870.725 B | 5.757.170 B |
| Dimensiones Blender | 0,886 × 1,898 × 0,994 m | 0,802 × 1,891 × 0,961 m |
| Rig | No | No |
| Animaciones | 0 | 0 |
| SHA-256 GLB | `633c9157…` | `c885047eccd2fe1458fa5b2e219bd5691dba98416975a7c8323efd7df36e8935` |

Construcción + exportación: 16–19 s. Ocho renders en Cycles 40 muestras, 1200×1000, AgX, CPU Intel i3-1005G1 (6 hilos): 446 s en total. No se midieron FPS ni draw calls en navegador; no se inventan.

## F. Validación ejecutada

| Comprobación | Resultado |
|---|---|
| `validate_salamander_v2.py` (reapertura + import GLB) | **PASS — 2.510 comprobaciones, 0 errores** |
| Bounds blend ↔ GLB reimportado | Idénticos: X −0,401..0,401 · Y −0,838..1,053 · Z 0..0,961 |
| Triángulos blend / import / GLB | 61.644 / 61.644 / 61.644 |
| Manifold, sin modificadores, sin shape keys, sin acciones | PASS por malla |
| Coordenadas finitas y caras no degeneradas | PASS |
| GLB sin cámaras, luces, skins, animaciones ni URIs | PASS |
| `verify_glb_v2.mjs` con three 0.160 | **PASS**; 73 primitivas, 10 materiales, 3 atlas decodificados |
| SHA de `three-validation.json` = GLB entregado | Coincide |

Incidencias corregidas y documentadas: la vista a distancia de juego salió negra por usar coordenadas Y-up de glTF en Blender (Z-up); se corrigió el generador y se re-renderizó. Las hojas de fuego generaban caras de área cero en las puntas; se reconstruyeron como sólidos cerrados de dos conchas y borde, y la malla se revalidó. Nada de esto se ocultó.

## G. Limitaciones pendientes (por qué BLOCKED)

1. **Rostro — fallo crítico.** Los ojos siguen siendo esferas grandes y brillantes con pupila plana; el párpado superior es una banda y la ceja un listón. No hay expresión neutral con intención; se lee anfibio caricaturesco, no protagonista valiente/tierno.
2. **Cresta.** Silueta de llama correcta en el plano, pero color salmón, superficies planas y cantos rectos; no convence como fuego ni con emisión moderada. Las hojas cruzadas dan volumen, pero se leen como cristales.
3. **Piel.** Fisuras finas y homogéneas; menor contraste que V1 y sin variación anatómica real (hombros, vientre, articulaciones). La máscara del vientre se derrama al pecho y la cara interna de las patas.
4. **Anatomía.** Volúmenes suaves de loft; las patas siguen siendo tubos y el vientre un bulbo. No hay retopología de deformación, UV de producción ni pruebas de skinning.
5. **Vista posterior.** La cresta domina y la llama de cola queda oculta tras el cuerpo a distancia de juego.
6. **Producción.** 73 primitivas y 10 materiales no están optimizados para runtime; el GLB usa 3 atlas de 2048² (coste de VRAM no medido).

**Qué se necesita para desbloquear:** una pasada de escultura manual en Blender (pincel y retopología) sobre cráneo, párpados, hocico y encías; autoría de fuego por capas con color/emisión y rotura de silueta; máscara de vientre por zonas anatómicas; y presupuesto de arte/tiempo suficiente para iterar con revisión humana entre pasadas. El pipeline reproducible, los validadores y la comparativa A/B ya están listos para ese trabajo.

## H. Estado final

**BLOCKED.** Existen archivos y renders reales inspeccionables, pero el objetivo artístico —una V2 significativamente más cercana al concepto— no se cumple con la evidencia actual, y no voy a etiquetar una mejora parcial como producto terminado. Sin retopología, rigging, animaciones, integración ni commits, a la espera de decisión humana.
