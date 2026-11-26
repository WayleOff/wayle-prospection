import type { Channel, Sequence, SequenceInput, SequenceStep, Stage, StepAction, Template } from "./types";

export const ACTION_LABEL: Record<StepAction, string> = { first_contact: "Premier message", follow_up: "Relance (message)", call: "Appel", visit: "Visite" };
export const ACTIONS: StepAction[] = ["first_contact", "follow_up", "call", "visit"];
/** Étapes qui se traitent avec le générateur de messages. */
export const isMessageAction = (a: StepAction) => a === "first_contact" || a === "follow_up";

export const sortSteps = (steps: SequenceStep[]) => [...steps].sort((a, b) => a.step_no - b.step_no);
export const stepByNo = (seq: Sequence, no: number) => seq.steps.find((s) => s.step_no === no) ?? null;

/** Texte lisible : « J0 · Premier message », « J+3 · Relance courte ». */
export const stepText = (s: SequenceStep) => `${s.day_offset === 0 ? "J0" : `J+${s.day_offset}`} · ${s.label}`;

const dayStr = (iso: string) => iso.slice(0, 10);

/**
 * Date de l'étape : début de la séquence + son décalage, mais jamais avant `floor`
 * (on ne programme pas une étape dans le passé, ce qui ferait s'empiler les retards).
 */
export function stepDueOn(startedAt: string, step: SequenceStep, floor: string): string {
  const planned = addDaysTo(dayStr(startedAt), step.day_offset);
  return planned < floor ? floor : planned;
}
function addDaysTo(date: string, n: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
}

export type Plan = { finished: true } | { finished: false; step: SequenceStep; dueOn: string };

/** Après l'étape `doneNo` : la suivante (avec sa date), ou la fin de la séquence. `today` = AAAA-MM-JJ. */
export function planAfter(seq: Sequence, startedAt: string, doneNo: number, today: string): Plan {
  const next = sortSteps(seq.steps).find((s) => s.step_no > doneNo);
  if (!next) return { finished: true };
  return { finished: false, step: next, dueOn: stepDueOn(startedAt, next, addDaysTo(today, 1)) };
}

/** Première étape d'une séquence lancée aujourd'hui (jamais dans le passé, mais J0 reste aujourd'hui). */
export function planStart(seq: Sequence, today: string): { step: SequenceStep; dueOn: string } | null {
  const first = sortSteps(seq.steps)[0];
  return first ? { step: first, dueOn: stepDueOn(today, first, today) } : null;
}

/** Une réponse met fin à la séquence : « Répondu » ou plus loin dans le pipeline, gagné ou perdu. */
export function stageStopsSequence(stages: Stage[], stageId: string): boolean {
  const s = stages.find((x) => x.id === stageId);
  if (!s) return false;
  if (s.kind !== "open") return true;
  const open = stages.filter((x) => x.kind === "open").sort((a, b) => a.position - b.position);
  return open.findIndex((x) => x.id === s.id) >= 2;
}

/** Numéro d'étape (1-based dans l'ordre) pour l'affichage « étape 2/4 ». */
export function progressOf(seq: Sequence, currentNo: number): { index: number; total: number } {
  const steps = sortSteps(seq.steps);
  return { index: Math.max(1, steps.findIndex((s) => s.step_no === currentNo) + 1), total: steps.length };
}

/** Enregistre une séquence : étapes triées par jour, numérotées 1…n. */
export function normalizeSteps(steps: SequenceStep[]): SequenceStep[] {
  return steps
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.day_offset - b.s.day_offset || a.i - b.i)
    .map(({ s }, i) => ({ ...s, step_no: i + 1, label: s.label.trim() || ACTION_LABEL[s.action] }));
}

/** Séquence de départ : J0 premier message → J+3 relance courte → J+7 visite ou appel → J+14 dernier message. */
export function starterSequence(templates: Template[] = []): SequenceInput {
  const tpl = (re: RegExp) => templates.find((t) => t.channel === "instagram" && t.tone === "tu" && re.test(t.name))?.id ?? null;
  const ig: Channel = "instagram";
  return {
    name: "Relance standard (commerces)",
    is_active: true,
    steps: [
      { step_no: 1, day_offset: 0, action: "first_contact", channel: ig, label: "Premier message", template_id: tpl(/premier/i) },
      { step_no: 2, day_offset: 3, action: "follow_up", channel: ig, label: "Relance courte", template_id: tpl(/relance/i) },
      { step_no: 3, day_offset: 7, action: "visit", channel: "visit", label: "Visite ou appel", template_id: null },
      { step_no: 4, day_offset: 14, action: "follow_up", channel: ig, label: "Dernier message", template_id: tpl(/dernier/i) },
    ],
  };
}

