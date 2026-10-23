# H2 — Informe de cierre del experimento Meshy 6 Lite

**Veredicto:** `REFERENCE ONLY — NOT APPROVED FOR V3`
**Estado:** H2 CLOSED — READY FOR H3 PLANNING
**Fecha:** 2026-10-22

## 1. Alcance y resultado

Se auditó el primer GLB generado con Meshy 6 Lite (plan Free) como **experimento genérico**, sin relación nominal ni visual con Salamander. El pipeline funciona de extremo a extremo (descarga → GLB válido → importación en Blender → análisis → normalización → renders), pero el resultado **no es una base válida para Salamander V3**. Se archiva como referencia técnica, fuera del repositorio y fuera del juego.

## 2. Evidencia y trazabilidad

| Dato | Valor |
|---|---|
| GLB | `Meshy_AI_A_stylized_original_q_1023003029_generate.glb` |
| Tamaño | 1.076.380 B |
| SHA-256 | `dfebbad3a3e3533956ed5779d9364f65cf5efab7e30e345a5ead9b2dace18f12` (verificado antes y después; **sin modificar**) |
| Formato | glTF 2.0, JSON 756 B + BIN 1.075.596 B, generator `meshy-scene` |
| Proveedor / modelo / plan | Meshy / **Meshy 6 Lite** / **Free** |
| Licencia | **CC BY 4.0** con atribución; sin propiedad exclusiva del proyecto |
| Laboratorio | `AnimalCombat-Art-Lab/meshy-trial-01/` — **fuera de Git** |
| Archivos de auditoría | 29 archivos: informe, inventario, métricas, `.blend`, 16 renders, comparativas, procedencia y herramientas |

Informe completo: `AnimalCombat-Art-Lab/meshy-trial-01/AUDIT_REPORT.md`. Procedencia: `provenance-license.md`.

## 3. Problemas registrados

### Anatomía
- Cabeza ancha con **ojos esféricos saltones** y boca amplia: el anti-objetivo «ojos de rana» de la dirección V3.
- Cuatro **aletas dorsales membranosas** (no cresta de fuego) y **cola con punta de paleta** (no S con llama).
- Patas largas y abiertas, dedos finos; postura no neutra ni compacta.

### Geometría
- 1 malla, 29.879 vértices, **59.754 triángulos**, sin materiales ni UV.
- Watertight, 1 isla, 0 no-manifold, 0 bordes, 0 degeneradas, 0 slivers, 0 autointersecciones detectadas (acotado).
- **Triangulación isótropa** tipo marching cubes, sin bucles de deformación; ojos, párpados, aletas y dedos **fusionados**.

### Escala
- Original: 0,858 × 1,898 × 0,814 m, origen centrado y pies en −0,410.
- Normalizado a 1,00 m: **1,054 × 2,330 × 1,000 m** → **23 % más largo** que el contrato (1,82–1,92) y más ancho que el cuerpo canónico (1,05 total con patas abiertas frente a 0,62–0,66).

### Silueta
- A **6,4 m** (55° vertical, 22° picado) ocupa ~15 % del encuadre y se lee como una mancha: las aletas desaparecen de canto y la cola apunta al suelo.
- Vista posterior dominada por una aleta de canto; sin cresta ni llama legibles.

### Preparación para rigging
- **No listo.** Sin bucles en hombros, caderas, cuello ni cola; piezas fusionadas; sin UV; sin prueba de deformación. Requeriría retopología completa y separación de piezas — fuera de alcance y posterior a la aprobación artística.

### Licencia
- Free = CC BY 4.0 con atribución; **no** otorga propiedad exclusiva ni privacidad. No se distribuye ni publica; permanece fuera de Git.

## 4. Decisión

**`REFERENCE ONLY — NOT APPROVED FOR V3`.**

Se conserva como evidencia del flujo y de las capacidades de Meshy 6 Lite; **no** se usa como malla base, no se integra en el juego y no se presenta como candidato artístico. La calidad de 6 Lite no representa la de Meshy 7.1 con multi-view.

## 5. Inventario documental H1 (pendiente de commit)

Seis documentos, ya preservados en `docs/r1b/h1/`, con manifiesto `MANIFEST.sha256`:

| Documento | Bytes | SHA-256 (12) |
|---|---:|---|
| `SALAMANDER_V3_ART_DIRECTION.md` | 11.411 | `b34d07deda36` |
| `V3_GENERATION_PROMPTS.md` | 7.750 | `e10c18bfd40d` |
| `MESHY_TOOL_REVIEW.md` | 8.125 | `a0c2fa7053a7` |
| `H2_VALIDATION_PROTOCOL.md` | 4.674 | `c92dbc75d3aa` |
| `LFS_RECOVERY_REPORT.md` | 3.094 | `b756806537fb` |
| `FREE_TRIAL_PROTOCOL.md` | 7.658 | `c9816f90bbe5` |

Manifiesto completo: `docs/r1b/h1/MANIFEST.sha256` (SHA-256 por archivo).

## 6. Checkpoint documental

Incluye **solo documentación**: los 6 documentos H1 + su manifiesto, este informe de cierre y el plan H3. **Excluye** el GLB, los renders de Meshy, las comparativas y cualquier imagen experimental, que permanecen en el laboratorio externo.

```bash
git add -- docs/r1b/h1/SALAMANDER_V3_ART_DIRECTION.md \
             docs/r1b/h1/V3_GENERATION_PROMPTS.md \
             docs/r1b/h1/MESHY_TOOL_REVIEW.md \
             docs/r1b/h1/H2_VALIDATION_PROTOCOL.md \
             docs/r1b/h1/LFS_RECOVERY_REPORT.md \
             docs/r1b/h1/FREE_TRIAL_PROTOCOL.md \
             docs/r1b/h1/MANIFEST.sha256 \
             docs/r1b/h2/H2_CLOSURE_REPORT.md \
             docs/r1b/h3/H3_PLAN.md
git commit -m "docs(r1-b): close H2 trial as reference-only and add H3 plan"
```

Antes de commitear: `git status --short` debe mostrar solo esas rutas; `git diff --cached --check` limpio; ningún `.glb`, `renders/`, `comparison-*.png` ni `inspection.blend` en el índice.

## 7. Estado del repositorio

- Rama `feat/r1-b2-salamander-modeling`, HEAD previo `6e078e1`; este informe se publica en el checkpoint documental de la rama.
- Sin cambios en V1/V2, simulación, cámara, colisiones, runtime ni otros worktrees.
- Los cuatro `docs/r1b/v2/clay-*.png` siguen intactos y sin rastrear.
- Documentos H1, cierre H2 y plan H3 se incluyen en el checkpoint documental de la rama.

## 8. Conclusión

H2 queda **cerrado** con veredicto **REFERENCE ONLY — NOT APPROVED FOR V3**. No se generaron nuevos modelos, no se gastaron créditos y no se modificó el juego. La siguiente fase es **H3 — Art Direction & Reference Lock**, sin generación 3D, según `docs/r1b/h3/H3_PLAN.md`.
