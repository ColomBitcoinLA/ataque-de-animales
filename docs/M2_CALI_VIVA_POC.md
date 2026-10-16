# 🐾 M2 · POC "Cali Viva — Plazoleta del Río" (candidato DeepSeek)

> Rama: `design/m2-cali-viva-deepseek-poc` · Base: `877930b`
> Alcance: **prototipo jugable de 20 m × 20 m** con tercera persona, puente, casona
> republicana, Samán, NPC con interacción real, fauna reactiva, cámara con oclusión y
> métricas de rendimiento medibles.

---

## 1. Qué es (y qué no es)

**Es**: un recinto jugable pequeño y completo donde se puede caminar/correr, chocar, subir
al puente, observar el río, hablar con Lucía, completar una cadena de misión, ver fauna que
reacciona y medir el rendimiento real con `?perf=1`.

**No es** (deliberadamente fuera de alcance): mundo grande, red multijugador, combate
elemental modificado, backend nuevo, sistema de assets 3D externo. La simulación de red
autoritativa sigue siendo trabajo de M2.5+/M3.

| Requisito del encargo | Estado |
|---|---|
| Puente Ortiz + orilla del río | ✅ tablero transitable sobre el río, 3 arcos, pretiles, rampa |
| Casona colonial/republicana con vegetación | ✅ arcada de 3 vanos, balcón, teja, buganvilla |
| Samán | ✅ copa de 6.5 m, anillo de banca, sombra proyectada |
| Salamander en tercera persona (idle/walk/run/turn) | ✅ rig de 10 mallas animado por distancia |
| Lucía NPC con interacción real | ✅ 5 pasos de misión, confianza persistente, diálogo por estado |
| Caminar/correr/colisión | ✅ `world-sim` determinista + `kinematics` compartido |
| Cámara pitch/yaw/zoom con oclusión | ✅ `camera-solver` puro + garantía de no penetración |
| HUD legible y moderno | ✅ 5 zonas + diálogo accesible + overlay de métricas |

## 2. Cómo ejecutarlo

```bash
pnpm install
pnpm start                     # servidor en http://localhost:8080
# Página del POC (CSP estricta, three vendorizado)
http://localhost:8080/plazoleta.html
http://localhost:8080/plazoleta.html?perf=1        # overlay de métricas medidas
http://localhost:8080/plazoleta.html?quality=low   # calidad baja (sin sombras, dpr 1)
http://localhost:8080/plazoleta.html?seed=42       # semilla de simulación
# Modo clásico intacto
http://localhost:8080/mokepon.html
```

Controles: `WASD`/flechas mover · `Shift` correr · `E` interactuar · arrastrar para girar ·
rueda o pinza para acercar · `H` ocultar ayuda · `Esc` cerrar diálogo. En táctil: pad
direccional + botón de interacción.

## 3. Arquitectura (separación estricta de responsabilidades)

```text
ENTRADA (teclado/ratón/táctil)          js/world/plazoleta/main.mjs
        │  intención en espacio de mundo (moveX, moveZ, run)
        ▼
SIMULACIÓN PURA                          js/world/plazoleta/world-sim.mjs
        │  + behaviors.mjs (Lucía, palomas)         [sin three, sin DOM, sin red]
        │  + map-v1.mjs (datos canónicos)           [sin three, sin DOM, sin red]
        │  + js/simulation/kinematics.mjs (COMPARTIDO con el modo clásico)
        ▼
ESTADO DEL MUNDO (datos planos, deterministas, cero asignaciones por tick)
        │
        ├──────────────► CÁMARA PURA         js/world/plazoleta/camera-solver.mjs
        │                                     (spring arm, oclusión, límites)
        ▼
PRESENTACIÓN (three.js)                  props.mjs · characters.mjs · render-kit.mjs
        │  LEE el estado; nunca lo escribe
        ▼
HUD + MÉTRICAS                           hud.mjs · perf.mjs
```

Reglas verificadas por tests (`tests/unit/plazoleta-sim.test.cjs` → "arquitectura: …"):

1. `world-sim`, `map-v1`, `behaviors` y `camera-solver` **no** mencionan `three`, `document`,
   `window`, `WebSocket`, `fetch`, `localStorage` ni `requestAnimationFrame`.
2. La presentación nunca muta el estado de simulación: los rigs se animan a partir de
   `player.phase`, `player.heading`, `npc.alert`, etc.
