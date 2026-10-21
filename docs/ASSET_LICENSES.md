# 🎨 Registro de licencias de assets — Animal Combat

> Alcance: POC **Cali Viva / Plazoleta del Río** (rama `design/m2-cali-viva-deepseek-poc`).
> Regla del proyecto: **todo asset debe tener licencia registrada aquí antes de entrar al repositorio.**

## 1. Dependencias de runtime del POC

| Asset | Versión | Licencia | Ubicación en el repo | Origen |
|---|---|---|---|---|
| three.js (build ESM minificado) | `three@0.160.1` | **MIT** | `js/vendor/three/three.module.min.mjs` | Paquete npm `three@0.160.1` (dependencia declarada en `package.json`) |
| three.js (texto de licencia) | `three@0.160.1` | **MIT** | `js/vendor/three/LICENSE` | Copia literal de `node_modules/three/LICENSE` |

Se **vendoriza** el build en lugar de cargarlo desde un CDN: el POC no ejecuta código de
terceros en tiempo de ejecución desde otro origen y `plazoleta.html` aplica una CSP
estricta (`default-src 'self'; script-src 'self'; object-src 'none'`), sin scripts inline ni
importmap (los módulos importan el build por ruta relativa). La extensión `.mjs` es
deliberada: así Node también puede importarlo en los tests (en un paquete `type: commonjs`
un `.js` se interpretaría como CommonJS).

Reproducir o actualizar el vendorizado:

```bash
pnpm add three@<versión> --save-exact
node -e "const fs=require('fs');fs.mkdirSync('js/vendor/three',{recursive:true});fs.copyFileSync('node_modules/three/build/three.module.min.js','js/vendor/three/three.module.min.mjs');fs.copyFileSync('node_modules/three/LICENSE','js/vendor/three/LICENSE')"
```

## 2. Arte del POC: producción propia (procedural, generada por código)

Todo el arte visual del POC es **original de este repositorio**: no se descargó ni se copió
ningún modelo, textura, sprite, tipografía o audio de terceros.

| Elemento | Técnica | Autoría / licencia |
|---|---|---|
| Terreno, casona republicana, puente y arcos, muros de ribera, mobiliario urbano | Geometría procedural con primitivas de three.js (`Box`, `Cylinder`, `Cone`, `Torus`, `Icosahedron`) generada en `js/world/plazoleta/props.mjs` | Original · misma licencia del proyecto (`ISC`, ver `package.json`) |
| Samán centenario, palmas, hierba, buganvilla | Blobs y cilindros fusionados/instanciados en código | Original · ISC |
| Salamander (protagonista) y Lucía (NPC) | Rigs de partes rígidas articuladas por código (`characters.mjs`) | Original · ISC |
| Textura de piedra de la plaza y mapa de normales del agua | Generadas en runtime con `CanvasTexture` (ruido y campos seno deterministas) | Original · ISC |
| Cielo (gradiente por vértices), halo solar, siluetas de profundidad (Farallones/cerro) | Mallas con colores por vértice generadas en código | Original · ISC |
| Tipografías del HUD | Stack del sistema (`Inter`, `system-ui`, `Segoe UI`, `sans-serif`) | Fuentes del sistema operativo del usuario · no se distribuyen ficheros de fuente |
| Audio | **No se usa audio en este POC** | — |

### R1-B · concepto, no modelo terminado

| Asset | Autoría / licencia | Estado |
|---|---|---|
| `docs/r1b-salamander-orthos.svg` (referencias front/side/back) | Ilustración vectorial original creada para este repositorio · ISC (`package.json`); sin recursos de terceros | **Sólo concepto 2D.** No es un GLB, captura del juego ni prueba de calidad del modelo. Véase `docs/R1B_SALAMANDER_ASSET_BRIEF.md`. |

En la entrega R1-B inicial no se añadió modelo 3D. R1-B.2 y R1-B.2A incorporan producción
original estática para revisión artística, **sin rig ni animaciones**. La V1 se conserva
intacta en `assets/characters/salamander/` y respaldada fuera del worktree; la V2 vive en
`assets/characters/salamander/v2/`.

| Asset / fuente | Autoría / licencia | Proveniencia y alcance |
|---|---|---|
| `tools/blender/build_salamander.py`, `validate_salamander.py`, `verify_glb.mjs`, `decode_png.mjs`, `make_review_sheet.py` | Autoría original asistida por IA para Animal Combat World · ISC | Pipeline V1; Blender 5.2.2 LTS, sin generadores de imagen ni modelos descargados. |
| `assets/characters/salamander/salamander.blend`, `salamander-preview.glb` y atlas V1 | Geometría y materiales originales generados por el script anterior · ISC | V1 conservada para comparación y recuperación. |
| `tools/blender/build_salamander_v2.py`, `validate_salamander_v2.py`, `verify_glb_v2.mjs`, `render_v1_comparison.py`, `make_comparison.py` | Autoría original · ISC | Pipeline V2: reconstrucción de cabeza, ojos, cresta de hojas de fuego, atlas de fisuras y materiales PBR. |
| `assets/characters/salamander/v2/salamander-v2.blend` y `salamander-v2-preview.glb` | Geometría y materiales originales · ISC | Modelo estático V2; **no aprobado artísticamente**. |
| `assets/characters/salamander/v2/salamander-v2-{basecolor,emission,roughness}.png` | Texturas originales horneadas en Blender · ISC | Campo Voronoi 3D perturbado, máscara de fisura y rugosidad derivada; 2048×2048, sin fotografías ni texturas ajenas. |
| `docs/r1b/v2/*.png` | Renders reales de Blender 5.2.2 · ISC | Evidencia visual; `v1-comparison-*` re-renderiza la V1 original con las cámaras y luces de V2. |

Las cuatro capturas adjuntas por el usuario se consultaron como dirección visual:
`a61ba607…` (ejemplo lava lizard), `7e987954…` (Embercrest), `bfad6732…` (ficha Salamander)
y `b32c0bcf…` (moodboard de mascotas). No se verificó autor/licencia de las obras
representadas; **no se incorporan, redistribuyen, proyectan como texturas ni se extraen
mallas** de ellas. El modelo desarrolla de forma original rasgos generales solicitados
(cuadrúpedo volcánico, ojos ámbar, grietas, cresta y llama), no reproduce una malla ajena.
Esta atribución de trabajo original no constituye una certificación jurídica de los
conceptos del moodboard. Antes de incorporar cualquier asset externo se debe registrar
autor, URL de origen, licencia de redistribución y atribución.

## 3. Referencias culturales (no son assets)

La dirección de arte se inspira en elementos reales de Cali (Colombia): el río Cali, el
Puente Ortiz, el malecón, la arquitectura republicana de la ribera y el Samán como árbol
de sombra. Son **referencias de diseño**, no reproducciones: no se ha usado fotografía,
mapa, plano ni material con derechos de terceros.

## 4. Comprobación automática

`tests/unit/plazoleta-scene.test.cjs` verifica este registro:

- `docs/ASSET_LICENSES.md` existe y declara MIT, la versión `three@0.160.1` y el arte procedural.
- `js/vendor/three/LICENSE` existe.
- `plazoleta.html` y todos los módulos del POC **no** referencian `cdnjs`, `unpkg`, `jsdelivr`
  ni URLs absolutas de importación.
