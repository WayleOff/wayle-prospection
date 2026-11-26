import { describe, expect, it } from "vitest";
import { buildInvoiceRows, clientKey, guessInvoiceMapping, invoiceStats, matchProspect, parseAmount } from "./invoice-import";

describe("montants", () => {
  it("formats français et anglais", () => {
    expect(parseAmount("90")).toBe(9000); expect(parseAmount("90,5")).toBe(9050); expect(parseAmount("90,50 €")).toBe(9050);
    expect(parseAmount("1 234,56 €")).toBe(123456); expect(parseAmount("1 234,56 €")).toBe(123456);
    expect(parseAmount("1,234.56")).toBe(123456); expect(parseAmount("1.234,56")).toBe(123456); expect(parseAmount("1234.5")).toBe(123450);
    expect(parseAmount("1.234")).toBe(123400); expect(parseAmount("-90")).toBe(-9000); expect(parseAmount("(90,00)")).toBe(-9000);
  });
  it("refuse ce qui n'est pas un montant", () => {
    for (const v of ["", "-", "abc", "12 abc", "1,2,3x", "90,5555"]) expect(parseAmount(v)).toBeNull();
  });
});

describe("colonnes", () => {
  it("reconnaît les titres d'un rapport de ventes", () => {
    const m = guessInvoiceMapping(["Numéro de facture", "Date d'émission", "Client", "Date de paiement", "TVA", "Total HT", "Total TTC"]);
    expect(Object.values(m)).toEqual(["number", "issued_on", "client", "paid_on", "vat", "total_ht", "total"]);
  });
  it("titres simples", () => {
    const m = guessInvoiceMapping(["Date", "Nom", "Facture", "Montant", "Statut"]);
    expect(Object.values(m)).toEqual(["issued_on", "client", "number", "total", "status"]);
  });
});

describe("clients", () => {
  it("compare sans accents ni forme juridique", () => {
    expect(clientKey("SARL Café  de l’Église")).toBe(clientKey("cafe de l eglise"));
    const ps = [{ id: "a", name: "Café de l’Église" }, { id: "b", name: "Boulangerie Paul" }, { id: "c", name: "Boulangerie Paul" }];
    expect(matchProspect("SARL Cafe de l'Eglise", ps)).toBe("a");
    expect(matchProspect("Boulangerie Paul", ps)).toBeNull(); // deux fiches : on ne devine pas
    expect(matchProspect("Inconnu", ps)).toBeNull();
  });
});

describe("lignes", () => {
  const table = [
    ["Numéro de facture", "Date d'émission", "Client", "Date de paiement", "TVA", "Total HT", "Total TTC"],
    ["F-2026-001", "12/10/2026", "Café de l'Église", "20/10/2026", "0", "450,00", "450,00"],
    ["F-2026-002", "03/11/2026", "Boulangerie Paul", "-", "", "300,00", "300,00"],
    ["F-2026-001", "05/11/2026", "Doublon dans le fichier", "", "", "10", "10"],
    ["F-2026-003", "05/11/2026", "Client X", "", "", "", ""],
    ["", "05/11/2026", "Client Y", "", "", "10", "10"],
    ["AV-2026-001", "06/11/2026", "Café de l'Église", "", "", "-50", "-50"],
    ["F-OLD-1", "06/11/2026", "Ancien", "", "", "10", "10"],
    ["", "", "", "", "", "", ""],
  ];
  const rows = buildInvoiceRows(table, guessInvoiceMapping(table[0]), { existingNumbers: ["F-OLD-1"], prospects: [{ id: "a", name: "Café de l’Église" }] });
  it("classe chaque ligne", () => {
    expect(rows.map((r) => r.status)).toEqual(["new", "new", "duplicate", "invalid", "invalid", "new", "duplicate"]);
    expect(rows[3].reason).toBe("pas de montant"); expect(rows[4].reason).toBe("pas de numéro de facture");
  });
  it("lit les montants, dates et paiements", () => {
    expect(rows[0].input).toMatchObject({ number: "F-2026-001", issued_on: "2026-10-12", paid_on: "2026-10-20", total_cents: 45000, total_ht_cents: 45000, vat_cents: 0, prospect_id: "a", kind: "invoice", source: "Shine" });
    expect(rows[1].input).toMatchObject({ paid_on: null, prospect_id: null, total_cents: 30000 });
    expect(rows[5].input).toMatchObject({ kind: "credit", total_cents: -5000 });
    expect(rows[0].matched).toBe(true); expect(rows[1].matched).toBe(false);
  });
  it("statut sans date de paiement", () => {
    const t = [["Facture", "Date", "Client", "Montant", "Statut"], ["F1", "01/10/2026", "A", "10", "Payée"], ["F2", "01/10/2026", "B", "10", "Impayée"]];
    const r = buildInvoiceRows(t, guessInvoiceMapping(t[0]), { existingNumbers: [], prospects: [] });
    expect(r.map((x) => x.input!.paid_on)).toEqual(["2026-10-01", null]);
  });
  it("totaux", () => {
    const s = invoiceStats(rows.filter((r) => r.input).map((r) => r.input!));
    expect(s).toEqual({ billed: 45000 + 30000 - 5000, paid: 45000, unpaid: 25000, count: 3, unpaidCount: 2 });
  });
});