3. La animación no genera desplazamiento: la **fase de locomoción se acumula por distancia
   recorrida** (`phase += distance / stride`), lo que elimina el patinaje por construcción y
   hace que caminar y correr tengan cadencias distintas.

### Archivos

| Archivo | Responsabilidad | Líneas aprox. |
|---|---|---|
| `js/simulation/kinematics.mjs` | Primitivas compartidas: integración, recorte, ocupación AABB, slide, variante de cero asignaciones | ~250 |
| `js/world/plazoleta/map-v1.mjs` | `MAP_V1`: límites, zonas, superficies, sólidos con banda vertical, POI, misión, familias de props, presupuesto de draws, `validateMap` | ~380 |
| `js/world/plazoleta/world-sim.mjs` | Estado y tick del mundo, locomoción, interacción, misión, eventos, resumen | ~330 |
| `js/world/plazoleta/behaviors.mjs` | Lucía (orientación/saludo) y palomas (territorio/huida/retorno) + contenido de diálogo | ~250 |
| `js/world/plazoleta/camera-solver.mjs` | Solucionador puro de cámara: rayo-AABB, brazo con histéresis, suavizado independiente de dt, zoom/pitch | ~220 |
| `js/world/plazoleta/render-kit.mjs` | Renderer, gestión de color, tone mapping, sol/sombra/niebla, cielo, `dispose`, calidad adaptativa | ~250 |
| `js/world/plazoleta/props.mjs` | Librería de materiales compartidos, texturas procedurales, escena estática fusionada + instanciada, `stats` y `dispose` | ~520 |
| `js/world/plazoleta/characters.mjs` | Materiales y rigs de Salamander y Lucía + animadores | ~300 |
| `js/world/plazoleta/hud.mjs` | HUD accesible con dirty-check, diálogo con trampa de foco, overlay de métricas | ~260 |
| `js/world/plazoleta/perf.mjs` | Ventana de frames p50/p95/p99, `renderer.info`, heap, GPU timer opcional, degradación medida | ~180 |
| `js/world/plazoleta/main.mjs` | Composición, entrada, bucle de paso fijo, ciclo de memoria | ~400 |
| `js/world/plazoleta/geometry-utils.mjs` | Fusión de geometrías, caché, instancing | ~150 |
| `plazoleta.html`, `css/plazoleta.css` | Página y estilos del HUD | ~140 / ~330 |

## 4. `MAP_V1`: una sola fuente para colisión, geometría y presupuesto

`map-v1.mjs` es la **representación canónica** del recinto. Nada de geometría o colisión se
declara dos veces:

- `solids[]` → colisionadores AABB con **banda vertical** `[yMin, yMax]` y nota de autoría visual.
  Esto permite que el puente pase **por encima** del agua y del parapeto sin casos especiales:
  a pie el río bloquea (`y 0..0.06`), sobre el tablero (`feetY 1.15`) no.
- `surfaces[]` → superficies caminables (planas o rampa interpolada) con `stepUp = 0.42`:
  no se puede "trepar" al tablero desde el suelo, sí subir por la rampa.
- `zones[]` → el orden es prioridad (`puente` antes que `rio`).
- `interactables[]` → POI con verbo, radio, etiqueta y `feetY` opcional (el mirador está sobre el tablero).
- `propFamilies[]` → listas de instancias `[x, z, rotY, escala, y]` que alimentan el instancing
  y el conteo del presupuesto.
- `drawBudget` → presupuesto planificado por construcción.
- `validateMap()` → **contrato ejecutable** (20×20 m, playArea dentro de bounds, sólidos finitos y
  no degenerados con nota de autoría, spawn y POI libres, triggers de misión existentes,
  familias de props válidas, presupuesto ≤ 90).

## 5. Cinemática compartida (sin verdad paralela)

`js/simulation/kinematics.mjs` es ahora la única aritmética de movimiento:

- `MovementSystem` (modo clásico, píxeles, x/y) delega en `integrateVelocity` y `clampToMapDimensions`.
- `world-core` (prototipo v0, x/z, metros) delega en `advanceDirected`.
- El POC de la plazoleta usa `advanceDirectedInto` (variante **sin asignaciones**) con el área
  efectiva del cuerpo y las listas de sólidos por nivel.

