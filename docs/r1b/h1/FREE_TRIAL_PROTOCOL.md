# Prueba genérica gratuita en Meshy — protocolo H1.1

**Estado:** protocolo preparado y **ejecutado una vez** en H2 (Meshy 6 Lite, plan Free, 10 créditos, una descarga). La auditoría del resultado está en `docs/r1b/h2/H2_CLOSURE_REPORT.md`; el GLB y sus renders permanecen fuera de Git, en el laboratorio externo.

**Propósito:** evaluar de forma barata las capacidades reales del proveedor (geometría cuadrúpeda, cabeza, malla, silueta, exportación y trazabilidad) con una criatura **genérica e inventada**, sin relación nominal ni visual con Salamander ni con Animal Combat World. **No produce un asset del juego** y no sustituye ninguna compuerta artística.

## 1. Reglas de la prueba

- Sin nombres «Salamander» ni «Animal Combat World» en el prompt, archivos o metadatos.
- Sin imágenes del concepto, sin logos, sin archivos del repositorio, sin V1/V2, sin personajes de terceros.
- Sólo funciones del **plan Free**; sin tarjeta ni suscripción.
- Una sola generación inicial y, como máximo, **tres intentos** si el primero falla técnicamente.
- La criatura es **descartable**: se archiva como evidencia, no se integra en el juego.
- Si el proveedor exige pago para descargar o para el modo elegido, **detenerse** y reportarlo, sin pagar.

## 2. Prompt genérico (criatura original sin nombre)

**Prompt corto (text-to-3D, Meshy 6 Lite):**

> A small fantasy quadruped creature with a charcoal-gray rocky hide and glowing orange seams, short blunt muzzle, large friendly amber eyes under heavy brows, a crest of soft flame-shaped plates along the neck and back, and a curled tail ending in a tiny flame. Compact athletic body, four sturdy legs with clawed feet, standing on flat ground. Stylized game asset, clean silhouette, no text, no background.

**Dirección ampliada (si el proveedor acepta más texto o para preparar una imagen de entrada propia):**

> Original stylized quadrupedal ember creature for a fantasy game, neutral standing pose, four orthographic views. Dark basalt skin with irregular molten cracks, warm plated belly, short muzzle with a subtle friendly expression, deep-set amber eyes with thick upper eyelids, organic flame crest in four soft tongues (not crystals, not spikes), flexible tail with a small flame tip. Compact and agile anatomy, clearly articulated legs, three clawed toes per foot. Plain mid-gray background, even lighting, consistent scale. High-quality stylized character, original design.

**Prompt negativo (sólo si se genera una imagen de entrada):**

> frog, toad, dragon wings, horns, spikes, crystals, glass shards, googly eyes, white sclera, human teeth, fur, feathers, metal armor, clothing, text, watermark, logo, multiple characters, cluttered background, chibi proportions, tiny legs, extra limbs, low-poly faceting.

## 3. Requisitos de imagen de entrada (sólo ruta image-to-3D)

- Imagen **propia** y original, generada localmente o con el generador del propio proveedor; nunca una referencia de autoría incierta.
- Un solo sujeto, fondo gris uniforme, 1024–2048 px, PNG/JPG/WEBP ≤ 20 MB.
- Postura neutra de apoyo, cuatro patas visibles, cola separada del cuerpo.
- Cuatro vistas coherentes (frontal, lateral, posterior, tres cuartos) si se usa multi-view; en Free no hay multi-view, así que basta una vista tres cuartos limpia.
- Sin texto, logos ni marcas de agua.

## 4. Procedimiento paso a paso (plan Free)

