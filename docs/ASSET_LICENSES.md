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
