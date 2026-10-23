# Salamander V3 — Prompts de generación y requisitos de imagen de entrada

**Estado:** preparado, **no ejecutado**. No se ha enviado ninguna imagen a un proveedor ni se han consumido créditos. No se usan como insumo imágenes de procedencia incierta.

## 0. Cómo se usan estos prompts

Meshy trabaja **imagen → 3D**: la imagen de entrada manda. Por eso cada variante define (a) el **prompt de hoja de concepto** que debe generar la imagen de referencia y (b) los **ajustes de generación 3D** que se aplicarán después. Si el proveedor acepta un campo de texto junto a la imagen, la sección «Directiva» se pega tal cual; si no, gobierna la preparación de la imagen y los ajustes.

Requisitos comunes de la imagen de entrada:

- **4 vistas** en la misma hoja: frontal, lateral derecha, posterior y tres cuartos; misma escala (personaje de 1.000 px de alto), mismo encuadre y misma luz neutra.
- Fondo **gris medio uniforme**, sin sombras duras, sin texto, sin logotipos, sin marcas de agua.
- **Un solo sujeto**, centrado, sin objetos de escena.
- Iluminación plana y pareja; sin *rim light* de cine que oculte la anatomía.
- Resolución **1024–2048 px** por vista; PNG/JPG/WEBP ≤ 20 MB (límite documentado por Meshy).
- Postura **neutra de apoyo** (no salto, no acción), cola visible y separada del cuerpo, patas separadas para leer los huecos.
- Sin ojos saltones, sin cristales, sin rasgos de IP existente.

Para imagen-a-3D en Meshy: modelo **Meshy 7.1**, modo **High Detail**, **Multi-view** con las 4 vistas si el plan lo permite, resolución **Standard (20 créditos)** o **Ultra 2K (25)**; **Image Enhancement off** si la hoja ya es limpia y consistente. Textura y Split desactivados en H2 para comparar geometría pura; se aplicarán en H3.

---

## Variante A — «Hero mascot»

**Intención:** máximo carisma facial y expresividad; la versión más “protagonista de portada”.

**Diferencias respecto al canon:** cabeza 5–8 % más grande, ojos 5 % mayores con párpado superior más marcado, boca con sonrisa algo más visible, cresta equilibrada (3 lenguas principales), patas algo más cortas y firmes.

**Prompt (hoja de concepto):**

