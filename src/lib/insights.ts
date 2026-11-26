import type { Activity, Channel, Invoice, Prospect, Quote, Stage } from "./types";

const DAY = 86400000;
const CONTACT = new Set<Activity["kind"]>(["message", "call", "visit"]);
const at = (a: Activity) => new Date(a.created_at).getTime();

export interface Bar { key: string; label: string; value: number; of?: number; note?: string }

/** Prospects actifs par étape (dans l'ordre du pipeline), perdus et gagnés compris. Les fiches archivées sont exclues. */
export function funnel(prospects: Prospect[], stages: Stage[]): Bar[] {
  const live = prospects.filter((p) => !p.archived_at);
  return [...stages].sort((a, b) => a.position - b.position).map((s) => ({ key: s.id, label: s.name, value: live.filter((p) => p.stage_id === s.id).length }));
}

/** Monday 00:00 (heure locale) de la semaine contenant `d`. */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

export interface WeekPoint { start: string; label: string; contacts: number; replies: number }
/** Contacts (messages, appels, visites) et réponses par semaine, sur les `weeks` dernières semaines (la plus récente en dernier). */
export function weekly(activities: Activity[], weeks: number, now = new Date()): WeekPoint[] {
  const first = mondayOf(now); first.setDate(first.getDate() - 7 * (weeks - 1));
  const out: WeekPoint[] = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(first); d.setDate(d.getDate() + 7 * i);
    return { start: d.toLocaleDateString("sv-SE"), label: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), contacts: 0, replies: 0 };
  });
  for (const a of activities) {
    const t = at(a);
    if (t < first.getTime()) continue;
    const i = Math.floor((mondayOf(new Date(t)).getTime() - first.getTime()) / (7 * DAY) + 0.01);
    if (i < 0 || i >= weeks) continue;
    if (CONTACT.has(a.kind)) out[i].contacts++;
    else if (a.kind === "reply") out[i].replies++;
  }
  return out;
}

/** Taux de réponse sur la période : parmi les prospects contactés, ceux qui ont répondu (après le premier contact). Groupé par canal ou par catégorie. */
export function replyRates(prospects: Prospect[], activities: Activity[], sinceMs: number, groupBy: "channel" | "category", labels: Record<string, string>): Bar[] {
  const byProspect = new Map<string, Activity[]>();
  for (const a of activities) if (at(a) >= sinceMs) (byProspect.get(a.prospect_id) ?? byProspect.set(a.prospect_id, []).get(a.prospect_id)!).push(a);
  const pById = new Map(prospects.map((p) => [p.id, p]));
  const groups = new Map<string, { contacted: Set<string>; replied: Set<string> }>();
  const g = (k: string) => groups.get(k) ?? groups.set(k, { contacted: new Set(), replied: new Set() }).get(k)!;
  for (const [pid, list] of byProspect) {
    const sorted = [...list].sort((a, b) => at(a) - at(b));
    const firstContactAt = new Map<string, number>(); // clé de groupe → date du premier contact
    for (const a of sorted) {
      if (!CONTACT.has(a.kind)) continue;
      const key = groupBy === "channel" ? (a.kind === "call" ? "phone" : a.kind === "visit" ? "visit" : (a.channel ?? "")) : (pById.get(pid)?.category_id ?? "");
      if (!key || firstContactAt.has(key)) continue;
      firstContactAt.set(key, at(a));
      g(key).contacted.add(pid);
    }
    const reply = sorted.find((a) => a.kind === "reply");
    if (reply) {
      if (groupBy === "category") { const key = pById.get(pid)?.category_id ?? ""; if (key && firstContactAt.has(key) && at(reply) >= firstContactAt.get(key)!) g(key).replied.add(pid); }
      else {
        // La réponse est attribuée au canal de la réponse si connu, sinon au dernier canal de contact qui la précède.
        let key = reply.channel as string | null;
        if (!key || !firstContactAt.has(key)) {
          const before = sorted.filter((a) => CONTACT.has(a.kind) && at(a) <= at(reply));
          const last = before[before.length - 1];
          key = last ? (last.kind === "call" ? "phone" : last.kind === "visit" ? "visit" : last.channel) : null;
        }
        if (key && firstContactAt.has(key)) g(key).replied.add(pid);
      }
    }
  }
  return [...groups.entries()]
    .map(([key, v]) => ({ key, label: labels[key] ?? key, value: v.contacted.size === 0 ? 0 : v.replied.size / v.contacted.size, of: v.contacted.size, note: `${v.replied.size} réponse${v.replied.size > 1 ? "s" : ""} sur ${v.contacted.size}` }))
    .filter((b) => (b.of ?? 0) > 0)
    .sort((a, b) => b.value - a.value || (b.of ?? 0) - (a.of ?? 0));
}

