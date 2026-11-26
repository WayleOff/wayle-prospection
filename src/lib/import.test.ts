import { describe, expect, it } from "vitest";
import { decodeText, parseCsv } from "./csv";
import { buildRows, cleanEmail, cleanWebsite, guessMapping, parseBool, parseDate, parseIgActivity, stripNotionLinks, type ImportContext } from "./import";
import { DEMO_REFERENCE, demoProspects } from "./repo/demo-data";
import { DEFAULT_SCORE_RULES, computeScore, mergeRules } from "./score";

describe("lecture CSV", () => {
  it("virgules, guillemets, retours à la ligne et BOM", () => {
    const t = parseCsv('﻿Nom,Notes\n"Café ""Le Port""","ligne 1\nligne 2"\nBoulangerie,\n');
    expect(t).toEqual([["Nom", "Notes"], ['Café "Le Port"', "ligne 1\nligne 2"], ["Boulangerie", ""]]);
  });
  it("point-virgule (Excel français) et lignes vides ignorées", () => {
    expect(parseCsv("Nom;Tél\r\nA;0102030405\r\n\r\nB;\r\n")).toEqual([["Nom", "Tél"], ["A", "0102030405"], ["B", ""]]);
  });
  it("tabulation", () => expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]));
  it("lignes courtes complétées", () => expect(parseCsv("a,b,c\n1,2")[1]).toEqual(["1", "2", ""]));
  it("Windows-1252 si l'UTF-8 est invalide", () => expect(decodeText(new Uint8Array([0x43, 0x61, 0x66, 0xe9]))).toBe("Café"));
});

describe("valeurs", () => {
  it("dates", () => {
    expect(parseDate("2026-03-14")).toBe("2026-03-14");
    expect(parseDate("14/03/2026")).toBe("2026-03-14");
    expect(parseDate("14-03-26")).toBe("2026-03-14");
    expect(parseDate("14 mars 2026")).toBe("2026-03-14");
    expect(parseDate("March 14, 2026")).toBe("2026-03-14");
    expect(parseDate("2026/03/14 → 2026/04/01")).toBe("2026-03-14");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("bientôt")).toBeNull();
  });
  it("booléens et activité Instagram", () => {
    expect(parseBool("Oui")).toBe(true); expect(parseBool("No")).toBe(false); expect(parseBool("peut-être")).toBeNull();
    expect(parseIgActivity("Faible")).toBe("low"); expect(parseIgActivity("inactif")).toBe("inactive"); expect(parseIgActivity("Active")).toBe("active");
  });
  it("e-mail et site", () => {
    expect(cleanEmail("Contact@Exemple.FR ; autre@x.fr")).toBe("contact@exemple.fr");
    expect(cleanEmail("pas un mail")).toBeNull();
    expect(cleanWebsite("exemple.fr/carte")).toBe("https://exemple.fr/carte");
    expect(cleanWebsite("deux mots")).toBeNull();
  });
  it("liens Notion retirés", () => expect(stripNotionLinks("Le Port (https://www.notion.so/Le-Port-abc123?pvs=4)")).toBe("Le Port"));
});

describe("correspondance des colonnes", () => {
  it("titres français", () => {
    const m = guessMapping(["Nom du commerce", "Catégorie", "Compte Instagram", "Téléphone", "E-mail", "Remarques", "Colonne inutile"]);
    expect(m).toEqual({ 0: "name", 1: "category", 2: "instagram", 3: "phone", 4: "email", 5: "highlights", 6: "" });
  });
  it("titres Notion anglais, chaque champ une seule fois", () => {
    const m = guessMapping(["Name", "Tags", "Instagram", "Phone", "Website", "Created time", "Notes"]);
    expect(m).toMatchObject({ 0: "name", 1: "tags", 2: "instagram", 3: "phone", 4: "website", 6: "highlights" });
    expect(Object.values(m).filter((k) => k === "name")).toHaveLength(1);
  });
});

describe("construction des lignes", () => {
  const existing = demoProspects().map((p, i) => ({ ...p, id: `p${i}` }));
  const ctx = (over: Partial<ImportContext> = {}): ImportContext => ({
    origin: "csv", categories: DEMO_REFERENCE.categories, tags: DEMO_REFERENCE.tags, stages: DEMO_REFERENCE.stages, existing,
    defaultCategoryId: null, stageId: DEMO_REFERENCE.stages[0].id, ...over,
  });
  const map = { 0: "name", 1: "category", 2: "instagram", 3: "phone", 4: "opened_on" } as const;

  it("nouveaux, doublons de la base, doublons du fichier, lignes sans nom", () => {
    const rows = buildRows([
      ["Nom", "Catégorie", "Instagram", "Tél", "Ouverture"],
      ["Chez Nouvelle Table", "Restaurant", "https://instagram.com/nouvelle.table", "02 35 00 00 01", "01/09/2026"],
      ["Autre nom", "", "@demo.ilfaro", "", ""],              // même Instagram qu'une fiche existante
      ["Pizzeria Il Faro", "", "", "", ""],                    // même nom
      ["Nouvelle Table", "", "@nouvelle.table", "", ""],       // même Instagram qu'une ligne plus haut
      ["", "", "", "", ""],                                    // rien
      ["", "", "@juste.insta", "", ""],                        // nom tiré du compte
    ], map, ctx());
    expect(rows.map((r) => r.status)).toEqual(["new", "duplicate", "duplicate", "duplicate", "invalid", "new"]);
    expect(rows[0].input).toMatchObject({ name: "Chez Nouvelle Table", instagram: "@nouvelle.table", opened_on: "2026-09-01", source: "Import CSV" });
    expect(rows[0].input!.category_id).toBe(DEMO_REFERENCE.categories.find((c) => c.name === "Restaurant")?.id);
    expect(rows[1].match).toMatchObject({ inFile: false, reason: "instagram" });
    expect(rows[3].match).toMatchObject({ inFile: true });
    expect(rows[5].input!.name).toBe("juste.insta");
  });
  it("valeurs invalides ignorées avec avertissement, catégorie inconnue → défaut", () => {
    const def = DEMO_REFERENCE.categories[0].id;
    const [r] = buildRows([["Nom", "Catégorie", "Instagram", "Tél", "Ouverture"], ["Test Place", "Inconnue", "pas un compte!", "12", "demain"]], map, ctx({ defaultCategoryId: def, origin: "notion" }));
    expect(r.status).toBe("new");
    expect(r.input!.category_id).toBe(def);
    expect(r.input!.source).toBe("Import Notion");
    expect(r.warnings).toHaveLength(4);
  });
});

