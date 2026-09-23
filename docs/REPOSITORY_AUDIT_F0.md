# 🔍 Animal Combat — Auditoría Técnica F0.2

> Estado: **F0.2 completada**
> Fecha: 2026-09-22
> Alcance: auditoría documental + inspección del código fuente del branch por defecto. No se realizaron cambios funcionales al juego.

## 1. Dictamen ejecutivo

El repositorio ya posee una base funcional relevante: cliente modular ES Modules, GameState, GameEngine con requestAnimationFrame, entidades, WebSocket, salas 1v1, combate autoritativo, IA básica, progresión, persistencia local y una capa inicial de presentación 3D.

Sin embargo, la arquitectura actual todavía representa principalmente un **juego de combate con mapa**, no un **mundo vivo persistente**.

La transformación correcta no es un rewrite total. Debemos conservar el núcleo de combate, red y progresión donde sus contratos sean útiles y separar progresivamente sus responsabilidades para soportar:

**World Simulation + Individual Creatures + NPC/AI + Encounters + 3D Presentation + Authoritative Server.**

## 2. Hallazgos por sistema

| Sistema | Estado actual | Mantener | Refactorizar | Reemplazar | Prioridad |
|---|---|---|---|---|---|
| GameState | FSM pequeña: LOBBY/SELECCION/MAPA/COMBATE/FIN | Concepto FSM | Separar world/combat/session state | No | Alta |
| GameEngine | rAF + delta time + tick de red 20 Hz | Sí | Extraer simulación/render/red | No | Alta |
| Animal | entidad 2D con posición, hitbox, vida y ataques | Concepto de entidad | Convertir en Creature/Individual | No | Crítica |
| BotAI | IA de combate por dificultad | Algoritmos base | Separar decisión de combate de comportamiento mundial | No | Alta |
| Obstacles | colisiones AABB 2D | Concepto | Generalizar a world collision | No | Media |
| PowerUps | pickups 2D | Concepto de interacción | Data-driven world objects | No | Media |
| NetworkClient | WebSocket con reconnect | Sí | Protocolo de mundo, snapshots, interest management | No | Crítica |
| Rooms | 1v1 de máximo 2 jugadores | Modelo de sesión/instancia | Convertir salas en encuentros/arenas y después shards | No | Alta |
| Combat server | autoritativo para 1v1 | Sí | Extraer CombatService | No | Crítica |
| Persistence | JSON local + sesiones | Útil para prototipo | Abstracción repository + DB real cuando métricas lo exijan | Probablemente a futuro | Alta |
| UI | modular en partes | Sí | desacoplar UI de reglas | No | Media |
| 3D | Three.js/WebGL; sprites 2D dentro de escena 3D | Experiencia/VFX | motor de mundo, cámara tercera persona, modelos GLB, locomoción | Capa actual como presentación de transición | Crítica |
| Legacy mokepon.js | implementación antigua y global coexistente | Solo si existe dependencia real | aislar/eliminar después de verificar rutas | Sí, eventualmente | Alta |
| Testing | script placeholder, sin suite real | No | suite automatizada tras evaluación | No aplica | Crítica |
| Observabilidad | no evidenciada como sistema | — | métricas/logs/tracing mínimos | — | Alta |

## 3. Hallazgos de arquitectura

### A. El concepto de Animal todavía está demasiado ligado al juego 2D

Animal.js contiene posición, velocidad, tamaño, hitbox, imagen y dibujo Canvas. Es correcto para el prototipo, pero no representa todavía una entidad persistente del mundo.

Evolución prevista:

SpeciesDefinition → CreatureIndividual → Stats → Traits → Behavior → Progression → History → Relationships.

La especie será configuración; el individuo será estado.

### B. GameState todavía mezcla dominios

El estado actual contiene lobby, selección, mapa, combate, red remota, HP, AP, estados y rooms.

Debe evolucionar hacia dominios separados:

- SessionState
- WorldState
- EncounterState
- CombatState
- PlayerState
- NetworkState

Un coordinador puede orquestarlos sin convertirlos en un único objeto global.

### C. El servidor es autoritativo para el combate, pero no para el mundo

Esto es suficiente para el juego actual, pero no para el futuro.

Objetivo:

Server = truth of simulation

Client = presentation + local input + interpolation

### D. Rooms todavía son partidas, no mundo

Actualmente Room limita la partida a dos participantes. Eso se conserva como modelo de combate/arena, pero no debe convertirse en el modelo de todo el mundo.

La futura arquitectura debe diferenciar:

WorldShard → Zone → Encounter → CombatInstance.

### E. La capa 3D actual no es todavía gameplay 3D de mundo

Arena3D.js utiliza Three.js/WebGL, cámara, luces, efectos y sprites de mascotas. Es una buena capa de presentación para combate, pero las criaturas siguen siendo imágenes/sprites y no existen locomoción, navegación 3D, modelos esqueléticos, animaciones de movimiento ni simulación de mundo.

