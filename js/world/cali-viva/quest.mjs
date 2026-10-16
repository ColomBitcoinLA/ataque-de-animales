/**
 * Cali Viva — guion de exploración local del benchmark.
 * La "XP demo" es SOLO visual: no se envía al servidor, no se persiste
 * y no es una recompensa autoritativa.
 */

export const QUEST_STEPS = Object.freeze([
  Object.freeze({ id: 'meet-lucia', text: 'Habla con Lucía en el malecón' }),
  Object.freeze({ id: 'visit-mirador', text: 'Sube al mirador del puente' }),
  Object.freeze({ id: 'report-lucia', text: 'Vuelve con Lucía y cuéntale qué viste' }),
]);

export const DEMO_XP_PER_STEP = 10;

export function createQuestState() {
  return Object.freeze({ stepIndex: 0, completed: Object.freeze([]), demoXp: 0 });
}

export function currentStep(state) {
  return QUEST_STEPS[state.stepIndex] ?? null;
}

export function isQuestComplete(state) {
  return state.stepIndex >= QUEST_STEPS.length;
}

/** Solo avanza si stepId es el paso actual; nunca salta ni repite pasos. */
export function completeStep(state, stepId) {
  const step = currentStep(state);
  if (!step || step.id !== stepId) return { state, changed: false };
  return {
    changed: true,
    state: Object.freeze({
      stepIndex: state.stepIndex + 1,
      completed: Object.freeze([...state.completed, stepId]),
      demoXp: state.demoXp + DEMO_XP_PER_STEP,
    }),
  };
}
