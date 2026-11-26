import type { Prospect, Quote, Stage } from "./types";

export interface CalEvent { id: string; day: string; kind: "action" | "quote"; prospectId: string; title: string; detail: string; late: boolean }

const iso = (d: Date) => d.toLocaleDateString("sv-SE");

/** Les semaines (lundi → dimanche) qui couvrent le mois : jours AAAA-MM-JJ, `inMonth` faux pour les jours des mois voisins. */
export function monthGrid(year: number, month: number): { day: string; inMonth: boolean }[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const weeks: { day: string; inMonth: boolean }[][] = [];
  for (let w = 0; ; w++) {
    const row = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + w * 7 + i); return { day: iso(d), inMonth: d.getMonth() === month }; });
    weeks.push(row);
    const last = new Date(start); last.setDate(start.getDate() + w * 7 + 6);
    if (last.getMonth() !== month || (last.getMonth() === month && new Date(last.getTime() + 86400000).getMonth() !== month)) break;
  }
  return weeks;
}

/** Ce qui se passe, jour par jour : actions prévues sur les fiches en cours, et devis envoyés qui arrivent à échéance. */
export function calendarEvents(prospects: Prospect[], stages: Stage[], quotes: Pick<Quote, "id" | "number" | "prospect_id" | "status" | "valid_until" | "total_cents">[], todayStr: string): CalEvent[] {
  const open = new Set(stages.filter((s) => s.kind === "open").map((s) => s.id));
  const byId = new Map(prospects.map((p) => [p.id, p]));
  const out: CalEvent[] = [];
  for (const p of prospects) {
    if (p.archived_at || p.do_not_contact || !open.has(p.stage_id) || !p.next_action_at) continue;
    out.push({ id: `a-${p.id}`, day: p.next_action_at, kind: "action", prospectId: p.id, title: p.name, detail: p.next_action_label ?? "Relance", late: p.next_action_at < todayStr });
  }
  for (const q of quotes) {
    const p = byId.get(q.prospect_id);
    if (q.status !== "sent" || !q.valid_until || !p || p.archived_at) continue;
    out.push({ id: `q-${q.id}`, day: q.valid_until, kind: "quote", prospectId: p.id, title: p.name, detail: `Le devis ${q.number} expire`, late: q.valid_until < todayStr });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title, "fr"));
}

export const groupByDay = (events: CalEvent[]): Map<string, CalEvent[]> => {
  const m = new Map<string, CalEvent[]>();
  for (const e of events) (m.get(e.day) ?? m.set(e.day, []).get(e.day)!).push(e);
  return m;
};
