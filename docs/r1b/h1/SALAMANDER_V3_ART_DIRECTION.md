# Salamander V3 — Dirección artística cerrada (R1-B.2B / H1)

**Estado:** especificación de preproducción. No hay V3 generada, ni rigging, ni integración. Sustituye como guía a la dirección de V1/V2, que quedan preservadas como prototipos rechazados (4/10 humano).

> **Revisión H1.1 (2026-10-20).** Corrige y aclara el contrato dimensional: la altura total es **0,98–1,02 m** (el «1,98» del resumen H1 fue una errata de transcripción, nunca un valor del documento); «hombros 0,62–0,68 m» se refiere a la **anchura transversal máxima del cuerpo a la altura de los hombros**, no a una altura; se alinea la altura del lomo con el brief (`shoulder Y≈0,55`) y se separan las compuertas H2/H4. Los cambios se documentan abajo; no se altera el contrato original del brief.

**Referencia estética:** ficha «SALAMANDER — FICHA VISUAL FINAL» aportada por el usuario en la conversación (hash `bfad6732…`), complementada por la hoja «Embercrest Salamander» (`7e987954…`). Se usan **sólo como dirección visual**; no se envían a ningún proveedor en H1 y su autoría no está verificada. No se copiarán mallas, texturas ni diseños de mascotas comerciales.

---

## 1. Identidad en una frase

Un salamander volcánico cuadrúpedo, compacto y atlético, de mirada ámbar valiente y amistosa, con piel de basalto agrietada por magma y una cresta de fuego orgánica que lo hace reconocible a 6,4 m.

Debe leerse como **protagonista**, no como mascota genérica ni como criatura terrorífica: valiente, curioso, leal, tierno sin debilidad.

## 2. Silueta y proporciones (contrato dimensional)

Unidades **metros**, glTF **+Y arriba**, **+Z hacia el hocico**, origen en el suelo entre las patas. Sin rig.

| Elemento | Objetivo | Cómo se mide |
|---|---|---|
| Altura total (suelo→punta de cresta) | **0,98–1,02 m** | *Bounding box* vertical del modelo en pose neutra; **nunca** supera 1,02 |
| Altura del hombro / lomo | **0,52–0,58 m** | Altura de la cruz (intersección cuello–dorso) en Y |
| Longitud hocico→cola | 1,82–1,92 m | Hocico **+0,82/+0,86** · punta de cola **−1,00/−1,05** en Z |
| Anchura máxima de hombros | **0,62–0,66 m** | Extensión **transversal (X)** del torso+masa escapular; no incluye patas abiertas |
| Anchura de cabeza | 0,34–0,40 m | Distancia máxima entre mejillas, eje X |
| Patas | 4 articuladas; delanteras 0,28–0,32 m, traseras 0,32–0,36 m | Longitud hombro→planta / cadera→planta |
| Dedos | 3–4 por pata con garra | Visible en silueta de apoyo |
| Cola | 0,55–0,65 m desde la cadera | Longitud de arco, base 0,10–0,12 m → punta 0,02 |
| Ojos | Ø 0,085–0,10 m; separación 0,06–0,08 m | 22–25 % del ancho craneal |
| Radio de colisión R1-A | **0,34 m, sin cambios** | Constante de simulación, no del modelo |

**Aclaraciones del contrato**

- **«1,98–1,02 m» no existe**: la altura correcta es **0,98–1,02 m**. El valor 1,98 era la errata del resumen de la entrega H1; este documento siempre contuvo 0,98–1,02 y el brief exige ≤1,02.
- **«0,62–0,68 m en hombros»** era ambiguo. Significa **anchura transversal máxima** del cuerpo con la masa de los hombros, alineada con el brief (`max body width ≈0,65`); el rango se cierra en **0,62–0,66 m**. La postura puede abrir las patas más allá de esa anchura sin cambiar la colisión.
- La **altura del lomo** sube a **0,52–0,58 m** para coincidir con `shoulder Y≈0,55` del brief. La cresta dispone de **0,40–0,50 m** sobre el lomo para que el total quede en **0,98–1,02 m**; 1,02 es un límite duro.
- **Escala y orientación**: metros, glTF **+Y arriba**, **+Z hocico**, origen en el suelo entre las patas, pies en Y=0. En Blender: Z arriba, hocico hacia −Y. Sin rotaciones ni escalas aplicadas pendientes.
- El brief es la autoridad del contrato; cualquier desviación de V3 se documenta aquí **antes** de modelar, nunca se aplica en silencio.

