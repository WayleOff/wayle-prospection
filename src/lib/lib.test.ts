import { describe, expect, it } from "vitest";
import { findDuplicates } from "./duplicates";
import { normHandle, normPhone, normText, trigramSimilarity } from "./normalize";
import { parseQuickInput } from "./quick-input";
import { DEMO_REFERENCE, demoProspects } from "./repo/demo-data";
import { computeIndicators, monthKey, progress, stageChangeTarget, weekStart } from "./stats";
import { buildToday } from "./today";
import type { Activity, Prospect } from "./types";

describe("normalisation (mêmes résultats que le SQL)", () => {
  it("texte", () => expect(normText("  Café « Sous les Toits » !")).toBe("cafe sous les toits"));
  it("instagram", () => {
    expect(normHandle("https://www.instagram.com/Demo.Pizza/?hl=fr")).toBe("demo.pizza");
    expect(normHandle("@Demo.Pizza")).toBe("demo.pizza");
    expect(normHandle("")).toBeNull();
  });
  it("téléphone", () => {
    expect(normPhone("02 61 91 00 11")).toBe("33261910011");
    expect(normPhone("+33 2 61 91 00 11")).toBe("33261910011");
    expect(normPhone("")).toBeNull();
  });
  it("trigrammes = pg_trgm (valeurs relevées dans Postgres 16)", () => {
    const r = (a: string, b: string) => Math.round(trigramSimilarity(a, b) * 1e6) / 1e6;
    expect(r("pizzeria il faro", "pizzeria ilfaro")).toBe(0.736842);
    expect(r("cafe sous les toits", "cafe sous toits")).toBe(0.8);
    expect(r("le comptoir des marees", "comptoir marees")).toBe(0.727273);
    expect(r("abc", "xyz")).toBe(0);
    expect(r("studio yoga respire", "studio yoga")).toBe(0.6);
  });
});

describe("doublons", () => {
  const list = demoProspects().map((p, i) => ({ ...p, id: `p${i}` }));
  it("même Instagram", () => expect(findDuplicates(list, { name: "Autre", instagram: "https://instagram.com/Demo.IlFaro" })[0]?.reason).toBe("instagram"));
  it("même téléphone", () => expect(findDuplicates(list, { name: "Autre", phone: "0261910011" })[0]?.reason).toBe("phone"));
  it("nom proche", () => expect(findDuplicates(list, { name: "Pizzeria Ilfaro" }).map((d) => d.prospect.name)).toContain("Pizzeria Il Faro"));
  it("pas de faux doublon", () => expect(findDuplicates(list, { name: "Boulangerie Totalement Différente" })).toHaveLength(0));
  it("ignore les fiches archivées et l'exclue", () => {
    const l = list.map((p) => (p.name === "Pizzeria Il Faro" ? { ...p, archived_at: "2026-01-01" } : p));
    expect(findDuplicates(l, { name: "Pizzeria Il Faro" })).toHaveLength(0);
    expect(findDuplicates(list, { name: "Pizzeria Il Faro" }, "p10")).toHaveLength(0);
  });
});

describe("ajout rapide", () => {
  it("nom seul", () => expect(parseQuickInput("Boulangerie Dupont").patch.name).toBe("Boulangerie Dupont"));
  it("lien Instagram", () => {
    const r = parseQuickInput("https://www.instagram.com/chez.leon/");
    expect(r.patch.instagram).toBe("@chez.leon");
    expect(r.patch.name).toBeUndefined();
  });
  it("lien Google Maps avec nom et position", () => {
    const r = parseQuickInput("https://www.google.com/maps/place/Caf%C3%A9+des+Docks/@49.4432,1.0993,17z/data=!3m1");
    expect(r.patch.name).toBe("Café des Docks");
    expect(r.patch.lat).toBeCloseTo(49.4432);
    expect(r.patch.lng).toBeCloseTo(1.0993);
  });
  it("lien Maps raccourci : avertit au lieu de deviner", () => {
    const r = parseQuickInput("https://maps.app.goo.gl/abc123");
    expect(r.warnings.length).toBe(1);
    expect(r.patch.name).toBeUndefined();
  });
  it("texte libre avec téléphone, e-mail et @compte", () => {
    const r = parseQuickInput("Chez Léon 06 39 98 12 34 leon@example.org @chez.leon");
    expect(r.patch).toMatchObject({ name: "Chez Léon", phone: "06 39 98 12 34", email: "leon@example.org", instagram: "@chez.leon" });
  });
  it("le nom tapé l'emporte sur celui du lien Maps", () => {
    expect(parseQuickInput("Mon resto https://www.google.com/maps/place/Autre/@49.4,1.1,17z").patch.name).toBe("Mon resto");
  });
});

