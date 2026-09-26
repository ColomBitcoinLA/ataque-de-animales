# 🐾 Fase 0 — Estado actualizado

| Bloque | Estado |
|---|---|
| F0.1 — Product Vision | 🟢 DEFINIDA |
| F0.2 — Repository Audit | 🟢 COMPLETADA |
| F0.3 — Game Design Debate | 🟢 VISIÓN BASE DEFINIDA |
| F0.4 — MVP World | 🟢 ESPECIFICADA |
| **F0.5 — Technical Architecture** | 🟢 **ARQUITECTURA OBJETIVO DEFINIDA** |

## F0.5

Documento principal: [TECHNICAL_ARCHITECTURE_F0_5.md](./TECHNICAL_ARCHITECTURE_F0_5.md)

La arquitectura objetivo separa:
- Domain
- Simulation
- Application
- Network
- Persistence
- Presentation

### Contratos principales

Entity, SpeciesDefinition, CreatureIndividual, Player, NPC, Wildlife, World, WorldShard, Zone, Behavior, Encounter, CombatInstance, Progression, Repository, Command, Snapshot y Renderer.

### Regla fundamental

**El dominio no sabe cómo se ve. El renderizador no decide qué es verdad.**

### Migración

No se hará un rewrite total.

Orden previsto:

**Tests + seguridad → contratos de dominio → Creature/Individual → World Simulation → Network → 3D Presentation → integración World/Encounter/Combat/Progression.**

### Siguiente paso

Fase de implementación controlada: **M0 — Safety Net**, comenzando por tests base, contratos iniciales y hardening de seguridad prioritario.
