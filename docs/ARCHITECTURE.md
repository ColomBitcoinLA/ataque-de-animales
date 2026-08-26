# 🏛️ Animal Combat - Documento de Arquitectura y Diseño del Sistema

## 1. Diagnóstico del Estado Inicial vs Estado Actual

### 1.1 Estado Inicial (Legacy)
- **Monolito sin modularidad**: Lógica de presentación, canvas, estado de juego y red mezclados en un solo archivo.
- **Cuello de botella (Polling HTTP)**: Peticiones `POST` cada 50ms (`20 req/seg`) saturando el servidor.
- **Inseguridad**: Cálculo de daño y estado en cliente manipulable por consola.
- **Fugas de memoria**: Clientes desconectados nunca se eliminaban del backend.

### 1.2 Estado Actual (V3 Implementado)
- **Arquitectura Modular ES6**: Separación estricta en `/core`, `/entities`, `/network`, `/ui`, `/fx`, `/audio`.
- **Servidor Autoritativo con WebSockets (`ws`)**:
  - `RoomManager` con salas privadas (códigos de 4 letras) y Quick Matchmaking.
  - Sincronización de combate por turnos con bloqueo de botones tras atacar y timer de 10s.
  - Matriz elemental estilo Pokémon con afinidad STAB ($\times 1.2$), Súper Efectivo ($\times 1.5$) y Poco Efectivo ($\times 0.7$).
- **Efectos Audiovisuales**: Web Audio API procedural y motor de partículas Canvas con screen shake.
- **Modo Un Solo Jugador**: Inteligencia Artificial predictiva con 3 niveles de dificultad (`BotAI.js`).
- **Mapas Dinámicos**: Obstáculos sólidos con colisiones AABB y power-ups de vida 💖, maná ⚡ y velocidad 🥾.

---

## 2. Diagrama de Arquitectura del Sistema

```mermaid
graph TD
    Client1[Cliente Web - Jugador 1] <--> |WebSocket / Eventos Tipados| Server[Servidor Node.js / Express + WS]
    Client2[Cliente Web - Jugador 2] <--> |WebSocket / Eventos Tipados| Server
    
    subgraph Frontend Modular
        FSM[Máquina de Estados Finita GameState.js]
        CanvasEngine[Motor Canvas 2D & Interpolación GameEngine.js]
        AudioFX[ParticleSystem.js & SoundManager.js]
        LobbyUI[LobbyManager.js & UIManager.js]
        BotEngine[BotAI.js - IA Predictiva]
    end
    
    subgraph Backend Autoritativo
        RoomManager[Gestor de Salas & Quick Matchmaking]
        CombatEngine[Cálculo de Daño, AP, Efectos y Matriz Elemental]
        TurnTimer[Timer de Ronda de 10s]
        SecurityLayer[UUIDv4 / Heartbeat 10s / Anti-cheat]
    end
    
    subgraph Persistencia y Cuentas (Fase 4)
        AuthService[AuthService.js - JWT / Crypto Hashing]
        Database[Persistencia JSON / SQLite - Historial & Stats]
        ProgressionSystem[Cálculo de XP, Niveles y Rangos]
    end
```

---

## 3. Matriz de Combate Elemental y Afinidad (STAB)

El sistema de combate implementa un modelo táctico inspirado en Pokémon:

| Tipo Atacante | Objetivo Fuego 🔥 | Objetivo Agua 💧 | Objetivo Tierra 🌱 |
| :--- | :---: | :---: | :---: |
| **Fuego 🔥** | $\times 1.0$ (Neutral) | $\times 0.7$ (Poco Efectivo) | $\times 1.5$ (Súper Efectivo) |
| **Agua 💧** | $\times 1.5$ (Súper Efectivo) | $\times 1.0$ (Neutral) | $\times 0.7$ (Poco Efectivo) |
| **Tierra 🌱** | $\times 0.7$ (Poco Efectivo) | $\times 1.5$ (Súper Efectivo) | $\times 1.0$ (Neutral) |

- **Bonus de Afinidad Elemental (STAB - Same-Type Attack Bonus)**:
  - Cuando una mascota lanza un ataque de su propio elemento (ej. Neptuno usando Agua), obtiene un **+20% de daño base**.
- **Ataques Cargados (2 AP)**:
  - Aplican efectos alterados por 3 rondas: **Quemado** (8 daño/turno), **Congelado** (25% reducción de daño recibido) o **Envenenado** (vulnerabilidad aumentada).

---

## 4. Arquitectura de Progresión y Escalabilidad (Fase 4 & Visión Futura)

### 4.1 Fase 4 (Persistencia y Cuentas)
- **Base de Datos Local**: Almacenamiento seguro en archivo estructurado (`data/database.json`) con hashing de contraseñas (SHA-256 / PBKDF2) y tokens JWT.
- **Historial de Combate**: Registro de winrate, batallas recientes y estadísticas por mascota.
- **Sistema de Niveles**: Ganancia de XP por victoria/derrota, desbloqueo de títulos honoríficos y bordes cosméticos.

### 4.2 Visión Futura (Fase 5+): Batallas 3D y RPG Completo
- **Renderizado 3D en Tiempo Real**: Migración del canvas 2D de combate a **Three.js / WebGL** con arenas tridimensionales, cámaras dinámicas de combate y animaciones de ataques proyectil/físicas 3D.
- **Ampliación del Árbol Elemental**:
  - Incorporación de elementos avanzados: ⚡ **Eléctrico**, ❄️ **Hielo**, 🍃 **Planta**, 💨 **Viento**, 🐉 **Dragón**.
- **Mitigación de Desventajas por Nivel y Stats**:
  - Sistema de atributos escalables: **Ataque (ATK)**, **Defensa (DEF)**, **Velocidad (SPD)** y **Maestría Elemental**.
  - Una mascota de alto nivel (ej. Tierrudo Nivel 15) podrá mitigar la desventaja elemental contra una mascota de bajo nivel (Salamander Nivel 2) gracias a su mayor DEF y HP acumulado.
