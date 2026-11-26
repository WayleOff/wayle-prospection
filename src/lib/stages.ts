import type { Stage, StageKind } from "./types";

export const KIND_LABEL: Record<StageKind, string> = { open: "En cours", won: "Gagné", lost: "Perdu" };
export const STAGE_COLORS = ["#64748b", "#2563eb", "#0891b2", "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#9333ea"];

export const sortStages = (l: Stage[]) => [...l].sort((a, b) => a.position - b.position);
/** Positions 1…n dans l'ordre de la liste. */
export const renumber = (l: Stage[]): Stage[] => l.map((s, i) => ({ ...s, position: i + 1 }));

/** Déplace une étape d'un cran (-1 vers la gauche du pipeline, +1 vers la droite). */
export function moveStage(l: Stage[], id: string, dir: -1 | 1): Stage[] {
  const a = sortStages(l);
  const i = a.findIndex((s) => s.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= a.length) return renumber(a);
  [a[i], a[j]] = [a[j], a[i]];
  return renumber(a);
}

/** Problèmes qui empêchent d'enregistrer (liste vide = tout va bien). */
export function stageProblems(l: Stage[]): string[] {
  const out: string[] = [];
  if (l.some((s) => !s.name.trim())) out.push("Chaque étape doit avoir un nom.");
  const names = l.map((s) => s.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) out.push("Deux étapes portent le même nom.");
  if (!l.some((s) => s.kind === "open")) out.push("Il faut au moins une étape « En cours ».");
  if (!l.some((s) => s.kind === "won")) out.push("Il faut une étape « Gagné ».");
  if (!l.some((s) => s.kind === "lost")) out.push("Il faut une étape « Perdu ».");
  if (l.some((s) => !/^#[0-9a-f]{6}$/i.test(s.color))) out.push("Une couleur est invalide.");
  return out;
}

/** Les statistiques cherchent ces mots dans le nom des étapes : on prévient quand un renommage les ferait disparaître. */
export function nameWarnings(l: Stage[]): string[] {
  const out: string[] = [];
  if (!l.some((s) => /rdv|tournage/i.test(s.name))) out.push("Aucune étape ne contient « RDV » ou « tournage » : le chiffre « rendez-vous du mois » restera à zéro.");
  if (!l.some((s) => /reel/i.test(s.name))) out.push("Aucune étape ne contient « reel » : le chiffre « reels du mois » restera à zéro.");
  return out;
}
