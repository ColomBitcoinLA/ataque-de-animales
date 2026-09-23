# 🏗️ Animal Combat — F0.5 Technical Architecture

> Estado: **F0.5 — arquitectura objetivo definida**
> Fecha: 2026-09-22
> Regla: **diseñar contratos antes de implementar**
>
> Esta arquitectura transforma progresivamente el juego actual en un mundo vivo sin hacer un rewrite total.

## 0. Objetivo arquitectónico

El sistema debe evolucionar de:

~~~text
cliente + mapa + combate + rooms
~~~

hacia:

~~~text
World Simulation + Creature Individuals + Encounters + Authoritative Combat + 3D Presentation
~~~

La arquitectura debe permitir que el contenido crezca sin cambiar los contratos fundamentales.

### Principio rector

> **El dominio no sabe cómo se ve. El renderizador no decide qué es verdad.**

---

# 1. Capas

~~~text
GAME
│
├── DOMAIN
│   ├── Entity
│   ├── Creature
│   ├── Individual
│   ├── Species
│   ├── Player
│   ├── NPC
│   ├── Wildlife
│   ├── World
│   ├── Zone
│   ├── Encounter
│   ├── Combat
│   └── Progression
│
├── SIMULATION
│   ├── WorldSimulation
│   ├── MovementSystem
│   ├── CollisionSystem
│   ├── BehaviorSystem
│   ├── EncounterSystem
│   ├── CombatSystem
│   └── ProgressionSystem
│
├── APPLICATION
│   ├── SessionCoordinator
│   ├── WorldCoordinator
│   ├── EncounterCoordinator
│   └── CombatCoordinator
│
├── NETWORK
│   ├── Protocol
│   ├── Server
│   ├── Client
│   ├── Snapshot
│   └── InterestManagement
│
├── PERSISTENCE
│   ├── Repository interfaces
│   ├── PlayerRepository
│   ├── CreatureRepository
│   └── WorldRepository
│
└── PRESENTATION
    ├── 3D Renderer
    ├── Camera
    ├── Animation
    ├── VFX
    ├── UI
    └── Audio
~~~

---

# 2. Regla de dependencias

Las dependencias deben apuntar hacia el dominio.

~~~text
Presentation ─────┐
Network ──────────┼──> Application ──> Simulation ──> Domain
Persistence ──────┘
~~~

El dominio no importa Three.js, Canvas, DOM, WebSocket, Express, localStorage, HTML, audio ni imágenes.

Esto permite cambiar la presentación, transporte o persistencia sin reescribir las reglas del juego.

---

# 3. Entity

Entity representa cualquier objeto identificable de la simulación.

~~~text
Entity
├── id: EntityId
├── kind: EntityKind
├── position
├── lifecycle
└── metadata mínima
~~~

Tipos iniciales:

~~~text
PLAYER
CREATURE
NPC
WILDLIFE
OBJECT
POI
~~~

No debe contener lógica específica de perro, NPC, combate o render.

---

# 4. Species

SpeciesDefinition es configuración compartida.

~~~text
SpeciesDefinition
├── speciesId
├── displayName
├── category
├── baseStats
├── movementProfile
├── sensesProfile
├── behaviorProfile
├── abilities
├── visualProfile
└── habitatProfile
~~~

Una especie no contiene XP, historial o personalidad de un individuo.

---

# 5. Individual / Creature

La entidad fundamental del nuevo juego será CreatureIndividual.

~~~text
CreatureIndividual
├── entityId
├── speciesId
├── ownerId?
├── identity
├── stats
├── traits
├── temperament
├── behaviorState
├── progression
├── historyRef
├── relationshipsRef
├── position
├── health
├── energy
└── lifecycle
~~~

### Regla

speciesId describe qué es.

individualId describe quién es.

Dos animales de la misma especie no deben compartir automáticamente identidad, experiencia o historia.

---

# 6. Player

Player representa la cuenta/persona que controla la sesión.

No es el animal.

~~~text
Player
├── playerId
├── accountId
├── sessionId
├── companionCreatureId
├── permissions
└── progression/profile
~~~

Relación:

