# Protocolo de validación H2 — comparación de tres candidatos V3

**Objetivo:** elegir, con evidencia y decisión humana, uno de tres candidatos imagen-a-3D para refinarlo en H3. **No incluye** rigging, animación, retopología final ni integración en el juego.

## 1. Entradas

- Tres GLB crudos (A/B/C) generados con **un único proveedor** y los mismos ajustes.
- Nombres de archivo ciegos (`cand-01.glb`, `cand-02.glb`, `cand-03.glb`); el mapa A/B/C se guarda aparte hasta cerrar la puntuación.
- Manifiesto con SHA-256, proveedor, plan, fecha, créditos consumidos y términos aceptados.
- Si el proveedor entrega rig o animación, se **retiran** para la comparación (no se evalúa rigging aquí).

## 2. Normalización obligatoria

En Blender 5.2.2, por candidato:

1. Importar GLB; aplicar transformaciones.
2. Centrar el *bounding box* en X/Z de suelo; pies en **Z=0** (Blender), equivalencia glTF Y=0.
3. Escalar uniformemente para que la altura total del *bounding box* sea **1,00 m** (sin deformar proporciones).
4. Orientar el hocico hacia **−Y de Blender** (= **+Z glTF**).
5. Eliminar cámaras, luces, rigs y animaciones del archivo de comparación.
6. Material **clay único**: gris neutro `#9a9a9a`, roughness 0,7, sin texturas.
7. Registrar: triángulos, vértices, materiales, texturas, bounds, no-manifold, autointersecciones, piezas sueltas.

## 3. Renders (idénticos para los tres)

| Vista | Cámara | Encuadre |
|---|---|---|
| Frontal | ortográfica, (0, −4; 0,50) → (0, 0; 0,48) | escala 1,90 |
| Lateral derecha | (4, 0,04; 0,50) → (0, 0,04; 0,48) | escala 2,40 |
| Posterior | (0, 4; 0,50) → (0, 0; 0,48) | escala 1,90 |
| Tres cuartos | (2,45, −3,35; 1,60) → (0, 0,03; 0,47) | escala 2,20 |
| Primer plano facial | 85 mm, desde tres cuartos frontales | encuadre de cabeza |
| Distancia de juego | 6,4 m, 55° vertical, 22° de picado, detrás | igual que R1-A |

- Fondo gris medio, tres luces de área (key/fill/rim) y suelo neutro.
- Cycles 32 muestras con denoise o Workbench studio; misma resolución 1200×1000.
- Además del clay, un render con los materiales originales del proveedor para detectar texturas rotas, pero **la selección se basa en clay** (la textura se rehace en H3).

## 4. Rúbrica de puntuación (1–10 por criterio)

| # | Criterio | Qué se evalúa |
|---|---|---|
| 1 | Silueta frontal | Masa, simetría, lectura de cabeza/patas/cresta |
| 2 | Silueta lateral | Compacto atlético, lomo, cola en S, cresta |
| 3 | Silueta posterior | Lectura a cámara de juego: cresta, cola, huecos de patas |
| 4 | Rostro y expresión | Cuencas, hocico, boca, cejas; no rana |
| 5 | Ojos | Integración, iris/pupila, párpados |
| 6 | Cresta | Forma de fuego orgánico, no cristales/púas |
| 7 | Piel y grietas | Patrón irregular, vientre, garras (geometría en clay; color en el render material) |
| 8 | Anatomía y patas | Articulaciones, dedos, apoyos |
| 9 | Cola | Inserción, grosor, llama terminal |
| 10 | Fidelidad al brief y originalidad | Se parece a la dirección V3 y no copia IP ajena |

**Aprobación:** media ≥ 7,5 **y** ningún criterio < 6. La puntuación final la emite el usuario; los agentes sólo aportan mediciones y observaciones.

## 5. Desempates y rechazos

- Desempate 1: mejor criterio 4 (rostro) y 6 (cresta).
- Desempate 2: menor complejidad geométrica con igual puntuación.
- **Rechazo automático:** malla rota/no solucionable, texturas sin licencia, resultado que reproduzca una IP protegida, o licencia del proveedor incompatible con distribución comercial.

## 6. Procedimiento de decisión

1. Generar los tres candidatos y archivar los GLB + manifiesto fuera de Git.
2. Normalizar y renderizar con el mismo script (una sola ejecución por candidato).
3. Componer hoja ciega A/B/C con las seis vistas y la tabla de métricas.
4. Puntuar de forma independiente (usuario + revisión técnica) sin ver el nombre del candidato.
5. Abrir el mapa, registrar la decisión y el motivo.
6. Sólo el candidato elegido pasa a H3; los otros dos se archivan, no se borran.

## 7. Entregables H2

- `docs/r1b/h2/candidates/cand-0X.glb` (o ruta de assets) + manifiesto SHA-256.
- `docs/r1b/h2/renders/clay-*.png` por candidato.
- `docs/r1b/h2/comparison-sheet.png` ciega.
- `docs/r1b/h2/metrics.json` y `decision.md` con la puntuación humana.
- Registro de licencia/plan del proveedor y captura de los términos aplicados.

## 8. Fuera de alcance

Rigging, skinning, animaciones, retopología definitiva, LOD, integración en `plazoleta.html`, cambios de simulación/cámara/colisión. Cualquier avance a esas fases requiere aprobación artística ≥7/10 y una orden explícita.
