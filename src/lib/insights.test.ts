import { describe, expect, it } from "vitest";
import { countBy, delays, funnel, headline, mondayOf, replyRates, revenueByMonth, weekly } from "./insights";
import type { Activity, Prospect, Stage } from "./types";

const stages: Stage[] = [
  { id: "s1", name: "À contacter", position: 1, kind: "open", color: "#000" },
  { id: "s2", name: "Contacté", position: 2, kind: "open", color: "#000" },
  { id: "s3", name: "Gagné", position: 3, kind: "won", color: "#000" },
  { id: "s4", name: "Perdu", position: 4, kind: "lost", color: "#000" },
];
const p = (id: string, over: Partial<Prospect> = {}): Prospect => ({ id, name: id, category_id: null, stage_id: "s1", source: null, lost_reason: null, archived_at: null, created_at: "2026-11-01T08:00:00Z", ...over } as Prospect);
const a = (prospect_id: string, kind: Activity["kind"], created_at: string, channel: Activity["channel"] = null): Activity => ({ id: Math.random().toString(), prospect_id, kind, channel, body: null, author_id: null, created_at });

describe("entonnoir et chiffres clés", () => {
  const ps = [p("a"), p("b", { stage_id: "s2" }), p("c", { stage_id: "s3" }), p("d", { stage_id: "s4" }), p("e", { stage_id: "s3" }), p("f", { archived_at: "2026-11-02T00:00:00Z" })];
  it("compte par étape, archivés exclus", () => { expect(funnel(ps, stages).map((b) => b.value)).toEqual([1, 1, 2, 1]); });
  it("conversion = gagnés / (gagnés + perdus)", () => {
    const h = headline(ps, stages, [{ status: "sent", total_cents: 9000 }, { status: "draft", total_cents: 1 }, { status: "sent", total_cents: 1000 }]);
    expect(h).toMatchObject({ active: 2, won: 2, lost: 1, quotesPending: 2, quotesPendingCents: 10000 });
    expect(h.conversion).toBeCloseTo(2 / 3);
    expect(headline([], stages, []).conversion).toBeNull();
  });
});

describe("semaines", () => {
  it("lundi", () => { expect(mondayOf(new Date(2026, 10, 22)).getDate()).toBe(16); expect(mondayOf(new Date(2026, 10, 23)).getDate()).toBe(23); });
  it("contacts et réponses par semaine, dans l'ordre", () => {
    const now = new Date(2026, 10, 26, 12); // jeudi 26/11 : semaine du 23/11
    const w = weekly([a("a", "message", new Date(2026, 10, 24, 9).toISOString()), a("a", "call", new Date(2026, 10, 25, 9).toISOString()), a("a", "reply", new Date(2026, 10, 25, 18).toISOString()),
      a("b", "visit", new Date(2026, 10, 17, 9).toISOString()), a("b", "note", new Date(2026, 10, 17, 9).toISOString()), a("b", "message", new Date(2026, 9, 1).toISOString())], 3, now);
    expect(w.map((x) => [x.contacts, x.replies])).toEqual([[0, 0], [1, 0], [2, 1]]);
    expect(w[2].start).toBe("2026-11-23");
  });
});

describe("taux de réponse", () => {
  const ps = [p("a", { category_id: "c1" }), p("b", { category_id: "c1" }), p("c", { category_id: "c2" })];
  const acts = [
    a("a", "message", "2026-11-10T09:00:00Z", "instagram"), a("a", "reply", "2026-11-11T09:00:00Z", "instagram"),
    a("b", "message", "2026-11-10T09:00:00Z", "instagram"),
    a("c", "message", "2026-11-10T09:00:00Z", "email"), a("c", "call", "2026-11-12T09:00:00Z"), a("c", "reply", "2026-11-12T12:00:00Z"),
    a("a", "reply", "2026-10-01T09:00:00Z"), // avant la période : ignorée
  ];
  const since = new Date("2026-11-01T00:00:00Z").getTime();
  it("par canal", () => {
    const r = replyRates(ps, acts, since, "channel", { instagram: "Instagram", email: "E-mail", phone: "Téléphone" });
    const by = Object.fromEntries(r.map((x) => [x.key, x]));
    expect(by.instagram).toMatchObject({ value: 0.5, of: 2 });
    expect(by.phone).toMatchObject({ value: 1, of: 1 }); // la réponse suit l'appel
    expect(by.email).toMatchObject({ value: 0, of: 1 });
    expect(r[0].key).toBe("phone");
  });
  it("par catégorie", () => {
    const r = replyRates(ps, acts, since, "category", { c1: "Café", c2: "Boutique" });
    expect(r.map((x) => [x.label, x.value, x.of])).toEqual([["Boutique", 1, 1], ["Café", 0.5, 2]]);
  });
});

describe("délais", () => {
  it("médianes en jours", () => {
    const ps = [p("a", { created_at: "2026-11-01T00:00:00Z" }), p("b", { created_at: "2026-11-01T00:00:00Z" }), p("c", { created_at: "2026-11-01T00:00:00Z" })];
    const d = delays(ps, [a("a", "message", "2026-11-03T00:00:00Z"), a("a", "reply", "2026-11-04T00:00:00Z"), a("b", "message", "2026-11-05T00:00:00Z"), a("c", "reply", "2026-11-06T00:00:00Z")]);
    expect(d.toFirstContact).toBe(3); // 2 et 4 jours
    expect(d.toReply).toBe(1);
    expect(d.samples).toEqual({ contact: 2, reply: 1 });
    expect(delays([], []).toFirstContact).toBeNull();
  });
});

describe("répartitions et encaissements", () => {
  it("regroupe la queue", () => {
    const ps = ["x", "x", "x", "y", "y", "z", "w", null].map((s, i) => p(String(i), { source: s }));
    expect(countBy(ps, (q) => q.source, 2).map((b) => [b.label, b.value])).toEqual([["x", 3], ["y", 2], ["Autres", 2]]);
  });
  it("encaissé par mois, avoir déduit", () => {
    const r = revenueByMonth([{ paid_on: "2026-11-05", total_cents: 45000 }, { paid_on: "2026-11-20", total_cents: -5000 }, { paid_on: "2026-09-02", total_cents: 1000 }, { paid_on: null, total_cents: 99999 }, { paid_on: "2025-01-01", total_cents: 7 }], 3, new Date(2026, 10, 26));
    expect(r.map((x) => [x.month, x.cents])).toEqual([["2026-09", 1000], ["2026-10", 0], ["2026-11", 40000]]);
  });
});
