import { parseAmount } from "./invoice-import";
import { parseDate } from "./import";

/** Ce qu'on a pu lire dans une facture PDF. Tout est du texte : l'écran de vérification permet de corriger avant l'import. */
export interface PdfInvoice {
  file: string;
  number: string;
  client: string;
  issued: string; // AAAA-MM-JJ ou ""
  paid: string;   // AAAA-MM-JJ ou ""
  ht: string;     // « 1234,50 » ou ""
  vat: string;
  total: string;
  /** Points à vérifier en priorité (affichés à côté de la ligne). */
  warnings: string[];
  /** Début du texte lu, pour comprendre une extraction ratée. */
  text: string;
}

const DATE = String.raw`(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:janv(?:ier)?|f[ée]vr(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?)\.?\s+\d{4})`;
const MONEY = String.raw`(-?\s?\d[\d\s  .]*[.,]\d{2}|-?\s?\d[\d\s  ]*)\s*(?:€|eur(?:os)?)?`;

const MONTHS: Record<string, string> = { janv: "01", janvier: "01", fevr: "02", fevrier: "02", mars: "03", avr: "04", avril: "04", mai: "05", juin: "06", juil: "07", juillet: "07", aout: "08", sept: "09", septembre: "09", oct: "10", octobre: "10", nov: "11", novembre: "11", dec: "12", decembre: "12" };

/** « 12/11/2026 », « 12 novembre 2026 », « 2026-11-12 » → « 2026-11-12 » (ou null). */
export function toIsoDate(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  const m = t.match(/^(\d{1,2})\s+([a-zéûè]+)\.?\s+(\d{4})$/);
  if (m) {
    const key = m[2].normalize("NFD").replace(/[̀-ͯ]/g, "");
    const mm = MONTHS[key] ?? MONTHS[key.slice(0, 4)] ?? MONTHS[key.slice(0, 3)];
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
  }
  return parseDate(raw);
}

const cents = (raw: string | undefined): number | null => (raw ? parseAmount(raw.replace(/\s+/g, " ").trim()) : null);
const euros = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

/** Dernier montant d'une ligne (les libellés viennent avant, le chiffre à droite). */
function lastAmount(line: string): number | null {
  const found = [...line.matchAll(new RegExp(MONEY, "gi"))].map((m) => m[0]).filter((s) => /[.,]\d{2}/.test(s) || /€/.test(s));
  return found.length ? cents(found[found.length - 1]) : null;
}

/** Cherche un libellé puis renvoie le montant de la même ligne, ou celui de la ligne suivante. */
function amountAfter(lines: string[], label: RegExp): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue;
    const rest = lines[i].replace(label, " ");
    const a = lastAmount(rest) ?? (i + 1 < lines.length ? lastAmount(lines[i + 1]) : null);
    if (a != null) return a;
  }
  return null;
}

function dateAfter(lines: string[], label: RegExp): string | null {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(label);
    if (!m) continue;
    const after = lines[i].slice((m.index ?? 0) + m[0].length);
    const d = after.match(new RegExp(DATE, "i")) ?? (lines[i + 1] ?? "").match(new RegExp(DATE, "i"));
    if (d) { const iso = toIsoDate(d[1]); if (iso) return iso; }
  }
  return null;
}

const NOT_A_NUMBER = /^(?:du|de|le|la|n|no|nº|n°|num[eé]ro|date|client|total|emise?|[eé]mise|pour|ci|jointe?|ref|r[eé]f[eé]rence)$/i;

export function findNumber(lines: string[], fileName: string): string {
  const ID = String.raw`([A-Z0-9][A-Z0-9\-\/_.]*\d[A-Z0-9\-\/_.]*)`;
  const patterns = [
    new RegExp(String.raw`(?:facture|invoice|avoir)\s*(?:d['’]acompte)?\s*(?:n(?:°|º|o\.?|um(?:[ée]ro)?\.?)|#)\s*:?\s*${ID}`, "i"),
    new RegExp(String.raw`num[ée]ro\s+(?:de\s+)?(?:facture|avoir)\s*:?\s*${ID}`, "i"),
    new RegExp(String.raw`(?:facture|invoice|avoir)\s*:?\s*${ID}`, "i"),
    new RegExp(String.raw`\bn(?:°|º)\s*:?\s*${ID}`, "i"),
  ];
  for (const re of patterns) {
    for (const line of lines.slice(0, 40)) {
      const m = line.match(re);
      if (m && !NOT_A_NUMBER.test(m[1])) return m[1].replace(/[.,;:]+$/, "");
    }
  }
  // Dernier recours : le nom du fichier (« Facture_F-2026-014.pdf », « 2026-014.pdf »).
  const base = fileName.replace(/\.pdf$/i, "");
  const f = base.match(/([A-Z]{0,4}[-_]?\d{4}[-_/]\d{1,6})/i) ?? base.match(/(\d{3,})/);
  return f ? f[1].replace(/_/g, "-") : "";
}

