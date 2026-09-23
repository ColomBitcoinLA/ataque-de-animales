# 🐾 Animal Combat — Visión del Producto

> Estado: **Fase 0 — F0.1 definida**  
> Última revisión: 2026-09-22

## 1. Propósito

Animal Combat evolucionará desde un juego de combates de animales hacia un **mundo vivo multijugador**, donde las mascotas/animales son los protagonistas y el combate es el principal sistema de progresión, pero no la única actividad.

La regla de producto es:

> **Grande en sistema, pequeño en contenido.**

No construiremos primero un mundo gigantesco. Construiremos los sistemas capaces de generar, simular, conectar y ampliar el mundo.

## 2. Protagonista

El protagonista jugable es el **animal/pet**.

El humano funciona como acompañante/representación del jugador. No combate.

Los animales podrán:
- caminar y explorar;
- interactuar con el entorno;
- encontrar jugadores, NPC y fauna;
- combatir;
- progresar;
- desarrollar identidad e historial;
- participar en eventos y actividades.

## 3. Individuos únicos

**Especie ≠ individuo.**

Cada mascota de jugador, NPC y animal salvaje debe poder tener identidad propia: atributos, comportamiento, experiencia, historial, relaciones y progresión.

El sistema debe permitir que, en un momento dado, un NPC, un jugador o un animal salvaje sea una entidad especialmente poderosa sin asumir que el jugador siempre es el centro de la simulación.

## 4. Mundo vivo

El mundo debe contener:
- jugadores;
- NPC humanos;
- NPC animales;
- fauna salvaje;
- lugares;
- actividades;
- encuentros;
- eventos;
- economía;
- progresión;
- relaciones y memoria, progresivamente.

La fauna no será simplemente una colección de enemigos. Algunos animales podrán ignorar, huir, ayudar, competir o atacar según especie, individuo, contexto y comportamiento.

## 5. Mundo inicial

El primer contenido será deliberadamente pequeño. Cali, Colombia, es una candidata natural para el primer escenario.

El sistema debe permitir posteriormente expandirse por Colombia y, si el producto lo justifica, hacia otras regiones del mundo.

## 6. Combate

El combate actual es una base que se conserva y evoluciona:
- elementos;
- AP;
- habilidades;
- estados;
- daño;
- progresión;
- PvE;
- PvP.

En la primera evolución, el encuentro nace en el mundo y puede transicionar a un espacio de combate dedicado sin romper la sensación de continuidad.

## 7. Modos integrados al mundo

Los modos existentes no desaparecen: cambian de forma.

| Actual | Evolución |
|---|---|
| IA | encuentros PvE |
| jugador | encuentros PvP |
| sala | arena/evento privado |
| crear sala | evento personalizado |

## 8. Progresión

La XP podrá provenir de:
- victorias;
- derrotas/participación;
- exploración;
- descubrimiento;
- actividades;
- entrenamiento;
- encuentros;
- eventos.

La progresión inicial será simple: combate → XP → nivel → habilidades → ranking básico.

## 9. Competición

Se incorporarán progresivamente:
1. combate;
2. XP;
3. nivel;
4. ranking;
5. ligas;
6. temporadas;
7. campeonatos.

El sistema competitivo global no forma parte del MVP.

## 10. Retención

La retención se diseñará alrededor de:
- curiosidad;
- colección;
- progresión;
- dominio;
- identidad;
- descubrimiento;
- comunidad;
- eventos.

No se utilizarán patrones manipulativos como base del producto.

## 11. Monetización

Principio:

> **El dinero acelera; no compra poder absoluto.**

No habrá pay-to-win.

Los beneficios premium deberán ser principalmente cosméticos, de conveniencia o aceleración razonable. Los objetivos importantes del juego deberán poder conseguirse jugando.

Fuentes futuras posibles:
- microtransacciones;
- cosméticos;
- membresías;
- eventos;
- campeonatos;
- contenido;
- patrocinios;
- publicidad no invasiva;
- merchandising;
- licencias;
- alianzas.

## 12. Influencias de diseño

Se extraen principios, no mecánicas ni propiedad intelectual:
- Age of Empires → estrategia/progresión.
- GTA → mundo/NPC/navegación.
- eFootball → competencia.
- Mario → accesibilidad/diversión inmediata.
- 007 → misiones.
- Pokémon → criaturas/colección/progresión.
- Mortal Kombat → impacto/VFX.
- Call of Duty → respuesta/feedback.
- Dragon Ball → evolución/poder.

## 13. Plataformas

Orden previsto:
1. Web Desktop.
2. Mobile Web/PWA.
3. Android/iOS.
4. Desktop empaquetado si las métricas lo justifican.

## 14. MVP conceptual

Un único pequeño territorio con:
- una zona habitable;
- una zona salvaje;
- caminos y obstáculos;
- una arena;
- 5–8 criaturas bien realizadas;
- fauna;
- NPC;
- PvE;
- PvP;
- 3–4 habilidades;
- elementos/estados;
- XP/niveles;
- encuentros;
- pequeños eventos;
- multiplayer compartido;
- economía simple;
- monetización opcional y justa, únicamente si el núcleo ya es divertido.

## 15. Exclusiones iniciales

No forman parte del MVP:
- continente gigante;
- cientos de criaturas;
- miles de jugadores simultáneos;
- economía masiva;
- blockchain;
- IA generativa para cada NPC;
- vehículos complejos;
- cientos de mapas;
- sistema competitivo mundial completo;
- múltiples monedas;
- gran infraestructura distribuida prematura.

## 16. Principio técnico rector

> **Primero construiremos el sistema capaz de construir el mundo; después ampliaremos el contenido.**
