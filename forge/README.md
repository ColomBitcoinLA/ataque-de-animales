# Animal Forge — AF-0

Framework de producción y validación de contenido para **Animal Combat World**. AF-0 implementa el núcleo ejecutable: contratos versionados, registros, validadores, adaptador de Salamander, CLI, blockout reproducible y pruebas.

> **Grande en sistema, pequeño en contenido.**
> Animal Forge no reemplaza la dirección artística ni la simulación: controla identidad, medidas, referencias y aprobación.

## Comandos

```bash
pnpm forge:validate                 # valida todos los registros (exit 0/1)
pnpm forge:inspect                  # ficha de salamander.v3 + discrepancias
pnpm forge:build                    # blockout JSON + OBJ + informe en forge/out/
pnpm forge:preview                  # render técnico con Blender (si está instalado)
pnpm forge:verify                   # referencias, archivos y hashes
```

También: `node forge/cli.mjs <comando> [--json] [--out <dir>]`.

Códigos de salida: `0` OK · `1` errores de validación · `2` uso/argumentos · `3` dependencia ausente (Blender).

## Estructura

```
forge/
  core/            esquemas, ids, hashes, utilidades
  adapters/        importadores (H3-C Salamander)
  data/            art bible, arquetipos, especies, variantes, evoluciones, mundo
  schemas/         JSON Schemas versionados
  fixtures/h3c/    datos H3-C experimentales (solo medidas, no arte aprobado)
  blender/         script de blockout técnico
  examples/        salida de ejemplo reproducible
  cli.mjs          CLI de producción
  pipeline.mjs     validación integral
```

## Principios

1. **Una fuente de verdad.** Las medidas de una especie se derivan de un adaptador y se guardan con `sourceHash`; si el snapshot no coincide, la validación falla (`SNAPSHOT_STALE`, `SNAPSHOT_HASH`).
2. **Separación estricta.** `forge/` no importa Three.js ni toca runtime, simulación o combate. El enlace con el dominio es solo por `speciesId`.
3. **Aprobación humana explícita.** Un PASS geométrico no aprueba arte. `status: APPROVED` exige aprobador, fecha, evidencia y puntuación; `canPublish` lo verifica.
4. **Determinismo.** Blockout JSON/OBJ y hashes son reproducibles; las pruebas comparan dos builds.
5. **Trazabilidad.** Procedencia, licencia, archivos fuente y hashes se validan.

## Estado actual

- `salamander.v3` es **DRAFT experimental** (H3-C v0.2), no aprobado y no publicable.
- El blockout es una **verificación técnica**, no un personaje final.
- No hay modelo 3D final, rig, animación ni integración en el runtime.

## Añadir una especie

1. Crea su `speciesId` en el dominio (sin modificar contratos existentes).
2. Añade `forge/data/species/<visual>.json` con `archetypeId`, medidas y procedencia.
3. Si las medidas vienen de un adaptador, registra su `sourceHash`.
4. Añade variantes en `forge/data/variants/` y evolución en `forge/data/evolutions/`.
5. Ejecuta `pnpm forge:validate`; corrige hasta que quede verde.
6. La aprobación artística se registra a mano; el framework no la inventa.

## Seguridad

- La CLI sólo escribe bajo `forge/out/`; rechaza rutas absolutas, `..` y symlinks que salgan del directorio autorizado (exit 2).
- Los manifiestos `APPROVED` se anclan por hash en `forge/data/approval-lock.json`; cualquier cambio exige actualizar el lock de forma explícita.
- `body-parser` está fijado a `>=2.4.0` (vía `express@5.3.0`); el gate M0 lo verifica.
- No se guardan secretos ni credenciales en los datos ni en los ejemplos.

## Limitaciones AF-0

- Solo el arquetipo cuadrúpedo está implementado; aves y reptiles tienen contrato pero no datos.
- El blockout usa primitivas; no sustituye escultura/retopología.
- La apariencia material no se evalúa con PBR; el render es Workbench técnico.
- El approval lock no es una firma criptográfica: un cambio coordinado de manifiesto y lock requiere revisión humana.