function findClient(lines: string[]): string {
  const label = /^(?:factur[ée]e?\s+[àa]|client|destinataire|adress[ée]e?\s+[àa]|bill\s+to|factur[ée]\s+[àa])\s*:?\s*(.*)$/i;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(label);
    if (!m) continue;
    const same = m[1].trim();
    if (same && !/^\d/.test(same)) return same.slice(0, 120);
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const c = lines[j].trim();
      if (c && !/^(?:\d|tel|t[ée]l|e-?mail|siret|tva|adresse)/i.test(c)) return c.slice(0, 120);
    }
  }
  return "";
}

/** Transforme le texte d'une facture PDF (une ligne par ligne visuelle) en champs. Heuristique : l'écran de vérification a le dernier mot. */
export function parseInvoiceText(text: string, fileName: string): PdfInvoice {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const warnings: string[] = [];
  const number = findNumber(lines, fileName);
  const client = findClient(lines);

  const issued = dateAfter(lines, /(?:date\s+d['’]?\s*[ée]mission|date\s+de\s+facturation|date\s+de\s+la\s+facture|[ée]mise?\s+le|factur[ée]e?\s+le|date\s+facture|date)\s*:?/i)
    ?? (() => { const d = text.match(new RegExp(DATE, "i")); return d ? toIsoDate(d[1]) : null; })();

  const paidText = /(?:pay[ée]e?|acquitt[ée]e?|r[ée]gl[ée]e?)\b/i;
  let paid = dateAfter(lines, /(?:date\s+(?:de\s+)?(?:paiement|r[èe]glement|encaissement)|pay[ée]e?\s+le|r[ée]gl[ée]e?\s+le|acquitt[ée]e?\s+le|paiement\s+re[çc]u\s+le)\s*:?/i);
  const looksPaid = lines.some((l) => paidText.test(l) && !/non\s+pay|impay|[àa]\s+payer|d[ée]lai\s+de\s+paiement|conditions?\s+de\s+paiement|moyens?\s+de\s+paiement|mode\s+de\s+paiement|date\s+limite|payable/i.test(l));
  if (!paid && looksPaid && issued) { paid = issued; warnings.push("payée d’après le texte, sans date : date d’émission reprise"); }

  let ht = amountAfter(lines, /^(?:sous[- ]?)?total\s+h\.?t\.?(?:\s+net)?\s*:?|montant\s+h\.?t\.?\s*:?|total\s+hors\s+taxes?\s*:?|net\s+h\.?t\.?\s*:?/i);
  let vat = amountAfter(lines, /^(?:total\s+|montant\s+)?t\.?v\.?a\.?(?:\s+\(?\d+(?:[.,]\d+)?\s*%\)?)?\s*:?/i);
  let total = amountAfter(lines, /total\s+t\.?t\.?c\.?\s*:?|montant\s+t\.?t\.?c\.?\s*:?|net\s+[àa]\s+payer\s*:?|total\s+[àa]\s+payer\s*:?|montant\s+total\s*:?|^total\s*:?/i);
  const franchise = /293\s*B|tva\s+non\s+applicable/i.test(text);
  if (franchise) vat = 0; // franchise en base : pas de TVA, quoi que dise la ligne suivante
  if (total == null && ht != null) total = ht + (vat ?? 0);
  if (ht == null && total != null && (vat != null)) ht = total - vat;
  if (franchise && ht == null && total != null) ht = total;
  if (/\bavoir\b/i.test(text.slice(0, 600)) && total != null && total > 0 && !/-\s?\d/.test(text)) {
    warnings.push("avoir : montant à passer en négatif si besoin");
  }

  if (!number) warnings.push("numéro de facture introuvable");
  if (!client) warnings.push("client introuvable");
  if (!issued) warnings.push("date d’émission introuvable");
  if (total == null) warnings.push("montant introuvable");

  return { file: fileName, number, client, issued: issued ?? "", paid: paid ?? "", ht: euros(ht), vat: euros(vat), total: euros(total), warnings, text: lines.slice(0, 60).join("\n").slice(0, 1500) };
}

/** Une ligne de tableau (mêmes titres pour tous), prête pour le circuit d'import des CSV. */
export const PDF_HEADERS = ["Numéro de facture", "Client", "Date d'émission", "Date de paiement", "Montant HT", "TVA", "Montant TTC"] as const;
export const pdfRowCells = (p: PdfInvoice): string[] => [p.number, p.client, p.issued, p.paid, p.ht, p.vat, p.total];