~~~text
Player
   │ owns/controls
   ▼
CreatureIndividual
~~~

El humano visual puede existir como avatar/compañero, pero no se convierte en combatiente por defecto.

---

# 7. NPC

NPC es una entidad con comportamiento autónomo.

~~~text
NPC
├── entityId
├── identity
├── archetype
├── behaviorProfile
├── schedule?
├── relationships
└── memoryRef?
~~~

No todo NPC necesita memoria completa en el MVP. La arquitectura debe permitir añadirla sin romper el contrato.

---

# 8. Wildlife

Wildlife utiliza el mismo modelo de criatura individual.

La diferencia principal está en ownership, behavior, habitat, lifecycle y encounter rules.

Por eso evitamos tres sistemas incompatibles como PlayerAnimal, NpcAnimal y EnemyAnimal.

Preferimos:

~~~text
CreatureIndividual
      │
 ┌────┼───────────┐
Player-owned    NPC    Wildlife
~~~

---

# 9. World

World representa una instancia lógica del mundo.

~~~text
World
├── worldId
├── seed
├── version
├── zones
├── entities
├── rules
├── time
└── simulationState
~~~

El mundo no debe conocer detalles de HTML o Three.js.

---

# 10. WorldShard

WorldShard es una instancia operativa de un mundo.

~~~text
World
   │
   ├── Shard A
   ├── Shard B
   └── Shard C
~~~

No implementaremos sharding real en F0.5. Solo dejamos el contrato preparado para que un futuro crecimiento no obligue a cambiar el dominio.

---

# 11. Zone

Una zona divide el mundo en regiones de simulación e interés.

~~~text
Zone
├── zoneId
├── bounds
├── terrain
├── navigation
├── rules
├── spawnProfiles
└── entityIndex
~~~

Zonas iniciales:

- village
- wild
- roads
- arena

Las zonas serán data-driven.

---

# 12. Behavior

Behavior representa decisiones de una entidad.

Separaremos:

~~~text
Perception
    ↓
Context
    ↓
Decision
    ↓
Intent
    ↓
Simulation
~~~

Ejemplo:

~~~text
detect predator
      ↓
evaluate danger
      ↓
FLEE
      ↓
MovementSystem
      ↓
new position
~~~

La IA no debe modificar directamente coordenadas persistentes saltándose la simulación.

---

# 13. Encounter

Encounter representa una situación contextual del mundo.

~~~text
Encounter
├── encounterId
├── type
├── participants
├── location
├── state
├── consent
├── createdAt
└── resolution
~~~

Tipos iniciales:

- discovery
- neutral
- territorial
- PvE
- PvP
- NPC activity
- event

Flujo:

~~~text
World
 ↓
Encounter detection
 ↓
Encounter
 ↓
Interaction
 ├── continue
 ├── flee
 ├── cooperate
 └── Combat
~~~

---

# 14. Combat

El combate continúa como dominio especializado.

~~~text
CombatInstance
├── combatId
├── participants
├── turn/state
├── abilities
├── resources
├── statusEffects
├── rules
├── result
└── rewards
~~~

El futuro CombatSystem será responsable de las reglas.

El cliente solo presenta el estado autorizado mediante animación, VFX y UI.

---

# 15. Progression

Progression no debe vivir dentro de la UI.

~~~text
Progression
├── xp
├── level
├── unlocks
├── skills
├── evolution/variants
└── achievements
~~~

Las recompensas deben derivarse de eventos validados por el servidor.

---

# 16. Persistence

No acoplaremos el dominio directamente a database.json.

Usaremos contratos:

~~~text
PlayerRepository
CreatureRepository
WorldRepository
EncounterRepository
~~~

La implementación actual puede ser temporal.

---

# 17. Network

WebSocket continúa como transporte inicial.

Separaremos:

~~~text
Transport
   ↓
Protocol
   ↓
World Commands
   ↓
Simulation
   ↓
Snapshots
~~~

El cliente enviará intenciones/commands:

~~~text
MOVE_INTENT
INTERACT
ENCOUNTER_REQUEST
COMBAT_ACTION
LEAVE_ENCOUNTER
~~~

No enviará como autoridad:

