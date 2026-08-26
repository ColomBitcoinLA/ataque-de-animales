# 🗺️ Animal Combat - Hoja de Ruta de Innovación y Escalabilidad (Roadmap)

Este documento define las fases de evolución del juego, desde la refactorización arquitectónica hasta la implementación de mecánicas avanzadas multijugador, progresión y visión futura 3D.

---

## 📌 Fase 1: Desacoplamiento, Limpieza y Red en Tiempo Real (Completada)
- [x] **Modularización del Frontend (ES Modules)**:
  - `js/core/GameState.js` (FSM para controlar vistas y transiciones).
  - `js/core/GameEngine.js` (Loop desacoplado con `requestAnimationFrame` y delta time).
  - `js/entities/Animal.js` (Clases con hitbox ajustada e interpolación de movimiento).
  - `js/network/NetworkClient.js` (Cliente WebSocket con reconexión automática y fallback).
  - `js/ui/UIManager.js` + `js/main.js` (entrada del cliente).
- [x] **Modernización del Backend (Node.js + WebSockets / ws)**:
  - Reemplazo del polling HTTP de 50ms por WebSockets orientados a eventos.
  - Generación segura de IDs (`crypto.randomUUID`).
  - Limpieza automática de jugadores desconectados (heartbeat/ping-pong).

---

## 📌 Fase 2: Sistema de Combate Avanzado, VFX y Audio (Completada)
- [x] **Mecánicas de Combate Estratégico**:
  - Barra de Maná / Puntos de Acción (AP): 3 iniciales, +1 por turno.
  - Ataque Básico (0 AP) vs Ataque Cargado Elemental (2 AP).
  - Efectos de Estado: Quemado 🔥, Congelado 💧, Envenenado 🌱.
  - Barras de HP animadas con transiciones dinámicas.
- [x] **Feedback Audiovisual (Juice it!)**:
  - Partículas en Canvas (`js/fx/ParticleSystem.js`): fuego, agua y tierra + Screen Shake.
  - Gestor de Audio procedural (`js/audio/SoundManager.js`) con Web Audio API.
- [x] **UI interactiva responsiva**: tooltips en ataques, badges de estado, diseño responsive móvil/escritorio.

---

## 📌 Fase 3: Multijugador Autoritativo, Matchmaking y Matriz Elemental (Completada)
- [x] **Salas de Juego (Rooms) y Lobby**:
  - Salas privadas con código alfanumérico de 4 caracteres (ej. `K9X2`).
  - Quick Matchmaking automático (cola 1v1) y feedback de búsqueda.
  - Limpieza automática de salas al desconectar o finalizar partida.
- [x] **Combate 1v1 Autoritativo con Sincronización de Turnos**:
  - El servidor gestiona HP/AP/estados de ambos jugadores.
  - Bloqueo de botones tras lanzar ataque y feedback de espera (*"Esperando acción del rival"*).
  - Timer de 10s por ronda → difusión de `round_resolved`.
  - Matriz elemental Pokémon: Súper Efectivo ($\times 1.5$), Poco Efectivo ($\times 0.7$) y Afinidad STAB ($\times 1.2$).
- [x] **Modo Un Solo Jugador con IA Inteligente** (`js/entities/BotAI.js`):
  - Fácil (aleatorio), Normal (30% cargados), Difícil/Maestro (IA predictiva con historial y contramedidas elementales).
- [x] **Mapas Dinámicos**:
  - Obstáculos sólidos (`js/entities/Obstacle.js`): rocas, árboles y ruinas con colisión AABB.
  - Power-ups (`js/entities/PowerUp.js`): Poción de Vida 💖 (+25 HP), Cristal de Maná ⚡ (+1 AP), Botas de Rapidez 🥾 (+30% vel).

---

## 📌 Fase 4: Persistencia, Cuentas, Progresión y Niveles de Mascotas (Completada)
- [x] **Autenticación y Cuentas de Usuario**:
  - Registro y Login seguro con hash de contraseñas (SHA-256 + salt) y sesión con token UUID (`crypto` nativo).
  - Base de datos local estructurada (`data/database.json`) con auto-guardado y escritura atómica.
  - Modo Invitado (Guest) para jugar sin registro con progreso en `localStorage`.
- [x] **Perfil y Estadísticas de Jugador**:
  - Historial de últimas 5 partidas, Victorias, Derrotas y % Winrate.
  - Tarjeta de Perfil en el Lobby + modal de Login/Registro (`AuthModal.js`, `ProfileManager.js`).
- [x] **Sistema de Progresión y Niveles (XP)**:
  - Ganancia de experiencia tras cada batalla (+100 XP victoria, +35 XP derrota, +50 bonus vs IA Difícil).
  - Niveles: 1 (0), 2 (200), 3 (500), 4 (1000), 5 (1600) → Maestro de Bestias.
  - Títulos honoríficos (*Aprendiz, Gladiador, Guerrero Elemental, Domador Legendario, Maestro de Bestias*).
  - Bonos por nivel: +5 HP y +2 DMG por nivel en las mascotas.
- [x] **Integración WebSocket**: token de sesión en el handshake (`?token=`) para registrar automáticamente resultados online.

---

## 🚀 Fase 5: Visión Futura & Innovación Avanzada (Roadmap Futuro)
- [ ] **Motor de Batalla 3D (Three.js / WebGL)**:
  - Escenarios de combate 3D estilo Pokémon Stadium / Colosseum.
  - Modelos tridimensionales de animales y proyectiles 3D en tiempo real.
  - Cámaras cinemáticas dinámicas durante el impacto de ataques cargados.
- [ ] **Árbol de Tipos Elementales Expandido**:
  - Nuevos elementos: ⚡ **Eléctrico**, ❄️ **Hielo**, 🍃 **Planta**, 💨 **Viento**, 🐉 **Dragón**, 🌑 **Sombra**, ☀️ **Luz**.
  - Interacciones de debilidades y resistencias compuestas (doble tipo elemental).
- [ ] **Escalabilidad de Stats por Nivel (RPG Stats Curve)**:
  - Atributos por nivel: **Ataque (ATK)**, **Defensa (DEF)**, **Velocidad (SPD)** y **Maestría Elemental**.
  - Las mascotas de nivel superior mitigan la desventaja elemental contra rivales de menor nivel gracias a su defensa y poder acumulado.
- [ ] **Árbol de Habilidades y Movimientos Personalizables**:
  - Selección de hasta 4 habilidades activas antes de entrar al combate.
