import { describe, expect, it } from "vitest";
import { findDuplicates } from "./duplicates";
import { normHandle, normPhone, normText, trigramSimilarity } from "./normalize";
import { parseQuickInput } from "./quick-input";
import { demoProspects } from "./repo/demo-data";

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