~~~text
SET_POSITION
SET_HP
SET_XP
REPORT_WIN
~~~

---

# 18. Snapshot

Un snapshot representa una observación autorizada del servidor.

~~~text
WorldSnapshot
├── serverTick
├── timestamp
├── zone
├── entities[]
└── sequence
~~~

El cliente podrá interpolar entre snapshots.

---

# 19. Interest Management

No todos los jugadores necesitan recibir todo el mundo.

~~~text
Player A
  ↓
nearby entities
  ↓
relevant snapshot

far entities
  ↓
reduced update

irrelevant entities
  ↓
not transmitted
~~~

La primera implementación puede usar proximidad por zona y bandas de distancia.

---

# 20. Rendering

El renderer consume estado, pero no lo gobierna.

~~~text
Simulation State
      ↓
Presentation Adapter
      ↓
3D Renderer
      ├── camera
      ├── models
      ├── animation
      ├── VFX
      └── audio triggers
~~~

Esto permite conservar Arena3D mientras construimos posteriormente World3DRenderer.

---

# 21. Camera

La cámara será un sistema independiente.

Primera cámara objetivo:

**third-person follow camera centrada en la mascota.**

El humano puede permanecer visible como acompañante.

La cámara no debe alterar la simulación.

---

# 22. UI

UI solo expresa estado y captura intención.

~~~text
Domain State
    ↓
UI View Model
    ↓
DOM/UI
~~~

No debe calcular XP, daño, posiciones autoritativas ni resultados.

---

# 23. Audio / VFX

Audio y VFX son presentation systems.

Un evento de dominio puede producir:

~~~text
COMBAT_HIT
ENTITY_FLEE
LEVEL_UP
ENCOUNTER_STARTED
~~~

Presentation decide entonces:

~~~text
animation
particle
sound
camera effect
~~~

---

# 24. Server Authority

Regla fundamental:

> **Si afecta al mundo, progresión, combate o economía, el servidor debe ser la autoridad.**

Cliente:

~~~text
input → command
~~~

Servidor:

~~~text
command
 ↓
validate
 ↓
simulate
 ↓
persist/reward
 ↓
broadcast
~~~

---

# 25. Application Coordinators

No queremos que main.js vuelva a convertirse en el nuevo monolito.

Proponemos:

~~~text
GameApplication
├── SessionCoordinator
├── WorldCoordinator
├── EncounterCoordinator
└── CombatCoordinator
~~~

Coordinan casos de uso, pero no contienen todas las reglas.

---

# 26. Compatibility Layer

La migración debe ser incremental.

Durante una etapa coexistirán:

~~~text
Animal
GameState
Room
Arena3D
~~~

con:

~~~text
CreatureIndividual
World
Encounter
CombatInstance
~~~

La capa de adaptación permitirá mover una responsabilidad a la vez.

**No se permite un big-bang rewrite.**

---

# 27. Mapeo desde el sistema actual

| Actual | Destino |
|---|---|
| Animal | CreatureIndividual + PresentationAdapter |
| createDefaultAnimals | SpeciesDefinition/seed data |
| GameState | Session/World/Combat state separados |
| GameEngine | SimulationLoop + RenderLoop |
| BotAI | BehaviorSystem + CombatAI |
| Obstacle | Collision/World geometry |
| PowerUp | WorldObject/Interaction |
| Room | CombatInstance / private encounter |
| NetworkClient | WorldNetworkClient |
| Arena3D | CombatPresentation3D |
| database.json | Repository implementation temporal |
| main.js | Application coordinators |
| UIManager | Presentation/UI |

---

# 28. Lo que NO hacemos en F0.5

No vamos a:

- migrar todo a TypeScript inmediatamente;
- introducir Rust/Go por anticipación;
- cambiar WebSocket sin necesidad;
- introducir microservicios;
- sustituir Three.js por moda tecnológica;
- borrar Animal.js;
- borrar mokepon.js sin comprobar dependencias;
- construir el mundo 3D completo;
- cambiar combate antes de tener tests.

F0.5 define contratos; la implementación llegará por fases.

---

# 29. Orden de migración