**Coherencia con `docs/R1B_SALAMANDER_ASSET_BRIEF.md`**

| Brief | V3 | Estado |
|---|---|---|
| shoulder Y≈0,55 | 0,52–0,58 | Coherente |
| top of crest ≤1,02 | 0,98–1,02 | Coherente |
| nose Z≈+0,85 | +0,82/+0,86 | Coherente |
| tail end Z≈−1,05 | −1,00/−1,05 | Coherente |
| max body width ≈0,65 | 0,62–0,66 | Coherente |
| collision radius 0,34 (R1-A) | sin cambios | Intacto |
| head-height contract 1,02 (R1-A) | sin cambios | Intacto |

**Silueta objetivo:** masa baja y compacta; cabeza grande pero no desproporcionada; pecho profundo, cintura algo más estrecha, caderas potentes; cola en S elevada; cresta alta que rompe el lomo. Debe caber en un bloqueo de 3 valores (cabeza/cresta, torso+patas, cola) legible en negro puro.

## 3. Cabeza y rostro (prioridad crítica)

- **Cráneo** ancho y redondeado en cuña, con frente abombada y **estante supraorbitario** que sobresale 0,02–0,03 m sobre los ojos. Sin cráneo plano de rana.
- **Cuencas reales**: ojos alojados en sockets con borde óseo visible; el globo ocular no debe sobresalir como esfera pegada. Profundidad del socket ≥0,025 m.
- **Párpado superior** grueso que cubre **20–30 %** del ojo, con ángulo interno ligeramente bajo (mirada decidida, no sorprendida). Párpado inferior fino, casi una línea.
- **Ojos** ámbar/naranja intenso, sin esclera blanca; iris con anillo limbal oscuro y degradado radial; pupila vertical-ovalada (35–45 % del iris); **un** reflejo pequeño (≤5 % del ojo) en el cuadrante superior. Nada de ojos saltones brillantes tipo rana.
- **Hocico corto** (0,16–0,22 m desde la línea ocular) y romo; narinas pequeñas y hundidas; **boca con comisuras elevadas 3–5°** (sonrisa sutil) y labio inferior definido; mandíbula con masa visible.
- **Expresión neutra** ya debe transmitir personalidad: cejas 8–12° hacia el centro, boca cerrada amable, mirada al frente.
- **Cheek/jowl** suave que una cabeza y cuello; evitar cabeza esférica sobre un cuello tubular.

## 4. Piel volcánica

- **Basalto oscuro** de valores bajos: `#15171a`–`#2b2723`, con variación de valor por zonas (no plano).
- **Fisuras de magma irregulares**: ramificación orgánica, anchos variables (finuras de 1–2 mm junto a grietas de 4–6 mm), más densas y calientes en hombros, caderas y base de cola; enfriándose hacia el vientre y el hocico.
- **Vientre diferenciado**: placas cálidas `#3a2418`–`#4a2c1a`, separadas de las fisuras, sin sangrado a patas ni cara.
- **Garras** de cuerno tostado `#6b4a2a`, rugosidad alta.
- **Roughness variable**: roca 0,75–0,88; fisura 0,35–0,5; ojos 0,15–0,25. La identidad debe sobrevivir **sin bloom** y en calidad baja.

## 5. Cresta ígnea (prioridad crítica)

- **No cristales, no púas, no pétalos**: 4–5 lenguas de fuego **sólidas y opacas** con curvas S, puntas divididas y solapamiento controlado.
- Base **fusionada** al lomo con un collar de roca oscura; sin huecos flotantes.
- Ritmo: lengua central más alta con **0,40–0,50 m sobre el lomo**, ajustada para que la altura total quede en **0,98–1,02 m** (nunca por encima de 1,02); laterales decrecientes y ligeramente retrasadas; una lengua pequeña sobre la nuca.
- Espesor 0,02–0,04 m; silueta irregular, nunca facetada ni de bordes rectos.
- Color: raíz `#5c1204` → cuerpo `#ff5a1f` → punta `#ffd36b`; emisión moderada que **no lave** el color. Legible en gris si se desactiva la emisión.

## 6. Cola