describe("score", () => {
  const cats = DEMO_REFERENCE.categories;
  const prio = cats.find((c) => c.is_priority)!;
  const base = { opened_on: null, ig_activity: null, instagram: null, is_independent: true, category_id: null, email: null, phone: null } as const;
  it("0 à 100, ramené au total des critères actifs", () => {
    const best = computeScore({ ...base, opened_on: "2026-08-01", ig_activity: "inactive", instagram: "@x", category_id: prio.id }, DEFAULT_SCORE_RULES, cats, "2026-11-26");
    expect(best.score).toBe(100);
    const worst = computeScore({ ...base, is_independent: false, ig_activity: "active", instagram: "@x", opened_on: "2015-01-01" }, DEFAULT_SCORE_RULES, cats, "2026-11-26");
    expect(worst.score).toBe(15); // seul « joignable » rapporte
  });
  it("ouverture : N mois = tout, 2N = moitié", () => {
    const at = (d: string) => computeScore({ ...base, opened_on: d }, [{ ...DEFAULT_SCORE_RULES[0], weight: 100 }], cats, "2026-11-26").score;
    expect(at("2026-01-15")).toBe(100); expect(at("2025-03-01")).toBe(50); expect(at("2023-01-01")).toBe(0);
  });
  it("critère désactivé ou poids nul : ignoré ; aucun critère : 0", () => {
    const off = DEFAULT_SCORE_RULES.map((r) => ({ ...r, is_active: r.key === "independent" }));
    expect(computeScore(base, off, cats, "2026-11-26").score).toBe(100);
    expect(computeScore(base, off.map((r) => ({ ...r, is_active: false })), cats, "2026-11-26").score).toBe(0);
  });
  it("fusion avec les critères de départ", () => {
    const m = mergeRules([{ key: "independent", label: "x", weight: 5, is_active: false, params: {} }]);
    expect(m).toHaveLength(5);
    expect(m.find((r) => r.key === "independent")).toMatchObject({ weight: 5, is_active: false, label: "Établissement indépendant" });
  });
});

describe("export Notion : tous les champs de la fiche", () => {
  const headers = ["Nom", "Activité", "Adresse", "Téléphone", "Site web", "Contact principal", "Poste du contact principal", "Coordonnées", "Statut Notion", "Created time"];
  const base: Omit<ImportContext, "origin"> = { categories: DEMO_REFERENCE.categories, tags: DEMO_REFERENCE.tags, stages: DEMO_REFERENCE.stages, existing: [], defaultCategoryId: null, stageId: DEMO_REFERENCE.stages[0].id };

  it("devine toutes les colonnes, y compris poste et contact principal", () => {
    const m = guessMapping(headers);
    expect(m).toMatchObject({ 0: "name", 1: "activity", 2: "address", 3: "phone", 4: "website", 5: "contact_name", 6: "contact_role", 7: "coordinates", 8: "", 9: "" });
  });

  it("importe adresse, téléphone, site, contact (prénom/nom), poste, activité, coordonnées", () => {
    const m = guessMapping(headers);
    const [r] = buildRows([headers, ["Chez Marie (https://www.notion.so/abc)", "Restaurant de quartier", "12 rue Eau-de-Robec, 76000 Rouen", "02 35 00 00 00", "chezmarie.fr", "Marie Dupont", "Gérante", "marie@chezmarie.fr, 06 12 34 56 78, 49.4431, 1.0993", "Chaud", "2026-01-01"]], m, { ...base, origin: "notion" });
    expect(r.status).toBe("new");
    expect(r.input).toMatchObject({
      name: "Chez Marie", activity: "Restaurant de quartier", address: "12 rue Eau-de-Robec, 76000 Rouen", website: "https://chezmarie.fr",
      contact_first_name: "Marie", contact_last_name: "Dupont", contact_role: "Gérante", email: "marie@chezmarie.fr", lat: 49.4431, lng: 1.0993,
    });
    expect(r.input!.phone).toContain("02");
    expect(r.input!.category_id).toBe(DEMO_REFERENCE.categories.find((c) => c.name === "Restaurant")!.id); // deviné d'après l'activité
  });

  it("une colonne non reconnue peut être conservée dans les notes avec son titre", () => {
    const m = { ...guessMapping(headers), 8: "extra" as const };
    const [r] = buildRows([headers, ["Test", "", "", "", "", "", "", "", "Chaud", ""]], m, { ...base, origin: "notion" });
    expect(r.input!.highlights).toBe("Statut Notion : Chaud");
  });

  it("catégorie inconnue : le texte est gardé dans l'activité", () => {
    const [r] = buildRows([["Nom", "Catégorie"], ["Test", "Cave à cigares"]], { 0: "name", 1: "category" }, { ...base, origin: "csv" });
    expect(r.input!.activity).toBe("Cave à cigares");
    expect(r.warnings.join(" ")).toContain("gardé");
  });
});
