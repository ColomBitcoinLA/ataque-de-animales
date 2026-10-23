# Revisión de herramienta — Meshy (H1.1, actualizada)

**Consultado:** 2026-10-20. **Fuentes:** documentación y páginas oficiales de Meshy (enlaces abajo). No se creó cuenta, no se enviaron imágenes, no se gastaron créditos y no se modificó facturación.

> **Regla de interpretación:** los **Terms of Use** prevalecen sobre cualquier afirmación comercial o de ayuda que los contradiga. Cuando no hay garantía contractual explícita, se marca **PENDIENTE** y no se presenta como derecho adquirido.

Fuentes: [Terms of Use](https://www.meshy.ai/terms-of-use) · [Pricing docs](https://docs.meshy.ai/en/webapp/pricing) · [Image to 3D](https://docs.meshy.ai/en/webapp/image-to-3d) · [Export formats](https://docs.meshy.ai/en/webapp/guides/platform/export-formats) · [Blender plugin](https://www.meshy.ai/integrations/blender) · [Planes](https://help.meshy.ai/en/articles/12062933-which-meshy-plan-is-right-for-you-free-vs-pro-vs-premium-vs-ultra) · [Free plan](https://help.meshy.ai/en/articles/15696428-what-is-included-on-the-free-plan) · [Titularidad](https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models) · [Checklist de copyright](https://help.meshy.ai/en/articles/16103168-copyright-checklist-for-meshy-reference-images-and-assets).

## 1. Precios y créditos

| Plan | Precio/mes (USD) | Créditos/mes | Descargas | Multi-view |
|---|---:|---:|---|---|
| Free | $0 | 100 | Sólo 10/mes de modelos **Meshy 6 Lite** | No |
| Pro | $20 | 1.000 | Ilimitadas | Sí |
| Premium | $40 | 3.000 | Ilimitadas | Sí |
| Ultra | $100 | 8.000 | Ilimitadas | Sí |
| Studio | $70/asiento | 5.500–28.000 | Ilimitadas | Sí |
| Enterprise | A medida | A medida | Ilimitadas | Sí |

- Coste por generación imagen-a-3D: **20 créditos** (Meshy 6 o 7.1 Standard), **25** (Ultra 2K/4K), **10** (Meshy 6 Lite).
- Opciones que pueden sumar: Texture **+10**, Split **+10**; Smart Topology aparte (5 T2 / 20 T1).
- Oferta vigente para nuevos suscriptores: **50 % el primer mes** en Pro/Premium/Ultra.
- **Precios verificados en USD**; impuestos y promociones regionales pueden alterar el total. **PENDIENTE:** tarifa exacta para Colombia/COP y vigencia de la oferta.

## 2. Propiedad de los resultados: Free vs Pro

- **Free (Terms §3.2):** Meshy conserva la titularidad del *Customer Output* y la cede bajo **CC BY 4.0** con atribución. La página de ayuda dice «you own the output» para Free, lo que **contradice** los Terms; **prevalece el Terms**.
- **Pago (Terms §3.2):** el cliente es dueño del *Customer Output* «to the extent possible under applicable law» y puede mantenerlo privado.
- **Conclusión operativa:** para el asset comercial de Salamander se requiere **plan de pago**; el plan Free no da titularidad privada y añade obligación de atribución.

## 3. Atribución

- **Free:** obligatoria, p. ej. «Model created with [Meshy](https://www.meshy.ai) – [CC BY 4.0 License](https://creativecommons.org/licenses/by/4.0/)».
- **Pago:** la ayuda indica que no se exige atribución para modelos propios; si la imagen de referencia tenía licencia con crédito, esa obligación persiste.
- **PENDIENTE:** si la atribución CC BY debe figurar también en la ficha del personaje o sólo en la documentación del proyecto.

## 4. Visibilidad pública o privada

- **Pago:** los modelos pueden permanecer **privados** (Terms §3.2 y ayuda).
- **Free:** licencia **CC BY 4.0**; **no** hay confirmación explícita de si los modelos se publican automáticamente en la galería/comunidad. **PENDIENTE.**
- **Comunidad (Terms §3.3):** publicar en la *Meshy Community* cede los modelos 3D bajo **CC0** y el resto de contenido bajo **CC BY-NC 4.0** — incompatibles con un asset original del juego. **No publicar en la comunidad.**

## 5. Descarga y exportación en Free

- **Verificado:** el plan Free sólo permite **10 descargas/mes** y **únicamente de modelos generados con Meshy 6 Lite**; los modelos de Meshy 6/7 requieren plan de pago para descargar.
- **Implicación para la prueba gratuita:** para poder evaluar la exportación real hay que generar con **Meshy 6 Lite** (10 créditos) y descargar dentro de esas 10.
- **Formatos (todos los planes, salvo limitaciones de descarga):** GLB, FBX, OBJ, USDZ, STL, BLEND, 3MF, DXF. GLB incrusta texturas. **Resize** (altura/origen) requiere pago.
- **PENDIENTE:** si BLEND y USDZ están incluidos también en Free o dependen del plan.

## 6. Uso de contenido para entrenamiento

- **Terms §2.9:** Meshy **puede usar Customer Input/Output de clientes no Enterprise** para entrenar, validar o mejorar el servicio, salvo pacto en contrario.
- **Terms §3.2:** para clientes de pago, el contenido «will not be used for any purpose other than as outlined here», y se concede a Meshy una licencia para operar el servicio.
- **Lectura:** hay **tensión interna** entre §2.9 (entrenamiento por defecto) y §3.2 (uso limitado). **No existe garantía contractual explícita de exclusión del entrenamiento para Pro/Premium/Ultra.** Por tanto:
  - **No afirmar que Pro ofrece privacidad total.**
  - Para referencias confidenciales, exigir **Enterprise/DPA u opt-out por escrito** antes de subirlas.
  - La prueba genérica H1.1 **no sube arte propio sensible**: usa una criatura genérica inventada.

## 7. Condiciones de imágenes de terceros

- **Terms §2.2:** el usuario garantiza poseer los derechos de todo *Customer Input*.
- **Checklist oficial:** no subir personajes, logos, marcas ni *fan art*; la responsabilidad por resultados que se parezcan a IP protegida es del usuario.
- **Para nuestro caso:** la ficha del usuario **no se subirá** en la prueba; si se usara en el futuro, hay que acreditar autoría/licencia y valorar el punto 6. Nunca usar imágenes de autoría incierta.

## 8. Retención y eliminación de datos

- **API, cuentas no Enterprise:** las salidas se **eliminan a los 3 días** (Terms §2.5).
- **Webapp:** Meshy puede fijar límites de almacenamiento y borrar contenido que los exceda o de cuentas inactivas.
- **Enterprise:** retención indefinida por defecto, configurable 1–30 días.
- **Metadatos/marcas de IA:** pueden incluirse y **no deben eliminarse** (Terms §2.4).
- **Acción:** descargar y archivar los GLB inmediatamente; no depender del almacenamiento del proveedor.

## 9. Condiciones de uso comercial

- **Pago:** uso comercial completo, con titularidad del cliente y opción de privacidad.
- **Free:** uso comercial permitido **con atribución** CC BY 4.0; la titularidad permanece en Meshy según §3.2.
- **Prohibiciones (Terms §2.6):** usar el servicio para infringir derechos, revender el servicio, entrenar modelos competidores, eludir acceso, etc.
- **Restricción de salida:** los términos no impiden usar el modelo en un videojuego comercial si se cumplen las condiciones anteriores, pero **no sustituyen** una revisión legal del contrato con el proveedor.

## 10. Integración con Blender

- Plugin **oficial y gratuito**, requiere **Pro o superior**, Blender **4.2.6+**; bridge local con **GLB/ZIP**, conserva materiales y texturas; incluye limpieza y análisis de malla.
- Nuestro Blender es **5.2.2 LTS** (compatible por versión); la prueba real del plugin queda para H2/H3.

## 11. Resumen de condiciones verificables

| Condición | Free | Pago |
|---|---|---|
| Titularidad | Meshy + licencia CC BY 4.0 | Cliente (sujeto a ley) |
| Atribución | Obligatoria | No exigida para el output propio |
| Privacidad | No garantizada | Opción privada |
| Descarga | 10/mes, sólo 6 Lite | Ilimitada |
| Multi-view | No | Sí |
| Entrenamiento | Sí (no Enterprise) | **No garantizado como excluido** |
| Uso comercial | Sí, con crédito | Sí |
| Retención API | 3 días | 3 días (no Enterprise) |

## 12. Veredicto

**Apto para la prueba genérica gratuita** (Meshy 6 Lite, 10 créditos, 1 descarga) como evaluación de capacidades y de exportación. **No apto para el asset final en Free.** Para producción se requiere plan de pago **y** aclaración por escrito de la exclusión de entrenamiento/privacidad; hasta entonces no se afirma privacidad total.