describe("jeu de démonstration", () => {
  it("mêmes prospects que supabase/seed.sql", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/seed.sql", "utf8");
    const start = sql.indexOf("from (values");
    const block = sql.slice(start, sql.indexOf(") as v(", start));
    const names = [...block.matchAll(/^\s*\('([^']*(?:''[^']*)*)',\s*'[^']*',\s*'/gm)].map((m) => m[1].replace(/''/g, "'"));
    const demo = demoProspects().map((p) => p.name);
    expect(names.length).toBeGreaterThanOrEqual(15);
    expect([...names].sort()).toEqual([...demo].sort());
  });
});

describe("aujourd'hui et indicateurs", () => {
  const stages = DEMO_REFERENCE.stages;
  const st = (re: RegExp) => stages.find((s) => re.test(s.name))!;
  const mk = (name: string, stage: RegExp, extra: Partial<Prospect> = {}): Prospect => ({
    ...demoProspects()[0], id: name, name, stage_id: st(stage).id, next_action_at: null, next_action_label: null, archived_at: null,
    do_not_contact: false, score: 50, est_amount_cents: null, tag_ids: [], ...extra,
  });
  const now = new Date("2026-11-26T12:00:00");
  const act = (prospect_id: string, kind: Activity["kind"], body: string | null, d: string): Activity =>
    ({ id: prospect_id + kind + d, prospect_id, kind, channel: null, body, author_id: null, created_at: new Date(d).toISOString() });

  it("liste du jour : retard, aujourd'hui, à venir, exclusions", () => {
    const l = buildToday([
      mk("retard", /Contacté/, { next_action_at: "2026-11-24" }),
      mk("jour", /Répondu/, { next_action_at: "2026-11-26" }),
      mk("demain", /RDV/, { next_action_at: "2026-11-27" }),
      mk("loin", /RDV/, { next_action_at: "2026-12-20" }),
      mk("gagne", /Gagné/, { next_action_at: "2026-11-26" }),
      mk("archive", /Contacté/, { next_action_at: "2026-11-24", archived_at: "2026-11-01" }),
      mk("stop", /Contacté/, { next_action_at: "2026-11-24", do_not_contact: true }),
      mk("a1", /À contacter/, { score: 80 }), mk("a2", /À contacter/, { score: 90 }), mk("a3", /À contacter/, { next_action_at: "2026-11-30" }),
    ], stages, "2026-11-26", "2026-12-03");
    expect(l.late.map((p) => p.name)).toEqual(["retard"]);
    expect(l.today.map((p) => p.name)).toEqual(["jour"]);
    expect(l.upcoming.map((p) => p.name)).toEqual(["demain", "a3"]);
    expect(l.firstContacts.map((p) => p.name)).toEqual(["a2", "a1"]);
  });

  it("cible d'un changement d'étape", () => {
    expect(stageChangeTarget("Contacté → Répondu")).toBe("Répondu");
    expect(stageChangeTarget("Répondu → Contacté (annulé)")).toBeNull();
    expect(stageChangeTarget("note libre")).toBeNull();
  });

  it("indicateurs", () => {
    const ps = [mk("A", /RDV/), mk("B", /Reel/), mk("C", /Gagné/, { est_amount_cents: 150000 }), mk("D", /Perdu/), mk("E", /Contacté/)];
    const ac = [
      act("A", "message", null, "2026-11-25T10:00:00"), act("A", "reply", null, "2026-11-25T15:00:00"),
      act("E", "message", null, "2026-11-10T10:00:00"), act("B", "call", null, "2026-11-02T10:00:00"),
      act("A", "stage_change", "Répondu → RDV / Tournage prévu", "2026-11-25T16:00:00"),
      act("B", "stage_change", "RDV / Tournage prévu → Reel livré", "2026-11-20T16:00:00"),
      act("C", "stage_change", "Reel livré → Gagné", "2026-11-21T16:00:00"),
      act("D", "stage_change", "Reel livré → Gagné", "2026-11-21T17:00:00"),   // depuis perdu : ne compte pas
      act("E", "stage_change", "Répondu → RDV / Tournage prévu", "2026-11-22T17:00:00"), // revenu en arrière : ne compte pas
    ];
    const i = computeIndicators(ps, ac, stages, now);
    expect(i.contactsWeek).toBe(1);               // lundi 23 → seulement le message du 25
    expect(i.contactsMonth).toBe(3);
    expect(i.contacted30).toBe(3);
    expect(i.replied30).toBe(1);
    expect(i.replyRate).toBeCloseTo(1 / 3);
    expect(i.rdvMonth).toBe(3);                    // A, B (au-delà), C (au-delà) ; E est revenu avant
    expect(i.reelsMonth).toBe(2);                  // B, C
    expect(i.wonMonth).toBe(1);
    expect(i.revenueCents).toBe(150000);
  });

  it("avancement vers l'objectif", () => {
    expect(progress(500, 1000)).toBe(0.5);
    expect(progress(2000, 1000)).toBe(1);
    expect(progress(10, 0)).toBeNull();
    expect(monthKey(new Date("2026-11-26T12:00:00"))).toBe("2026-11-01");
    expect(weekStart(now).getDate()).toBe(23);
  });
});
