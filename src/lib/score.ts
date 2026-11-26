import type { Category, Prospect, ScoreRule } from "./types";

export type ScoreKey = "recent_opening" | "ig_weak" | "independent" | "priority_category" | "reachable";

/** Critères de départ ; les poids et l'activation se règlent dans Paramètres (table score_rules). */
export const DEFAULT_SCORE_RULES: ScoreRule[] = [
  { key: "recent_opening", label: "Ouverture récente", weight: 25, is_active: true, params: { months: 12 } },
  { key: "ig_weak", label: "Instagram faible ou inactif", weight: 25, is_active: true, params: {} },
  { key: "independent", label: "Établissement indépendant", weight: 20, is_active: true, params: {} },
  { key: "priority_category", label: "Catégorie prioritaire", weight: 15, is_active: true, params: {} },
  { key: "reachable", label: "Joignable directement", weight: 15, is_active: true, params: {} },
];

export const RULE_HINT: Record<string, string> = {
  recent_opening: "Ouvert depuis moins de N mois : points complets ; jusqu'à 2 × N mois : la moitié.",
  ig_weak: "Compte Instagram faible ou inactif : points complets ; pas de compte : la moitié ; compte actif : aucun point.",
  independent: "Case « Établissement indépendant » cochée sur la fiche.",
  priority_category: "Catégorie marquée comme prioritaire.",
  reachable: "Au moins un Instagram, un e-mail ou un téléphone renseigné.",
};

/** Champs de la fiche dont dépend le score : si l'un d'eux change, le score est recalculé. */
export const SCORE_FIELDS: (keyof Prospect)[] = ["opened_on", "ig_activity", "instagram", "is_independent", "category_id", "email", "phone"];

/** Règles enregistrées en base, complétées par les règles de départ pour celles qui manquent. */
export function mergeRules(stored: ScoreRule[]): ScoreRule[] {
  return DEFAULT_SCORE_RULES.map((d) => {
    const s = stored.find((r) => r.key === d.key);
    return s ? { ...d, weight: clampWeight(s.weight), is_active: s.is_active, params: { ...d.params, ...s.params } } : d;
  });
}

export const clampWeight = (n: number) => Math.min(100, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));

function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}

export interface ScorePart { key: string; label: string; weight: number; earned: number; note: string }
export interface ScoreResult { score: number; parts: ScorePart[] }

type Scorable = Pick<Prospect, "opened_on" | "ig_activity" | "instagram" | "is_independent" | "category_id" | "email" | "phone">;

function fraction(rule: ScoreRule, p: Scorable, cats: Category[], today: string): { f: number; note: string } {
  switch (rule.key) {
    case "recent_opening": {
      if (!p.opened_on) return { f: 0, note: "date d'ouverture inconnue" };
      const n = Math.max(1, Number(rule.params.months) || 12);
      const m = monthsBetween(p.opened_on, today);
      if (m <= n) return { f: 1, note: m < 0 ? "ouvre bientôt" : `ouvert il y a ${m} mois` };
      if (m <= 2 * n) return { f: 0.5, note: `ouvert il y a ${m} mois` };
      return { f: 0, note: `ouvert il y a ${m} mois` };
    }
    case "ig_weak":
      if (p.ig_activity === "low" || p.ig_activity === "inactive") return { f: 1, note: p.ig_activity === "low" ? "Instagram faible" : "Instagram inactif" };
      if (p.ig_activity === "active") return { f: 0, note: "Instagram actif" };
      return p.instagram ? { f: 0.25, note: "activité Instagram non renseignée" } : { f: 0.5, note: "pas de compte Instagram" };
    case "independent":
      return p.is_independent ? { f: 1, note: "indépendant" } : { f: 0, note: "pas indépendant" };
    case "priority_category": {
      const c = cats.find((x) => x.id === p.category_id);
      return c?.is_priority ? { f: 1, note: c.name } : { f: 0, note: c ? `${c.name} (non prioritaire)` : "pas de catégorie" };
    }
    case "reachable":
      return p.instagram || p.email || p.phone ? { f: 1, note: "contact possible" } : { f: 0, note: "aucun moyen de contact" };
    default:
      return { f: 0, note: "" };
  }
}

/** Score de 0 à 100 : part des points obtenus sur le total des critères actifs. */
export function computeScore(p: Scorable, rules: ScoreRule[], cats: Category[], today: string): ScoreResult {
  const active = rules.filter((r) => r.is_active && r.weight > 0);
  const total = active.reduce((s, r) => s + r.weight, 0);
  const parts = active.map((r) => {
    const { f, note } = fraction(r, p, cats, today);
    return { key: r.key, label: r.label, weight: r.weight, earned: Math.round(f * r.weight * 10) / 10, note };
  });
  if (total === 0) return { score: 0, parts };
  const raw = parts.reduce((s, x) => s + x.earned, 0);
  return { score: Math.min(100, Math.max(0, Math.round((raw / total) * 100))), parts };
}
