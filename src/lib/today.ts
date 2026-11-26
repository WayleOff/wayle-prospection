import type { Prospect, Stage } from "./types";

export interface TodayLists {
  late: Prospect[];
  today: Prospect[];
  upcoming: Prospect[];
  firstContacts: Prospect[];
}

const byDateThenScore = (a: Prospect, b: Prospect) =>
  (a.next_action_at ?? "").localeCompare(b.next_action_at ?? "") || b.score - a.score || a.name.localeCompare(b.name, "fr");

/**
 * Actions de la journée à partir des fiches : relances en retard, du jour, à venir (7 jours),
 * et prospects de la première étape sans action prévue, les mieux notés d'abord.
 * Les fiches archivées, « ne pas contacter » et celles des étapes gagné/perdu sont exclues.
 */
export function buildToday(prospects: Prospect[], stages: Stage[], todayStr: string, weekAheadStr: string, firstLimit = 8): TodayLists {
  const open = new Set(stages.filter((s) => s.kind === "open").map((s) => s.id));
  const ok = (p: Prospect) => !p.archived_at && !p.do_not_contact && open.has(p.stage_id);
  const live = prospects.filter(ok);
  const withAction = live.filter((p) => p.next_action_at);
  const first = [...stages].filter((s) => s.kind === "open").sort((a, b) => a.position - b.position)[0];
  return {
    late: withAction.filter((p) => p.next_action_at! < todayStr).sort(byDateThenScore),
    today: withAction.filter((p) => p.next_action_at === todayStr).sort(byDateThenScore),
    upcoming: withAction.filter((p) => p.next_action_at! > todayStr && p.next_action_at! <= weekAheadStr).sort(byDateThenScore),
    firstContacts: first
      ? live.filter((p) => p.stage_id === first.id && !p.next_action_at).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "fr")).slice(0, firstLimit)
      : [],
  };
}
