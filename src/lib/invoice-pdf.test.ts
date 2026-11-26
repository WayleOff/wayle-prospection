import { describe, expect, it } from "vitest";
import { parseInvoiceText, toIsoDate } from "./invoice-pdf";

const A = `Wayle Production
Jonas Deschamps - Rouen
Facture n° F-2026-014
Date d'émission : 12/11/2026
Date d'échéance : 12/12/2026
Facturé à
Café Sous les Toits
12 rue des Carmes
76000 Rouen
Désignation Qté Prix unitaire Total
Reel Instagram 1 450,00 € 450,00 €
Total HT 450,00 €
TVA non applicable, art. 293 B du CGI
Total TTC 450,00 €
Payée le 20/11/2026`;

const B = `FACTURE
Numéro de facture : 2026-007
Date de facturation : 3 novembre 2026
Client : Maison Delaunay Traiteur
Sous-total HT 1 200,00 €
TVA 20 % 240,00 €
Net à payer 1 440,00 €
Conditions de paiement : 30 jours`;

const C = `Facture d'acompte N° AC-2026-003
Émise le 05/10/2026
Destinataire
SARL Garage Pop & Roule
Total 300,00 €
TVA non applicable - article 293 B du CGI`;

describe("parseInvoiceText", () => {
  it("lit une facture payée en franchise de TVA", () => {
    const p = parseInvoiceText(A, "facture.pdf");
    expect(p).toMatchObject({ number: "F-2026-014", client: "Café Sous les Toits", issued: "2026-11-12", paid: "2026-11-20", ht: "450,00", vat: "0,00", total: "450,00" });
    expect(p.warnings).toEqual([]);
  });
  it("lit une facture avec TVA, non payée, date en toutes lettres", () => {
    const p = parseInvoiceText(B, "x.pdf");
    expect(p).toMatchObject({ number: "2026-007", client: "Maison Delaunay Traiteur", issued: "2026-11-03", paid: "", ht: "1200,00", vat: "240,00", total: "1440,00" });
  });
  it("lit un acompte : client sur la ligne suivante, total seul", () => {
    const p = parseInvoiceText(C, "ac.pdf");
    expect(p).toMatchObject({ number: "AC-2026-003", client: "SARL Garage Pop & Roule", issued: "2026-10-05", total: "300,00", vat: "0,00", ht: "300,00" });
  });
  it("signale ce qui manque et retombe sur le nom du fichier", () => {
    const p = parseInvoiceText("Document\nrien d'utile", "Facture_F-2026-021.pdf");
    expect(p.number).toBe("F-2026-021");
    expect(p.warnings).toEqual(expect.arrayContaining(["client introuvable", "montant introuvable"]));
  });
  it("« conditions de paiement » ne rend pas la facture payée", () => {
    expect(parseInvoiceText(B, "x.pdf").paid).toBe("");
  });
});

describe("toIsoDate", () => {
  it.each([["12/11/2026", "2026-11-12"], ["12 novembre 2026", "2026-11-12"], ["1 août 2026", "2026-08-01"], ["2026-11-12", "2026-11-12"]])("%s", (a, b) => expect(toIsoDate(a)).toBe(b));
});