> Stylized quadruped fire salamander mascot, hero character sheet, four orthographic views (front, right side, back, three-quarter), neutral standing pose on flat ground. Compact athletic body, broad rounded wedge-shaped skull with a strong brow shelf, large expressive amber eyes set deep in real sockets with thick upper eyelids, short blunt muzzle, gentle closed-mouth smile with lifted corners, small nostrils. Dark volcanic basalt skin (#15171a–#2b2723) with irregular glowing orange magma fissures of varying width, warm plated belly, mineral claws. Organic fire crest of four solid opaque flame tongues with S-curves and split tips, deep red at the root fading to orange and amber; a smaller flame at the tail tip; flexible tail raised in an S curve. Brave, friendly, curious expression. Clean neutral grey background, even studio lighting, no text, no props, consistent scale. Stylized high-quality game character, not a frog, not a toad, not a dragon.

**Negativo específico:** aspecto de rana, ojos saltones, cabeza plana, boca ancha sin mandíbula, cristales, púas, cuernos, alas, dientes humanos, chibi deforme.

**Ajustes 3D:** High Detail · Multi-view (4) · Standard · Texture off · Split off · Pose no aplicable (no humanoide).

---

## Variante B — «Agile explorer»

**Intención:** mejor anatomía y sensación de agilidad; la versión más “compañero de aventura”.

**Diferencias:** torso 6–10 % más largo y cintura más marcada, patas 8–12 % más largas con articulaciones visibles, cola más larga y activa, cresta más barrida hacia atrás y baja, cabeza ligeramente más estrecha.

**Prompt (hoja de concepto):**

> Stylized quadruped fire salamander adventurer, four-view orthographic character sheet, neutral alert standing pose. Lean athletic anatomy: deep chest, defined waist, powerful haunches, clearly articulated shoulders, elbows, wrists, hocks and ankles, four-toed feet with mineral claws, feet planted flat. Wedge-shaped skull with brow shelf, deep-set expressive amber eyes with heavy upper lids, short blunt muzzle and subtle confident smile. Dark basalt skin with branching magma cracks that are denser at joints and cooler on the belly; warm plated underside. Organic flame crest swept backwards in four solid opaque tongues, deep red roots to amber tips, plus a compact tail flame on a long flexible S-curved tail raised above the hips. Brave, curious, quick expression. Plain grey background, even lighting, no text, consistent scale. High-quality stylized game character, original design.

**Negativo específico:** anatomía de juguete, patas de tubo, pies diminutos, cuerpo globo, rana, cristales, cuernos, alas.

**Ajustes 3D:** High Detail · Multi-view (4) · Standard · Texture off · Split off.

---

## Variante C — «Volcanic guardian»

**Intención:** identidad ígnea más poderosa y silueta imponente, sin volverse monstruo.

**Diferencias:** pecho y hombros 10–15 % más anchos, cuello más grueso, cresta más alta y ancha (5 lenguas), cola más gruesa en la base, placas dorsales de basalto más marcadas; ojos algo más pequeños pero intensos.

**Prompt (hoja de concepto):**

> Stylized quadruped volcanic salamander guardian, four-view orthographic character sheet, grounded powerful stance. Broad deep chest and heavy shoulders, thick neck, powerful haunches, four sturdy articulated legs with wide clawed feet flat on the ground. Wide rounded wedge skull with heavy brow shelf and deep sockets, intense amber eyes under thick lids, short blunt muzzle, calm confident closed-mouth expression. Dark basalt skin with deep irregular magma fissures, glowing seams concentrated along the spine and shoulders, warm armored belly plates, mineral claws. Tall organic fire crest of five solid opaque flame tongues, layered and overlapping with S-curves, deep red at the roots to amber-yellow tips, small dorsal ember ridges and a strong tail flame at the tip of a thick tapered tail. Guardian presence: strong but not monstrous, friendly and loyal. Plain grey background, even lighting, no text, no props. High-quality stylized game character, original design.

**Negativo específico:** monstruo, dinosaurio, dragón, alas, cuernos, armadura metálica, cristales, ojos saltones, rana.

**Ajustes 3D:** High Detail · Multi-view (4) · Standard · Texture off · Split off.

---

## Prompt negativo global (para la generación de hojas)

> frog, toad, axolotl, gecko, lizard head with flat skull, googly bulging eyes, white sclera, surprised expression, human teeth, tongue out, dragon wings, horns, spikes, crystal shards, glass shards, pink flames, cartoon droplets, fur, feathers, metal armor, clothing, text, watermark, signature, logo, multiple characters, cluttered background, motion blur, low resolution, low-poly faceting, chibi proportions, tiny legs, floating limbs, extra legs, missing toes, asymmetrical eyes, distorted muzzle, melted geometry.

---

## Comparación rápida de variantes

| | A · Hero mascot | B · Agile explorer | C · Volcanic guardian |
|---|---|---|---|
| Prioridad | Carisma facial | Anatomía/agilidad | Presencia ígnea |
| Cabeza | +5–8 % | −3 % | base |
| Ojos | +5 % | base | −5 % |
| Patas | cortas y firmes | +8–12 % | gruesas |
| Cresta | 3 lenguas, equilibrada | barrida, baja | 5 lenguas, alta |
| Cola | media | larga y activa | gruesa |
| Riesgo | volver a “rana” | perder masa de protagonista | parecer monstruo |

Las tres comparten identidad, paleta, contrato dimensional y lectura a 6,4 m; ninguna introduce rasgos de IP ajena.
