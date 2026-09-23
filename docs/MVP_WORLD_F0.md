# 🐾 Animal Combat — F0.4 MVP World

> Estado: **F0.4 — especificación inicial congelable**
> Fecha: 2026-09-22
> Propósito: definir el primer mundo jugable como experimento de ecosistema, no como mapa grande.

## 0. Pregunta científica del MVP

El MVP será exitoso si demuestra que un pequeño mundo compartido puede producir, de forma repetible:

**exploración → observación → encuentro → interacción/conflicto → combate → resultado → progresión → nueva exploración**

El criterio no es "tener un mapa 3D", sino demostrar comportamiento sistémico convincente.

## 1. World Boundary

Primer mundo: **una micro-región inspirada en Cali, Colombia**, sin intentar reproducir toda la ciudad.

Límite lógico inicial:
- 1 zona habitable/village.
- 1 zona natural/wild zone.
- 1 red de caminos.
- 1 arena.
- 1–2 puntos de interés secundarios.
- fronteras naturales/artificiales que impidan salir del MVP.

La ubicación concreta de estos espacios se definirá durante el diseño de nivel; F0.4 no fija coordenadas reales todavía.

## 2. World Dimensions

Para la primera prueba no se fija aún una escala real en kilómetros. Se utilizará una **escala de simulación parametrizada** y se calibrará con:
- velocidad de movimiento;
- tiempo de cruce;
- densidad visual;
- cantidad de entidades;
- FPS;
- latencia.

Objetivo de diseño: que el jugador pueda atravesar las áreas principales sin que el mundo se sienta como una pantalla de combate, pero sin introducir desplazamientos largos y vacíos.

## 3. Zones

### Village
Función:
- spawn/entrada;
- seguridad;
- NPC;
- servicios;
- interacción social;
- entrenamiento;
- acceso a arena.

### Wild Zone
Función:
- exploración;
- fauna;
- recursos/coleccionables;
- encuentros PvE;
- descubrimiento;
- riesgo.

### Roads
Función:
- navegación;
- transición;
- encuentros casuales;
- conexión social entre zonas.

### Arena
Función:
- combate PvP consentido;
- combate/eventos;
- salas privadas;
- pruebas de habilidades.

La arena no sustituye los encuentros naturales del mundo.

## 4. Geography

El MVP tendrá:
- terreno caminable;
- obstáculos físicos;
- zonas de bloqueo;
- vegetación;
- elevación visual/funcional limitada;
- agua como elemento de navegación;
- puntos de cobertura/visibilidad donde sean útiles.

No se implementará física realista completa en F0.4.

## 5. Points of Interest

Primer conjunto:
1. Plaza/centro del village.
2. Centro de entrenamiento.
3. Entrada a wild zone.
4. Arena.
5. Un punto natural distintivo.
6. Un punto de descubrimiento/colección.

Cada POI debe justificar su existencia mediante una actividad o interacción.

## 6. Creatures

### Player pets
- 5–8 especies/plantillas iniciales.
- Deben incluir al menos animales domésticos reconocibles y algunas criaturas con identidad regional/fantástica compatible con el universo.
- La selección exacta se decidirá antes de producción de assets.

### NPC creatures
- criaturas controladas por simulación;
- individuos con identidad propia;
- pueden tener progresión sin ser jugadores.

### Wildlife
- especies con roles ecológicos distintos;
- algunas neutrales;
- algunas evasivas;
- algunas territoriales/agresivas;
- algunas útiles o interactivas.

**Principio:** especie ≠ individuo.

## 7. Human NPC

Tipos mínimos:
- habitantes;
- entrenadores;
- comerciante/servicio;
- organizador de arena/eventos;
- NPC especial de descubrimiento.

Los NPC humanos no combaten como protagonistas en el MVP.

## 8. Behavior

Mínimo de comportamiento:
- idle;
- locomoción;
- percepción simple;
- huida;
- persecución;
- defensa;
- ataque;
- retorno a territorio;
- interacción básica;
- reacción a jugador/otra criatura.

La IA generativa no es necesaria para este MVP.

La prioridad es simulación determinista, barata y testeable.

## 9. Encounters

Tipos:
- descubrimiento;
- fauna neutral;
- fauna territorial;
- PvE;
- PvP consentido;
- NPC/actividad;
- evento corto.

Flujo:

**World → Encounter → decisión → Combat o interacción → resultado → World**

El encuentro no debe obligar a combatir en todos los casos.

## 10. Combat

Se conserva el núcleo existente y se adapta al contexto de mundo:
- servidor autoritativo;
- elementos;
- habilidades;
- AP;
- estados;
- HP;
- resultado;
- XP.

MVP:
- 3–4 habilidades equipables;
- PvE;
- PvP;
- arena;
- transición mundo → combate → mundo.

El combate debe ser una instancia controlada, no una simulación física masiva del mundo.

## 11. Progression

Fuentes iniciales:
- combate;
- exploración;
- descubrimiento;
- entrenamiento;
- actividades;
- eventos.

Progresión:

