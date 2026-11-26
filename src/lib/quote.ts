import type { Company, Offer, Quote, QuoteLine, QuoteStatus } from "./types";

export const STATUS_LABEL: Record<QuoteStatus, string> = { draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", refused: "Refusé" };
export const STATUS_ORDER: QuoteStatus[] = ["draft", "sent", "accepted", "refused"];

/** Valeurs de départ : à compléter dans Paramètres → Mon entreprise (adresse et SIRET sont obligatoires sur un devis). */
export const DEFAULT_COMPANY: Company = {
  name: "Wayle Production", owner: "Jonas Deschamps", address: "", zip_city: "Rouen", siret: "",
  phone: "07 86 85 81 14", email: "waylecorp@gmail.com",
  vat_mention: "TVA non applicable, art. 293 B du CGI", validity_days: 30,
  payment_terms: "Paiement à réception de la facture, par virement.",
};

export const mergeCompany = (stored: Partial<Company> | null): Company => ({ ...DEFAULT_COMPANY, ...(stored ?? {}) });

/** Ce qu'il manque pour que le devis soit en règle (affiché avant de générer le PDF). */
export function companyGaps(c: Company): string[] {
  const gaps: string[] = [];
  if (!c.siret.trim()) gaps.push("SIRET");
  if (!c.address.trim()) gaps.push("adresse");
  return gaps;
}

export const lineTotal = (l: QuoteLine) => Math.round(l.qty * l.unit_cents);

export function totals(lines: QuoteLine[]): { oneTime: number; monthly: number; amount: number } {
  let oneTime = 0, monthly = 0;
  for (const l of lines) { if (l.recurring) monthly += lineTotal(l); else oneTime += lineTotal(l); }
  return { oneTime, monthly, amount: oneTime + monthly };
}

/** « 1 234,50 € » : espaces insécables, centimes seulement s'il y en a. Reste dans l'alphabet des polices standard d'un PDF. */
export function fmtMoney(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${grouped}${frac ? "," + String(frac).padStart(2, "0") : ""} €`;
}

/** Saisie d'un prix en euros (« 90 », « 90,5 », « 1 200.00 ») → centimes, ou null. */
export function parseEuros(input: string): number | null {
  const v = input.replace(/[\s €]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(v)) return null;
  return Math.round(parseFloat(v) * 100);
}
export const eurosText = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ","));

/** Quantité saisie (« 2 », « 1,5 »), strictement positive. */
export function parseQty(input: string): number | null {
  const n = parseFloat(input.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 10000 ? n : null;
}

/** Prochain numéro de l'année : D-2026-001, D-2026-002… (le plus grand existant + 1). */
export function nextNumber(existing: string[], year: number): string {
  const re = new RegExp(`^D-${year}-(\\d+)$`);
  const max = existing.reduce((m, n) => Math.max(m, Number(re.exec(n)?.[1] ?? 0)), 0);
  return `D-${year}-${String(max + 1).padStart(3, "0")}`;
}

export function addDaysISO(from: string, days: number): string {
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const fmtDateFr = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };

export function lineFromOffer(o: Offer): QuoteLine {
  return { label: o.name, description: o.description ?? "", qty: 1, unit_cents: o.price_cents, recurring: o.is_recurring };
}

/** Offres de départ : seul le reel d'essai a un prix connu (≈ 90 €) ; la collaboration mensuelle est à chiffrer par Jonas. */
export const STARTER_OFFERS: Omit<Offer, "id">[] = [
  { name: "Reel d’essai", description: "Demi-journée de tournage, montage, présentation le lendemain. Achat facultatif.", price_cents: 9000, is_recurring: false, is_active: true },
];

export const quoteFileName = (q: Quote, prospectName: string) =>
  `Devis-${q.number}-${prospectName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}.pdf`;
