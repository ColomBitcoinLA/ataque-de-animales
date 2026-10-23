# H3 — Art Direction & Reference Lock (plan, sin ejecución)

**Estado:** planificación. No se genera ningún modelo 3D en H3, no se contacta ningún proveedor y no se gastan créditos. El objetivo es **congelar una referencia artística original y verificable** que sirva de entrada a una futura generación (H4) y de patrón de aceptación humana.

## 1. Objetivo

Producir una **ficha artística canónica** de Salamander V3 —original, coherente en cuatro vistas y con el rostro resuelto— y bloquearla con hashes y control de cambios, de modo que cualquier candidato 3D posterior se compare contra una referencia estable y no contra impresiones cambiantes.

## 2. Entregables

| Entregable | Contenido | Formato |
|---|---|---|
| `docs/r1b/h3/reference/salamander-v3-turnaround.png` | Cuatro vistas: frontal, lateral derecha, posterior y tres cuartos | PNG 2048×2048 por vista o hoja 4K |
| `docs/r1b/h3/reference/salamander-v3-face.png` | Rostro en primer plano: ojos, párpados, hocico, boca, cejas | PNG 2048² |
| `docs/r1b/h3/reference/salamander-v3-crest-tail.png` | Detalle de cresta y llama de cola, con silueta y gradiente | PNG 2048² |
| `docs/r1b/h3/reference/palette.json` | Paleta volcánica con valores sRGB y roughness sugerida | JSON |
| `docs/r1b/h3/REFERENCE_LOCK.md` | Ficha, dimensiones, criterios y registro de aprobación humana | Markdown |
| `docs/r1b/h3/REVIEW_CHECKLIST.md` | Checklist de revisión y rúbrica ≥7/10 | Markdown |

Las imágenes deben ser **originales**: dibujadas o renderizadas por el equipo, sin copiar mascotas existentes y sin usar como base imágenes de autoría incierta. Si se usa la ficha aportada por el usuario, debe acreditarse autoría y licencia antes de convertirla en entrada de generación.

## 3. Contenido obligatorio de la ficha

### 3.1 Cuatro vistas anatómicamente coherentes
- Misma escala, misma pose neutra de apoyo, misma luz plana y mismo fondo gris.
- Silueta idéntica en los puntos de contacto: altura de cruz, longitud, cadera, inserción de cola.
- Sin cambios de proporción entre vistas; sin perspectiva en las vistas ortográficas.
- La vista posterior debe incluir la lectura de la cámara de juego: cresta sobre la grupa, cola desplazada, cuatro huecos de patas.

### 3.2 Rostro y ojos
- Cráneo en cuña redondeada con estante supraorbitario.
- Cuencas reales; párpado superior que cubre 20–30 % del ojo, párpado inferior fino.
- Iris ámbar con anillo limbal, pupila vertical-ovalada, un solo reflejo pequeño; sin esclera blanca.
- Hocico corto y romo, narinas hundidas, comisuras elevadas 3–5°, mandíbula con masa.
- Expresión neutra ya carismática: valiente, amistosa, curiosa; nada de sorpresa ni ojos saltones.
- Hoja aparte con tres expresiones de control: neutra, alerta, alegre.

### 3.3 Cresta y cola
- 4–5 lenguas de fuego sólidas y opacas, con curvas S y puntas divididas; sin cristales, púas ni pétalos.
- Base fusionada al lomo; sin huecos flotantes.
- Gradiente raíz `#5c1204` → `#ff5a1f` → `#ffd36b`, con núcleo ámbar; legible sin bloom.
- Cola en S elevada, 0,55–0,65 m, con llama terminal de 0,12–0,18 m.

### 3.4 Paleta volcánica
- Basalto `#15171a`–`#2b2723`, vientre `#3a2418`–`#4a2c1a`, garras `#6b4a2a`, ojos ámbar.
- Fisuras irregulares con anchos variables; sin patrón de panal uniforme.
- Roughness: roca 0,75–0,88; fisura 0,35–0,50; ojos 0,15–0,25.

### 3.5 Escala y dimensiones canónicas
- Altura total **0,98–1,02 m** (límite duro 1,02).
- Lomo **0,52–0,58 m**; longitud **1,82–1,92 m** (hocico +0,82/+0,86, cola −1,00/−1,05).
- Anchura de cuerpo **0,62–0,66 m**; cuatro patas articuladas; pies en Y=0.
- Orientación glTF **+Y arriba, +Z hocico**; origen entre las patas.
- Radio de colisión R1-A **0,34 m** intacto.

## 4. Proceso de Reference Lock

1. **Borrador**: producir la ficha con las cuatro vistas y las hojas de detalle.
2. **Revisión interna**: comprobar coherencia dimensional, silueta y anti-objetivos.
3. **Revisión humana**: el usuario puntúa la rúbrica; se requieren **≥7/10 en identidad, rostro, ojos, silueta, cresta, material, vista posterior y proporciones**, con media ≥7,5.
4. **Correcciones**: hasta dos rondas; cada ronda conserva la anterior, no la sobrescribe.
5. **Lock**: la versión aprobada se marca como `v1.0-locked`, se calcula SHA-256 de cada archivo y se registra en `REFERENCE_LOCK.md` con fecha y aprobador.
6. **Control de cambios**: cualquier cambio posterior crea `v1.1` con motivo, diff visual y nueva aprobación; nunca se edita la versión bloqueada.

## 5. Criterios de revisión humana

| Criterio | Peso | Umbral |
|---|---:|---:|
| Identidad de protagonista (ternura + valentía) | 1 | ≥7 |
| Rostro y expresividad | 2 | ≥7 |
| Ojos integrados (no rana) | 2 | ≥7 |
| Silueta frontal/lateral/posterior | 2 | ≥7 |
| Cresta de fuego (no cristales) | 2 | ≥7 |
| Material volcánico y paleta | 1 | ≥7 |
| Vista posterior a 6,4 m | 1 | ≥7 |
| Proporciones y coherencia entre vistas | 2 | ≥7 |

**Rechazo automático:** ojos saltones, esclera blanca, cráneo plano, cresta cristalina, cola que tapa la espalda, inconsistencia de escala entre vistas o rasgos de IP ajena.

## 6. Fuera de alcance

- Generación 3D, pruebas con proveedores o consumo de créditos.
- Modelado, escultura, retopología, rigging o animación.
- Integración en `plazoleta.html`, cambios de simulación, cámara o colisiones.
- Publicación de la ficha o de cualquier derivado sin revisión de licencias.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| La ficha del usuario tiene autoría no verificada | Producir ficha original propia; acreditar derechos antes de usarla como entrada |
| Inconsistencia entre vistas | Plantilla con guías de altura/longitud y revisión cruzada |
| «Ojos de rana» otra vez | Hoja de rostro aparte con umbral explícito y revisión humana temprana |
| Cresta que parece cristal | Prueba de silueta en negro y sin emisión |
| Cambios silenciosos tras la aprobación | Lock con hashes y versionado |

## 8. Criterio de salida

H3 termina cuando existe una ficha original bloqueada (`v1.0-locked`) con sus hashes, la aprobación humana registrada y la rúbrica ≥7/10. Sólo entonces se podrá planificar H4 (generación y selección de candidatos), que seguirá requiriendo autorización expresa y un plan de proveedor con licencias resueltas.