**XP → nivel → habilidades/desbloqueos → evolución/variantes cuando corresponda.**

La derrota puede otorgar progresión limitada por participación, pero la victoria debe conservar una recompensa diferencial.

## 12. Activities

Mínimas:
- explorar;
- entrenar;
- descubrir;
- combatir;
- interactuar con NPC;
- coleccionar;
- participar en eventos cortos.

No se implementan profesiones, vehículos, housing ni sistemas económicos complejos en el MVP.

## 13. Economy

Primera economía deliberadamente pequeña:
- una moneda blanda;
- recompensas por actividades;
- servicios básicos;
- consumibles/objetos funcionales limitados.

No se introducen múltiples monedas.

## 14. Multiplayer

### Objetivo de diseño
Un mundo pequeño compartido donde el jugador pueda percibir que otras personas existen.

### Presupuesto inicial de prueba
No es una promesa de capacidad productiva. Se usará como primera hipótesis de carga:

- hasta 24 jugadores conectados por instancia;
- hasta 24 mascotas de jugadores;
- hasta 30 criaturas/NPC dinámicos activos;
- hasta 12 NPC humanos activos simultáneamente.

Estos valores se validarán mediante pruebas de carga antes de convertirlos en límites de producción.

### Densidad
El objetivo es evitar tanto el vacío como la saturación.

La simulación futura debe usar interés espacial:
- entidades cercanas: actualización frecuente;
- entidades lejanas: actualización reducida;
- entidades fuera de relevancia: simulación simplificada/suspendida según reglas.

## 15. Population / Density

Métricas a registrar:
- CCU;
- entidades activas;
- entidades por zona;
- encuentros/minuto;
- combates/minuto;
- duración media de sesión;
- latencia;
- desconexiones;
- mensajes WebSocket;
- CPU;
- RAM;
- FPS;
- draw calls;
- tiempo de frame.

La densidad final será experimental.

## 16. Simulation Tick

Primera hipótesis:
- simulación servidor: tick fijo objetivo de **20 Hz** para sistemas sensibles al tiempo;
- actualizaciones menos frecuentes para IA/world systems que no necesiten 20 Hz;
- render del cliente desacoplado del tick del servidor;
- interpolación de snapshots para movimiento remoto.

No todo el mundo debe simularse a 20 Hz.

## 17. Network Budget

Principios:
- servidor autoritativo;
- cliente envía intención/input, no estado final;
- snapshots/deltas para entidades relevantes;
- interest management por zona/proximidad;
- compresión/compactación cuando las mediciones lo justifiquen;
- no enviar a cada jugador información de entidades irrelevantes.

La primera versión reutilizará WebSocket, que ya existe.

## 18. Performance Budget

### Cliente
Objetivos iniciales:
- 60 FPS objetivo en equipos desktop compatibles;
- evitar frame-time sostenido >16.67 ms en escenario nominal;
- degradación controlada de calidad visual;
- limitar entidades/renderers visibles;
- assets GLB/glTF optimizados.

### Servidor
Medir:
- CPU por instancia;
- RAM;
- tick duration;
- número de entidades;
- mensajes/segundo;
- latencia;
- garbage collection.

No se fija aún un hardware mínimo definitivo.

## 19. Success Criteria

El MVP podrá considerarse funcional cuando un jugador pueda:

1. entrar al mundo;
2. controlar su mascota en tercera persona;
3. recorrer village/wild zone;
4. encontrar NPC, jugadores y fauna;
5. observar comportamientos diferentes;
6. interactuar sin que todo sea combate;
7. desencadenar un PvE;
8. participar en PvP consentido;
9. entrar a arena;
10. completar un combate;
11. recibir resultado y progresión;
12. regresar al mundo;
13. volver a explorar y encontrar situaciones diferentes.

### Prueba de "mundo vivo"

Con varios clientes conectados debe observarse que:
- las entidades no se sienten estáticas;
- la fauna reacciona;
- NPC se desplazan/actúan;
- jugadores pueden coincidir;
- encuentros aparecen sin menú plano;
- el resultado del combate afecta la progresión;
- el mundo sigue existiendo cuando un combate termina.

## 20. Non-goals

Fuera de F0.4/MVP:
- continente completo;
- cientos de especies;
- miles de CCU;
- economía masiva;
- blockchain;
- IA generativa por NPC;
- vehículos complejos;
- housing;
- clanes masivos;
- campeonatos mundiales;
- múltiples monedas;
- marketplace avanzado;
- sharding de producción;
- infraestructura de microservicios.

## 21. Escalabilidad conceptual

La expansión debe ser:

**Cali micro-región → más zonas → más regiones de Colombia → América → otras regiones**

sin cambiar los contratos fundamentales de:
- Entity;
- Creature;
- World;
- Zone;
- Encounter;
- Combat;
- Progression;
- Network.

El contenido crece; el núcleo no se reescribe.

## 22. Regla F0.4

> **El MVP no debe demostrar cuánto contenido podemos crear. Debe demostrar cuánto comportamiento sistémico podemos producir con poco contenido.**