const median = (xs: number[]) => { if (xs.length === 0) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export interface Delays { toFirstContact: number | null; toReply: number | null; samples: { contact: number; reply: number } }
/** Délais médians, en jours : création de la fiche → premier contact, et premier contact → première réponse. */
export function delays(prospects: Prospect[], activities: Activity[]): Delays {
  const pById = new Map(prospects.filter((p) => !p.archived_at).map((p) => [p.id, p]));
  const firstContact = new Map<string, number>(), firstReply = new Map<string, number>();
  for (const a of [...activities].sort((x, y) => at(x) - at(y))) {
    if (!pById.has(a.prospect_id)) continue;
    if (CONTACT.has(a.kind) && !firstContact.has(a.prospect_id)) firstContact.set(a.prospect_id, at(a));
    if (a.kind === "reply" && !firstReply.has(a.prospect_id) && firstContact.has(a.prospect_id) && at(a) >= firstContact.get(a.prospect_id)!) firstReply.set(a.prospect_id, at(a));
  }
  const c: number[] = [], r: number[] = [];
  for (const [id, t] of firstContact) { const p = pById.get(id)!; const d = (t - new Date(p.created_at).getTime()) / DAY; if (d >= 0) c.push(d); }
  for (const [id, t] of firstReply) r.push((t - firstContact.get(id)!) / DAY);
  return { toFirstContact: median(c), toReply: median(r), samples: { contact: c.length, reply: r.length } };
}

/** Répartition d'un champ texte (source, motif de perte) : les `top` plus fréquents, le reste regroupé en « Autres ». */
export function countBy(prospects: Prospect[], pick: (p: Prospect) => string | null, top: number, other = "Autres"): Bar[] {
  const m = new Map<string, number>();
  for (const p of prospects) { if (p.archived_at) continue; const v = pick(p)?.trim(); if (v) m.set(v, (m.get(v) ?? 0) + 1); }
  const sorted = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
  const head = sorted.slice(0, top).map(([label, value]) => ({ key: label, label, value }));
  const rest = sorted.slice(top).reduce((n, [, v]) => n + v, 0);
  return rest > 0 ? [...head, { key: "__other", label: other, value: rest }] : head;
}

export interface MonthPoint { month: string; label: string; cents: number }
/** Encaissements par mois (date de paiement), sur les `months` derniers mois, avoirs déduits. */
export function revenueByMonth(invoices: Pick<Invoice, "paid_on" | "total_cents">[], months: number, now = new Date()): MonthPoint[] {
  const out: MonthPoint[] = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""), cents: 0 };
  });
  for (const i of invoices) { const m = i.paid_on?.slice(0, 7); const slot = out.find((o) => o.month === m); if (slot) slot.cents += i.total_cents; }
  return out;
}

export interface Headline { active: number; won: number; lost: number; conversion: number | null; quotesPending: number; quotesPendingCents: number }
export function headline(prospects: Prospect[], stages: Stage[], quotes: Pick<Quote, "status" | "total_cents">[]): Headline {
  const kind = new Map(stages.map((s) => [s.id, s.kind]));
  let active = 0, won = 0, lost = 0;
  for (const p of prospects) { if (p.archived_at) continue; const k = kind.get(p.stage_id); if (k === "won") won++; else if (k === "lost") lost++; else active++; }
  const pending = quotes.filter((q) => q.status === "sent");
  return { active, won, lost, conversion: won + lost === 0 ? null : won / (won + lost), quotesPending: pending.length, quotesPendingCents: pending.reduce((n, q) => n + q.total_cents, 0) };
}

export const CHANNEL_KEYS: Channel[] = ["instagram", "email", "phone", "visit", "linkedin", "tiktok"];