Conclusión: conservar como prototipo/experiencia de transición; evolucionar progresivamente.

## 4. Hallazgos críticos de seguridad

### S1 — OAuth de Google no está realmente verificado

El endpoint /api/auth/google acepta un credential, pero el código inspeccionado decodifica el payload del JWT y usa sus campos sin verificar criptográficamente la firma ni los claims de Google.

Además, el frontend actual genera datos simulados para el flujo de Google.

**Dictamen:** no debe considerarse OAuth real ni seguridad de identidad de producción.

### S2 — /api/report_match confía en datos enviados por el cliente

Un usuario autenticado puede enviar un resultado de partida mediante HTTP. El servidor registra XP a partir de ese payload.

**Riesgo:** la progresión puede ser manipulada si el endpoint está disponible en producción.

**Regla futura:** XP y recompensas deben originarse exclusivamente de eventos de juego validados por el servidor.

### S3 — Hash de contraseñas insuficiente para producción

La implementación actual usa SHA-256 con salt. El documento de arquitectura menciona PBKDF2, pero el código inspeccionado no implementa PBKDF2.

**Dictamen:** migrar a un KDF apropiado (por ejemplo Argon2id o scrypt/PBKDF2 según restricciones) antes de producción.

### S4 — CORS abierto

El servidor utiliza cors() sin una política de origen restringida.

Debe endurecerse cuando el producto tenga dominios reales.

### S5 — Datos persistentes sensibles dentro del repositorio

data/database.json contiene cuentas de prueba, correos/datos de perfil y sesiones persistentes.

Aunque parezcan datos de desarrollo, **no deben formar parte del repositorio de producción**.

Acciones requeridas:
- sacar DB/runtime data del control de versiones;
- revocar/invalidate sesiones expuestas;
- sustituir datos de prueba;
- agregar reglas de secret/data hygiene;
- verificar historial Git si hubo exposición real.

## 5. Hallazgos de calidad

### Q1 — No existe suite de tests real

package.json mantiene un script test placeholder.

Necesitamos pruebas antes de realizar cambios estructurales importantes.

### Q2 — Duplicación legacy

Existe js/mokepon.js con implementación global antigua mientras js/main.js utiliza la arquitectura modular nueva.

Antes de eliminarlo debemos confirmar HTML, imports, scripts y rutas de despliegue.

### Q3 — Lógica de dominio mezclada

Parte de combate, progresión, networking y UI todavía se coordina desde main.js/index.js.

Esto funciona para el tamaño actual, pero será un cuello de botella al introducir mundo vivo.

## 6. Dictamen por objetivo de Animal Combat World

| Capacidad futura | Base actual | Gap |
|---|---|---|
| Combate PvE | Sí | Encounters + fauna |
| Combate PvP | Sí | Mundo compartido |
| Progresión | Sí | Creature progression |
| Multiplayer | Sí | World networking |
| NPC | IA de combate | Behavioral simulation |
| Fauna | Enemigos/mapa simples | Ecosystem |
| Individuos únicos | No | Nuevo dominio |
| Memoria/historial de individuos | No | Nuevo dominio |
| Mundo 3D | Presentación de arena | Nuevo world renderer |
| Cámara tercera persona | No | Nuevo sistema |
| Modelos 3D | No | Asset pipeline |
| Navegación 3D | No | Navigation/collision |
| Sharding | No | Futuro |
| Telemetría | Parcial/no evidenciada | Nuevo sistema |
| Ligas | Ranking/progresión base | Nuevo sistema competitivo |

## 7. Decisiones F0.2

1. **No hacer rewrite total.**
2. Mantener combate autoritativo como núcleo.
3. Mantener WebSocket como transporte base.
4. Separar simulación, dominio y presentación.
5. Crear el dominio Creature/Individual antes de multiplicar contenido.
6. Diseñar el mundo como datos, no como código hardcoded.
7. Tratar Rooms como instancias de encuentro/combate, no como mundo.
8. Posponer Rust/Go/TypeScript 7 hasta que la auditoría de rendimiento o mantenimiento justifique el cambio.
9. Crear tests antes de refactors estructurales.
10. Corregir primero las vulnerabilidades S1–S5 antes de considerar producción pública.

## 8. Orden técnico recomendado después de Fase 0

Tests + seguridad → contratos de dominio → Creature/Individual → World Simulation → networking de mundo → 3D world presentation → encounters → progresión ampliada → live ops.

## 9. Estado

**F0.2 — COMPLETADA.**

La auditoría no autoriza todavía cambios de implementación del mundo. El siguiente paso de Fase 0 es congelar el diseño del MVP (F0.4) y después traducirlo a arquitectura técnica (F0.5).