- Inserción anatómica en la cadera, no un tubo pegado.
- Curva en S que **sube por encima de la grupa** y se desplaza lateralmente 0,08–0,14 m, para no tapar la espalda desde la cámara trasera.
- Progresión de grosor 0,10–0,12 m en la base → 0,02 m en la punta.
- **Llama terminal** de 0,12–0,18 m, misma familia visual que la cresta, con núcleo ámbar.

## 7. Patas y anatomía

- Cuatro patas con **hombro, codo, muñeca/corvejón y tobillo** legibles; antebrazo algo más fino que el muslo.
- Pies plantados a Y=0, con dedos separados y garras; sin pezuñas ni pies de juguete.
- Pecho profundo, cintura leve, caderas potentes: compacto y ágil, capaz de caminar, correr, girar y combatir. Nada de proporciones imposibles de animar.

## 8. Lectura a 6,4 m (cámara R1-A)

**Método de comprobación (idéntico para V3 y para los candidatos de H2):**

1. Normalizar el modelo a **1,00 m de alto** con los pies en el suelo y el hocico en +Z.
2. Cámara perspectiva a **6,4 m** del punto medio, **detrás** (+Z negativo), **55° vertical** y **22° de picado**; sensor vertical 24 mm ⇒ distancia focal ≈ **23,05 mm**. Resolución 1200×1000.
3. Fondo neutro y luz pareja; un render en color y otro en **silueta negra**.
4. A esa distancia el campo vertical visible es ≈ 6,65 m: un personaje de 1,00 m ocupa **≈ 15 % de la altura del encuadre** (≈150 px). Se evalúa a ese tamaño, no ampliado.

**Criterios de lectura (todos obligatorios):**

1. La cresta se eleva por encima de la grupa y rompe el contorno superior.
2. La llama de cola aparece desplazada lateralmente respecto al eje del cuerpo.
3. Se distinguen **cuatro huecos** de patas contra el suelo.
4. La cabeza es más ancha que el cuello y muestra el punto ámbar de los ojos.
5. La silueta negra permite identificar la criatura sin textura ni materiales.

Si a 6,4 m el personaje es una masa indistinta, el diseño se rechaza antes de invertir en materiales.

## 9. Compuertas: H2 exploratoria ≠ H4 aprobación artística

| | **H2 — selección de candidato** | **H4 — aprobación artística** |
|---|---|---|
| Pregunta | ¿Cuál de los 3 candidatos merece refinarse? | ¿La V3 refinada alcanza la calidad exigida? |
| Comparación | Relativa y ciega entre candidatos | Absoluta contra el brief y la ficha |
| Materiales | Clay neutro; color sólo informativo | PBR final, atlas y renders finales |
| Puntuación | Rúbrica comparativa; puede haber empate | **≥7/10 en cada criterio y media ≥7,5** |
| Quién decide | Revisión humana con datos técnicos | **Sólo el usuario** |
| Qué autoriza | Pasar a refinamiento H3 | Publicar el asset y planificar rigging |
| Qué **no** autoriza | Aprobar V3 ni iniciar rigging | Retopología/rigging sin orden explícita |

H2 **no es una aprobación**: elegir un candidato no certifica calidad ni sustituye la compuerta H4.

## 10. Presupuesto técnico

- **40.000–80.000 triángulos** visibles; ≤ 12 materiales; ≤ 4 texturas 2048².
- Una malla principal + piezas separadas justificadas (ojos, crestas, garras). Sin partículas ni *cards* transparentes como única lectura del fuego.
- Exportación **GLB** con materiales PBR y atlas horneados; sin cámaras, luces, rig ni animaciones en esta fase.

## 11. Anti-objetivos (rechazo automático)

- Ojos de rana saltones, esclera blanca, mirada perdida.
- Cráneo plano y boca ancha sin mandíbula.
- Cresta de cristales, púas o gotas rosadas.
- Cuerpo globo con patas de tubo; pies diminutos.
- Grietas uniformes tipo panal o textura de camuflaje.
- Cola que tapa la espalda o se lee como tubo.
- Cualquier rasgo copiado de mascotas comerciales (dragón con alas, cuernos, etc.).

## 12. Criterios de aceptación (compuerta humana ≥ 7/10)

Identidad de protagonista, rostro/expresividad, ojos, silueta, cresta, material volcánico, vista posterior, proporciones anatómicas y calidad global: **≥ 7/10 en cada criterio**, con media ≥ 7,5. La calificación la emite el usuario; ninguna herramienta ni este documento la sustituye.
