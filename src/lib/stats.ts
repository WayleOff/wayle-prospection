import type { Activity, Goal, Prospect, Stage } from "./types";

/** Premier jour du mois, AAAA-MM-01, en heure locale. */
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
/** Lundi de la semaine en cours, à minuit (heure locale). */
export function weekStart(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
export const monthStart = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), 1);
/** Plus ancienne date utile aux indicateurs : le plus tôt entre le début du mois, de la semaine et 30 jours. */
export function statsSince(now = new Date()): string {
  const d30 = new Date(now.getTime() - 30 * 86400000);
  return new Date(Math.min(monthStart(now).getTime(), weekStart(now).getTime(), d30.getTime())).toISOString();
}

const CONTACT_KINDS = new Set<Activity["kind"]>(["message", "call", "visit"]);

export interface Indicators {
  contactsWeek: number;
  contactsMonth: number;
  /** Part des prospects contactés ces 30 jours qui ont répondu (0 à 1), null s'il n'y a eu aucun contact. */
  replyRate: number | null;
  contacted30: number;
  replied30: number;
  rdvMonth: number;
  reelsMonth: number;
  wonMonth: number;
  revenueCents: number;
}

/** Cible d'un changement d'étape écrit par l'application : « A → B » (les annulations « B → A (annulé) » sont ignorées). */
export function stageChangeTarget(body: string | null): string | null {
  if (!body || /\(annulé\)\s*$/.test(body)) return null;
  const i = body.lastIndexOf(" → ");
  return i < 0 ? null : body.slice(i + 3).trim();
}

/**
 * Indicateurs du tableau de bord. Une étape « atteinte ce mois-ci » = un changement d'étape vers elle (ou au-delà)
 * ce mois-ci, et la fiche est toujours à cette étape ou plus loin (et pas perdue) : un retour en arrière ne compte pas.
 */
export function computeIndicators(prospects: Prospect[], activities: Activity[], stages: Stage[], now = new Date()): Indicators {
  const wk = weekStart(now).getTime();
  const mo = monthStart(now).getTime();
  const d30 = now.getTime() - 30 * 86400000;
  const at = (a: Activity) => new Date(a.created_at).getTime();
  const byId = new Map(prospects.map((p) => [p.id, p]));
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const stageByName = new Map(stages.map((s) => [s.name, s]));

  const contact = activities.filter((a) => CONTACT_KINDS.has(a.kind));
  const contacted30 = new Set(contact.filter((a) => at(a) >= d30).map((a) => a.prospect_id));
  const replied30 = new Set(activities.filter((a) => a.kind === "reply" && at(a) >= d30 && contacted30.has(a.prospect_id)).map((a) => a.prospect_id));

  const stageNamed = (re: RegExp) => stages.find((s) => re.test(s.name));
  const reached = (stage: Stage | undefined): Set<string> => {
    const out = new Set<string>();
    if (!stage) return out;
    for (const a of activities) {
      if (a.kind !== "stage_change" || at(a) < mo) continue;
      const target = stageByName.get(stageChangeTarget(a.body) ?? "");
      if (!target || target.position < stage.position) continue; // un passage plus loin vaut aussi : on a bien atteint cette étape
      const p = byId.get(a.prospect_id);
      const cur = p && stageById.get(p.stage_id);
      if (p && cur && cur.kind !== "lost" && cur.position >= stage.position) out.add(p.id);
    }
    return out;
  };
  const rdv = reached(stageNamed(/rdv|tournage/i));
  const reels = reached(stageNamed(/reel/i));
  const won = reached(stages.find((s) => s.kind === "won"));
  let revenueCents = 0;
  for (const id of won) revenueCents += byId.get(id)?.est_amount_cents ?? 0;

  return {
    contactsWeek: contact.filter((a) => at(a) >= wk).length,
    contactsMonth: contact.filter((a) => at(a) >= mo).length,
    replyRate: contacted30.size === 0 ? null : replied30.size / contacted30.size,
    contacted30: contacted30.size,
    replied30: replied30.size,
    rdvMonth: rdv.size,
    reelsMonth: reels.size,
    wonMonth: won.size,
    revenueCents,
  };
}

/** Avancement vers un objectif, entre 0 et 1 (plafonné) ; null si pas d'objectif. */
export const progress = (value: number, goal: number | null | undefined): number | null =>
  goal && goal > 0 ? Math.min(1, value / goal) : null;

export const emptyGoal = (month: string): Goal => ({ month, revenue_cents: 0, contacts: 0 });
