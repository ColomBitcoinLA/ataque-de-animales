# 🐾 Animal Combat — Fase 0

## Estado

| Bloque | Estado |
|---|---|
| F0.1 — Product Vision | 🟢 DEFINIDA |
| F0.2 — Repository Audit | 🟢 COMPLETADA |
| F0.3 — Game Design Debate | 🟢 VISIÓN BASE DEFINIDA |
| F0.4 — MVP World | 🟡 SIGUIENTE |
| F0.5 — Technical Architecture | ⚪ PENDIENTE DE F0.4 |

## Documentos

- [Product Vision](./PRODUCT_VISION.md)
- [Repository Audit F0](./REPOSITORY_AUDIT_F0.md)
- [Architecture](./ARCHITECTURE.md)
- [Roadmap](./ROADMAP.md)
- [Audit Log](./AUDIT_LOG.md)

## Regla de trabajo

**No implementar cambios estructurales durante la auditoría.**

El ciclo oficial será:

Proposal → implementation → tests → review → security → performance → integration.

## Principios congelados

1. El animal/pet es el protagonista.
2. El humano acompaña; no combate.
3. Especie e individuo son conceptos diferentes.
4. Jugadores, NPC y fauna forman parte del mismo sistema de entidades.
5. El servidor es la autoridad de la simulación.
6. El cliente presenta, interpola y captura intención.
7. El mundo será data-driven.
8. El combate existente se conserva y se desacopla.
9. Los modos actuales se integrarán como sistemas del mundo.
10. El MVP será pequeño en contenido y grande en sistema.
11. No pay-to-win.
12. No reescritura total sin evidencia técnica.

## Siguiente objetivo

**F0.4 — Congelar el MVP World.**

Antes de escribir el nuevo motor de mundo debemos definir con precisión:
- tamaño inicial;
- zonas;
- población concurrente objetivo inicial;
- criaturas;
- NPC;
- fauna;
- actividades;
- encuentros;
- reglas de combate;
- progresión;
- economía;
- límites de simulación;
- métricas de escalabilidad.

Después de F0.4 se construirá F0.5: arquitectura técnica del nuevo sistema.