`tests/unit/kinematics.test.cjs` verifica la paridad cruzada: para los mismos inputs, el modo
clásico y el mundo producen **el mismo desplazamiento** (y con el mismo redondeo), la misma
semántica de deslizamiento y los mismos errores ante entradas corruptas.

## 6. Cámara (contrato puro)

`camera-solver.mjs` no conoce three. Recibe sujeto + intención + sólidos de cámara y devuelve
la pose. Garantías probadas en `tests/unit/plazoleta-camera.test.cjs`:

- el brazo se **acorta** ante oclusión y se **alarga despacio** (histéresis anti-bombeo);
- barrido de 16 posiciones × 16 yaw × 4 pitch: la cámara **nunca** queda dentro de un sólido;
- `pitch` (−8°…+32°) y `zoom` (3.2–10.5 m) acotados;
- suavizado `1 − exp(−k·dt)`: 60 pasos de 1/60 s ≡ 1 paso de 1 s (independiente del frame rate);
- FOV 55° → 61° al correr.

## 7. Rendimiento: presupuesto y medición

- Plan por construcción (`plannedDrawCalls()`): **56 draw calls** de pase principal (24 grupos
  estáticos fusionados + 14 mallas instanciadas + 18 mallas de personajes) y **82** contando el
  pase de sombra. Criterio del encargo (≤ 90) cumplido **sin** necesidad de recortar.
- Sombra: frustum ajustado a ±14.5 m con mapa de 2048 → ≈ **1.4 cm por téxel** (frente a los
  13.7 cm del prototipo v0), sin costo adicional de textura.
- Materiales: **18** compartidos para props + **6** de personajes; ninguno por malla.
- Instancing: 13 familias de props + corona de palmas = **14 draws** para **≥ 100 instancias**.
- Cero asignaciones por tick en régimen estable (buffers de scratch en el estado; test dedicado).
- `?perf=1`: frame time p50/p95/p99 (ventana de 120 frames), FPS medio, ms de simulación /
  animación / render, `renderer.info.render.calls|triangles`, programas, heap JS y tiempo de GPU
  si el navegador expone `EXT_disjoint_timer_query_webgl2`. El resumen también se publica en
  `document.title` para poder capturarlo sin DevTools.
- Degradación adaptativa **basada en medición**: si p95 > 16.7 ms durante 90 frames, baja a
  calidad `low` (dpr 1, sin sombras) y lo informa en el HUD.

## 8. Ciclo de memoria

- `render-kit.dispose()` libera geometrías, materiales, texturas, el renderer y el canvas.
- `props.dispose()` / `createMaterialLibrary().dispose()` / rigs de personajes: liberación explícita.
- `pagehide` → `dispose()` completo; `visibilitychange` → pausa del bucle y reinicio del acumulador.
- `webglcontextlost` → pausa + mensaje accesible con salida al modo clásico.
- Sin crecimiento de heap apreciable en 20 000 ticks de simulación (test de humo).

## 9. Seguridad y límites de confianza

- **three.js 0.160.1 vendorizado** en `js/vendor/three/` (MIT, licencia registrada en
  `docs/ASSET_LICENSES.md`). El POC **no** carga código de terceros en runtime: los módulos
  importan el build por ruta relativa, sin importmap.
- `/plazoleta.html` se sirve con **CSP estricta**: `default-src 'self'; script-src 'self';
  style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; object-src 'none';
  frame-ancestors 'self'` — **sin `unsafe-inline` ni `unsafe-eval`**. Por eso la página no usa
  scripts inline ni importmap: un importmap inline sería bloqueado por la propia CSP (defecto
  detectado y corregido durante este POC, ver informe).
- No hay ninguna llamada de red en el POC: la simulación es local y de un solo jugador.
- La XP del POC es **de demostración**: la etiqueta del mapa dice literalmente
  "simulación local · no acredita progreso real", no se envía a ningún servidor y no toca la
  progresión autoritativa de Fase 4.
- Rutas previas intactas: `/`, `/world.html` y `/mokepon.html` conservan su comportamiento; la
  suite de seguridad existente **no fue modificada** (se añadió cobertura nueva, no se relajó nada).

## 10. Accesibilidad

- `aria-live="polite"` en objetivo y prompt de interacción; `role="status"` en avisos.
- Diálogo modal con **trampa de foco**, foco inicial en el botón principal, restauración al
  cerrar y cierre con `Esc`.
