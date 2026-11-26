import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addDaysISO, companyGaps, DEFAULT_COMPANY, eurosText, fmtMoney, nextNumber, parseEuros, parseQty, totals } from "./quote";
import { buildQuotePdf } from "./quote-pdf";
import type { Quote, QuoteLine } from "./types";

const line = (over: Partial<QuoteLine> = {}): QuoteLine => ({ label: "Reel d’essai", description: "", qty: 1, unit_cents: 9000, recurring: false, ...over });
const quote = (lines: QuoteLine[]): Quote => ({ id: "q", number: "D-2026-001", prospect_id: "p", lines, total_cents: totals(lines).amount, status: "draft", created_at: "2026-11-26T10:00:00Z", valid_until: "2026-12-26", notes: "Tournage prévu en décembre, selon vos disponibilités." });

describe("montants", () => {
  it("format français avec espaces insécables", () => {
    expect(fmtMoney(9000)).toBe("90 €");
    expect(fmtMoney(123450)).toBe("1 234,50 €");
    expect(fmtMoney(-500)).toBe("-5 €");
    expect(fmtMoney(5)).toBe("0,05 €");
  });
  it("saisie d'un prix", () => {
    expect(parseEuros("90")).toBe(9000); expect(parseEuros("90,5")).toBe(9050); expect(parseEuros("1 200.00 €")).toBe(120000); expect(parseEuros("-10")).toBe(-1000);
    expect(parseEuros("abc")).toBeNull(); expect(parseEuros("1,234")).toBeNull();
    expect(eurosText(9050)).toBe("90,50"); expect(eurosText(9000)).toBe("90");
  });
  it("quantité", () => { expect(parseQty("1,5")).toBe(1.5); expect(parseQty("0")).toBeNull(); expect(parseQty("x")).toBeNull(); });
  it("totaux : ponctuel, mensuel, remise", () => {
    expect(totals([line(), line({ qty: 2, unit_cents: 5000 }), line({ unit_cents: -1000 }), line({ unit_cents: 30000, recurring: true })])).toEqual({ oneTime: 18000, monthly: 30000, amount: 48000 });
    expect(totals([line({ qty: 1.5, unit_cents: 3333 })]).oneTime).toBe(5000); // arrondi au centime
  });
});

describe("numérotation et dates", () => {
  it("suite par année", () => {
    expect(nextNumber([], 2026)).toBe("D-2026-001");
    expect(nextNumber(["D-2026-001", "D-2026-009", "D-2025-120"], 2026)).toBe("D-2026-010");
    expect(nextNumber(["D-2026-999"], 2027)).toBe("D-2027-001");
  });
  it("validité", () => { expect(addDaysISO("2026-11-26", 30)).toBe("2026-12-26"); expect(addDaysISO("2026-12-20", 30)).toBe("2027-01-19"); });
  it("lacunes à signaler", () => expect(companyGaps(DEFAULT_COMPANY)).toEqual(["SIRET", "adresse"]));
});

describe("PDF", () => {
  const prospect = { name: "Café Sous les Toits", contact_first_name: "Camille", contact_last_name: "Roux", address: "12 rue du Gros-Horloge, 76000 Rouen", email: "contact@exemple.fr", phone: null };
  const company = { ...DEFAULT_COMPANY, siret: "123 456 789 00012", address: "1 rue Exemple" };
  it("génère un PDF d'une page", async () => {
    const bytes = await buildQuotePdf(quote([line({ description: "Demi-journée de tournage, montage, présentation le lendemain." }), line({ label: "Collaboration mensuelle", unit_cents: 30000, recurring: true })]), prospect, company);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, bytes);
  });
  it("passe sur plusieurs pages quand il y a beaucoup de lignes, et supporte les caractères exotiques", async () => {
    const many = Array.from({ length: 40 }, (_, i) => line({ label: `Prestation n° ${i + 1} → œuvre « spéciale » ✓`, description: "Texte de description assez long pour passer à la ligne. ".repeat(3) }));
    const bytes = await buildQuotePdf(quote(many), prospect, company);
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT.replace(".pdf", "-long.pdf"), bytes);
    expect(bytes.length).toBeGreaterThan(2000);
  });
});
