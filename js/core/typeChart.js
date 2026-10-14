/**
 * Adaptador de compatibilidad para el árbol elemental en el cliente (M1.8).
 *
 * Re-exporta la fuente única de la verdad desde js/rules/index.mjs
 * preservando la API pública intacta para todos los consumidores de frontend
 * (BotAI.js, main.js, SkillLoadout.js, UIManager.js).
 */

export {
  TIPOS,
  TIPOS_ELEMENTALES,
  TYPE_MATCHUP,
  DRAGON_RESISTANCES,
  DRAGON_RESIST_MULT,
  typeMultiplier,
  getEffectForCharged,
  emojiForTipo,
} from "../rules/index.mjs";
