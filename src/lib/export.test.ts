import { describe, expect, it } from "vitest";
import { cell, prospectsExport, toCsv, weekReport } from "./export";
import type { Activity, Category, Prospect, Stage } from "./types";

describe("CSV", () => {
  it("échappe guillemets, points-virgules et sauts de ligne", () => {
    expect(cell('Il a dit "oui"; ok')).toBe('"Il a dit ""oui""; ok"');
    expect(cell("a\nb")).toBe('"a\nb"');
    expect(cell(null)).toBe(""); expect(cell(42)).toBe("42");
  });
  it("neutralise les formules mais garde les nombres négatifs", () => {
    expect(cell("=1+1")).toBe("'=1+1"); expect(cell("@SUM(A1)")).toBe("'@SUM(A1)"); expect(cell("+33 6 12")).toBe("'+33 6 12");
    expect(cell("-5")).toBe("-5"); expect(cell(-5)).toBe("-5");
  });
  it("BOM et fins de ligne Windows", () => { expect(toCsv([["a", "b"], ["c", "d"]])).toBe("﻿a;b\r\nc;d\r\n"); });
});

describe("exports", () => {
  const cats: Category[] = [{ id: "c1", name: "Café", default_tone: "tu", is_priority: false, position: 1 }];
  const stages: Stage[] = [{ id: "s1", name: "À contacter", position: 1, kind: "open", color: "#000" }];
  const ps = [{ id: "p1", name: "Café Test", category_id: "c1", stage_id: "s1", heat: "warm", score: 55, tag_ids: [], est_amount_cents: 9050, district: "rive_droite", created_at: "2026-11-01T10:00:00Z", archived_at: null, phone: "+33 6 11 22 33 44" },
    { id: "p2", name: "Archivé", stage_id: "s1", heat: "cold", tag_ids: [], archived_at: "2026-11-02T00:00:00Z", created_at: "2026-11-01T10:00:00Z" }] as unknown as Prospect[];
  it("journal de la semaine : seulement les 7 derniers jours, dans l'ordre", () => {
    const acts: Activity[] = [
      { id: "1", prospect_id: "p1", kind: "message", channel: "instagram", body: "Premier message", author_id: null, created_at: "2026-11-25T09:30:00Z" },
      { id: "2", prospect_id: "p1", kind: "reply", channel: null, body: null, author_id: null, created_at: "2026-11-26T09:30:00Z" },
      { id: "3", prospect_id: "p1", kind: "note", channel: null, body: "trop vieux", author_id: null, created_at: "2026-11-01T09:30:00Z" },
    ];
    const lines = weekReport(acts, ps, cats, 7, new Date("2026-11-26T12:00:00Z")).trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Café Test"); expect(lines[1]).toContain("Instagram"); expect(lines[1]).toContain("Premier message");
    expect(lines.join()).not.toContain("trop vieux");
  });
  it("export des fiches : sans les archivées, montant en euros, téléphone protégé", () => {
    const lines = prospectsExport(ps, stages, cats, []).trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Café Test;Café;À contacter;Tiède;55");
    expect(lines[1]).toContain("90,50");
    expect(lines[1]).toContain("'+33 6 11 22 33 44");
    expect(lines[1]).toContain("Rive droite");
  });
});