1. Abrir <https://www.meshy.ai> y crear cuenta **gratuita** con correo o proveedor de identidad. **No** añadir método de pago ni activar suscripción.
2. Verificar en la cuenta: plan **Free**, **100 créditos**, sin facturación asociada.
3. Ir a **Model** y elegir la pestaña **Text to 3D** (o **Image to 3D** si se preparó una imagen propia).
4. Seleccionar el modelo **Meshy 6 Lite** (10 créditos). Es obligatorio para poder descargar en Free; Meshy 6/7 requieren plan de pago.
5. Pegar el prompt genérico. Mantener **Texture off** y **Split off** (cada uno suma 10 créditos). No hay Multi-view ni Pose en Free.
6. Pulsar **Generate**; la UI muestra coste y tiempo antes de ejecutar. Anotar créditos consumidos.
7. Revisar el resultado en el visor (órbita completa). Si la malla está rota, se permite **un** reintento (máximo 3 en total).
8. **Download → GLB**. Confirmar que no aparece muro de pago (sólo 6 Lite es descargable en Free). Guardar el archivo con nombre `generic-trial-01.glb`.
9. Calcular SHA-256 y registrar: proveedor, modelo usado, créditos, fecha, licencia aplicada (CC BY 4.0) y texto de atribución.
10. Importar en **Blender 5.2.2 LTS**: comprobar escala, orientación, triángulos, materiales, manifold, autointersecciones y piezas sueltas. No rigging, no retopología, no animación.
11. Puntuar con la rúbrica (sección 6) y archivar el GLB + capturas fuera del repositorio, con manifiesto.
12. **No** publicar el modelo en la comunidad de Meshy (allí pasaría a CC0/CC BY-NC).

## 5. Estimación de créditos (mínimo coste)

| Concepto | Créditos |
|---|---:|
| Text-to-3D Meshy 6 Lite (1 intento) | 10 |
| Reintentos permitidos (hasta 2) | 10 c/u |
| Texture / Split | **no usar** (10 c/u) |
| **Prueba mínima** | **10** |
| **Prueba con 2 reintentos** | **30** |
| Descargas Free | hasta 10/mes, sólo 6 Lite |

Con 100 créditos/mes del plan Free se podrían hacer hasta 10 generaciones 6 Lite, pero la prueba se limita deliberadamente a **1–3** para no agotar la cuota de descargas ni gastar crédito sin autorización.

## 6. Rúbrica de la prueba (1–5 por criterio, exploratoria)

| Criterio | Qué se observa |
|---|---|
| Anatomía cuadrúpeda | Cuatro patas coherentes, proporciones, apoyos |
| Cabeza expresiva | Hocico, ojos, mandíbula; no rana |
| Calidad de malla | Manifold, sin agujeros, densidad razonable, sin autointersecciones graves |
| Silueta | Legible en negro a tamaño de juego |
| Simetría | Eje sagital coherente; asimetrías no intencionadas |
| Editabilidad en Blender | Importa sin errores, escala/orientación corregibles, UV y materiales |
| Descarga/exportación | GLB realmente descargado sin pago y reabierto |
| Licencia y trazabilidad | Términos aceptados, atribución, hash, fecha |

**Resultado de la prueba:** `APTA` si descarga + importación + malla editable funcionan; `PARCIAL` si hay defectos corregibles; `NO APTA` si no hay descarga sin pago o la malla es inservible. **La calidad observada no es aprobación de Salamander V3**; sólo informa la decisión de plan y de proveedor.

## 7. Requisitos para elegir un plan comercial después

1. **Titularidad y privacidad**: contrato que garantice output privado y propiedad del cliente.
2. **Exclusión de entrenamiento**: confirmación por escrito (o Enterprise/DPA); los Terms actuales no la garantizan para Pro/Premium/Ultra.
3. **Descargas y formatos**: ilimitadas, GLB/BLEND confirmados.
4. **Multi-view** y control de pose (si se necesita consistencia de cuatro vistas).
5. **Créditos suficientes**: H2 estima 3 candidatos × 25 créditos × 2 intentos ≈ 150–300 créditos, más texturas; **Pro (1.000)** cubre la fase.
6. **Atribución**: sin obligación para output propio.
7. **Retención**: descarga inmediata; no depender del almacenamiento.
8. **Coste total**: precio + impuestos + créditos extra; sin renovación automática no deseada.

## 8. Evidencia a conservar

- `generic-trial-01.glb` + SHA-256.
- Captura de la configuración de generación (modelo, créditos, fecha).
- Captura de la licencia/atribución mostrada por la cuenta Free.
- Renders de evaluación en Blender (frontal, lateral, posterior, tres cuartos, clay).
- Ficha de puntuación firmada por el revisor humano.

Todo ello **fuera del repositorio** hasta que exista una decisión de proveedor y una autorización de commit.