- Texto informativo ≥ 14 px, contraste alto sobre *scrim* con blur, sin información codificada
  sólo por color (icono + texto).
- `prefers-reduced-motion` reduce bob, balanceos y transiciones.
- Aviso de WebGL no disponible con enlace al modo clásico 2D; `<noscript>` informativo.
- Blancos táctiles ≥ 56 px y pad direccional en punteros gruesos.

## 11. Evidencia de aceptación

### 11.1 Gates del repositorio (medidos)

| Comprobación | Comando | Resultado |
|---|---|---|
| Sintaxis de todo el proyecto | `pnpm run check` | **67** archivos Node/CJS/MJS + 5 ESM de navegador |
| Suite completa | `pnpm test` | **176 tests · 176 pass · 0 fail** (45 nuevos del POC + 1 de integración) |
| Gate M0 (seguridad, red, regresión) | `pnpm run gate:m0` | **13/13 checks** |

### 11.2 Exposición visual: antes (prototipo v0) vs después (POC)

Capturas idénticas (1280×720, mismo Chrome headless con rasterizador por software) y
medición con `tools/analyze-render.mjs` (decodifica el PNG y calcula estadísticas):

| Métrica | `world.html` (v0) | `plazoleta.html` (POC) |
|---|---|---|
| Luminancia media | 211.67 | **60.22** |
| p50 de luminancia | 255 (saturado) | **45.07** |
| p95 de luminancia | 255 (saturado) | **221.33** |
| Rango p95−p05 (contraste) | 187.66 | **211.32** |
| **Píxeles recortados a blanco (≥250 en RGB)** | **54.89 %** | **0.00 %** |
| Banda de medios tonos (60–200) | 23.35 % | 19.05 % |
| Saturación media | 0.121 | **0.305** |
| Familias de tono con >1 % | 4 | 3 |
| Luma mitad superior / inferior | 195 / 228 (plano) | 71 / 50 (cielo arriba, suelo abajo) |

El defecto reportado por los jugadores ("terreno sobreexpuesto, casi blanco") queda
**medido**: más de la mitad del frame del prototipo v0 estaba recortado a blanco puro. El POC
no recorta nada y conserva detalle en medios tonos con color real. Capturas en
`docs/capture-world-v0.png` y `docs/poc-cali-viva-plazoleta.png`.

### 11.3 Render real medido en navegador (`renderer.info`)

| Métrica | Valor medido | Plan |
|---|---|---|
| draw calls | **57** | 58 |
| triángulos | **7 947** | ≤ 260 000 |
| programas de shader | 11 | — |
| heap JS | 7.7 MB | — |

Estos valores provienen del overlay `?perf=1` (captura en `docs/poc-cali-viva-perf.png`) y son
independientes de la velocidad del rasterizador.

### 11.4 Lo que NO está medido (honestidad de métricas)

- **Frame time / FPS**: el entorno de captura es Chrome headless con rasterizador por software
  (SwiftShader) y tiempo virtual; los valores observados (p50 ≈ 33 ms) **no** representan GPU
  real. La instrumentación funciona y está lista para medirse en hardware real con `?perf=1`.
- **Tiempo de GPU**: `EXT_disjoint_timer_query_webgl2` está disponible y reporta valores, pero
  bajo software rasterization no son comparables a un GPU.
- **Móvil**: sin medición.
- **Estética**: las métricas anteriores verifican exposición, contraste, color y presupuesto,
  no gusto. La revisión estética requiere ojos humanos sobre las capturas.

## 12. Limitaciones conocidas

1. Un solo jugador local: no hay autoridad de servidor ni interpolación de snapshots (M2.5).
2. Sin assets GLB ni esqueleto: los personajes son rigs de partes rígidas (10 y 8 mallas). El
   camino de escalado a 60 entidades es GLB + `SkinnedMesh` + LOD (ver informe de propuesta).
3. La misión es lineal y corta (5 pasos): es una demostración de estado real, no un sistema de
   misiones.
4. Las sombras de props pequeños dependen del frustum ajustado: si el recinto crece, hay que
   reajustar `sun.shadow.camera` y probablemente pasar a sombras por cascada.
5. `?perf=1` mide en el navegador del jugador; las cifras de este repositorio proceden de la
   máquina de revisión y están etiquetadas como tales.