## M0 — Safety Net
1. Tests base.
2. Contratos de dominio.
3. Security hardening prioritario.

## M1 — Domain Extraction
1. SpeciesDefinition.
2. CreatureIndividual.
3. Player/ownership.
4. Progression.

## M2 — World Simulation
1. World.
2. Zone.
3. MovementSystem.
4. CollisionSystem.
5. BehaviorSystem.
6. EncounterSystem.

## M3 — Network
1. Commands.
2. Snapshots.
3. Interest management.
4. Authoritative world state.

## M4 — Presentation
1. World3DRenderer.
2. Third-person camera.
3. GLB/glTF pipeline.
4. Animation.
5. VFX/audio.

## M5 — Integration
World → Encounter → Combat → Progression → World.

---

# 30. Testing Architecture

Debemos cubrir cuatro niveles:

~~~text
Unit
  ↓
Domain/System
  ↓
Integration
  ↓
Multiplayer/Load
~~~

Casos esenciales:

- movement
- collision
- behavior transitions
- encounter creation
- combat rules
- XP
- authorization
- invalid commands
- reconnect
- snapshot ordering
- persistence
- regression

---

# 31. Security Architecture

Prioridades heredadas de F0.2:

1. Verificación real de Google identity.
2. Eliminar confianza en report_match para recompensas.
3. KDF de contraseñas apropiado.
4. CORS restringido.
5. runtime DB fuera del repositorio.
6. validación de comandos.
7. rate limiting por operación.
8. autorización server-side.
9. protección contra replay/duplicación de comandos.
10. auditoría de eventos críticos.

---

# 32. Observability

Cada instancia deberá poder responder:

~~~text
¿Qué pasó?
¿Cuándo?
¿Con qué entidad?
¿En qué zona?
¿Qué tick?
¿Qué latencia?
¿Qué comando?
¿Qué resultado?
~~~

Eventos iniciales:

- player_connected
- player_disconnected
- creature_spawned
- creature_despawned
- encounter_started
- combat_started
- combat_finished
- progression_awarded
- command_rejected

---

# 33. Telemetry

Métricas mínimas:

- CCU
- active entities
- tick duration
- command latency
- snapshot size
- messages/sec
- CPU
- RAM
- GC
- FPS
- frame time
- draw calls
- combat duration
- encounters/minute

La telemetría será parte del producto técnico, no un añadido tardío.

---

# 34. Asset Pipeline

Dirección inicial:

~~~text
Blender
 ↓
GLB/glTF
 ↓
Asset validation/optimization
 ↓
Client asset registry
 ↓
World renderer
~~~

Los assets no deben definir reglas del dominio.

---

# 35. Contratos de arquitectura

Los siguientes contratos quedan como referencia oficial:

~~~text
Entity
SpeciesDefinition
CreatureIndividual
Player
NPC
Wildlife
World
WorldShard
Zone
Behavior
Encounter
CombatInstance
Progression
Repository
Command
Snapshot
Renderer
~~~

No se implementarán todos simultáneamente.

---

# 36. Criterio de éxito de F0.5

F0.5 estará completada cuando podamos responder, sin ambigüedad:

1. ¿Dónde vive cada regla?
2. ¿Quién es autoridad?
3. ¿Cómo se identifica un individuo?
4. ¿Cómo se separa especie de individuo?
5. ¿Cómo se mueve una criatura?
6. ¿Cómo decide una IA?
7. ¿Cómo nace un encounter?
8. ¿Cómo se crea un combate?
9. ¿Cómo se entrega XP?
10. ¿Cómo se persiste?
11. ¿Qué recibe el cliente?
12. ¿Cómo se renderiza?
13. ¿Cómo medimos rendimiento?
14. ¿Cómo testeamos?
15. ¿Cómo migramos el código actual sin romperlo?

---

# 37. Decisión final

**F0.5 no autoriza todavía la construcción completa del nuevo mundo.**

Autoriza el inicio de una migración incremental, empezando por:

**tests + seguridad + contratos de dominio.**

La arquitectura objetivo queda separada de la arquitectura actual para que podamos evolucionar el juego sin destruir su núcleo.
