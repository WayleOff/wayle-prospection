import { normText } from "./normalize";
import { parseDate } from "./import";
import type { InvoiceInput, InvoiceKind, Prospect } from "./types";

/** Champs d'une facture que peut alimenter une colonne du fichier (export Shine ou tout autre CSV). */
export const INVOICE_FIELDS = [
  { key: "number", label: "Numéro de facture", words: ["numero de facture", "numero facture", "facture", "n facture", "numero", "n", "reference", "ref", "invoice number", "invoice", "number"] },
  { key: "client", label: "Client", words: ["client", "nom du client", "client nom", "destinataire", "customer", "raison sociale", "nom"] },
  { key: "paid_on", label: "Date de paiement", words: ["date de paiement", "date paiement", "paiement", "paye le", "payee le", "date de reglement", "reglement", "paid on", "payment date", "date d encaissement"] },
  { key: "issued_on", label: "Date d’émission", words: ["date d emission", "date emission", "emission", "emise le", "date de facture", "date facture", "date", "issue date", "issued on"] },
  { key: "total_ht", label: "Montant HT", words: ["total ht", "montant ht", "net ht", "ht", "hors taxe", "hors taxes", "subtotal"] },
  { key: "vat", label: "TVA", words: ["tva", "montant tva", "total tva", "vat", "taxe"] },
  { key: "total", label: "Montant TTC", words: ["total ttc", "montant ttc", "net a payer", "ttc", "total", "montant", "amount", "total amount"] },
  { key: "status", label: "Statut (payée / impayée)", words: ["statut", "status", "etat", "paye", "payee", "paid"] },
] as const;
export type InvoiceFieldKey = (typeof INVOICE_FIELDS)[number]["key"];
export type InvoiceMapping = Record<number, InvoiceFieldKey | "">;

const norm = (s: string) => normText(s) ?? "";

/** Propose une correspondance colonne → champ d'après les titres. Chaque champ et chaque colonne servent une fois. */
export function guessInvoiceMapping(headers: string[]): InvoiceMapping {
  const mapping: InvoiceMapping = {};
  const used = new Set<string>();
  const heads = headers.map(norm);
  headers.forEach((_, i) => { mapping[i] = ""; });
  const assign = (i: number, key: InvoiceFieldKey) => { mapping[i] = key; used.add(key); };
  for (const f of INVOICE_FIELDS) {
    const i = heads.findIndex((h, idx) => !mapping[idx] && f.words.some((w) => norm(w) === h));
    if (i >= 0 && !used.has(f.key)) assign(i, f.key);
  }
  for (const f of INVOICE_FIELDS) {
    if (used.has(f.key)) continue;
    const i = heads.findIndex((h, idx) => !mapping[idx] && f.words.some((w) => norm(w).length >= 4 && (` ${h} `).includes(` ${norm(w)} `)));
    if (i >= 0) assign(i, f.key);
  }
  return mapping;
}

/** Montant en centimes depuis « 1 234,56 € », « 1234.56 », « -90 », « (90,00) ». Renvoie null si ce n'est pas un montant. */
export function parseAmount(raw: string): number | null {
  let t = raw.replace(/[\s  ]/g, "").replace(/[€$£]|eur(os)?$/gi, "");
  if (!t || t === "-") return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (t.startsWith("-") || t.startsWith("−")) { neg = !neg; t = t.slice(1); }
  if (t.startsWith("+")) t = t.slice(1);
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  const lastComma = t.lastIndexOf(","), lastDot = t.lastIndexOf(".");
  let decimalAt = -1;
  if (lastComma >= 0 && lastDot >= 0) decimalAt = Math.max(lastComma, lastDot);
  else {
    const sep = lastComma >= 0 ? "," : lastDot >= 0 ? "." : "";
    const at = Math.max(lastComma, lastDot);
    // Un séparateur seul : décimal s'il n'apparaît qu'une fois et n'est pas suivi de 3 chiffres (« 1,234 » se lit 1234).
    if (sep && t.split(sep).length === 2 && t.length - at - 1 !== 3) decimalAt = at;
  }
  const intPart = (decimalAt >= 0 ? t.slice(0, decimalAt) : t).replace(/[.,]/g, "");
  const frac = decimalAt >= 0 ? t.slice(decimalAt + 1) : "";
  if (!/^\d*$/.test(intPart) || !/^\d{0,2}$/.test(frac)) return null;
  const cents = Number(intPart || "0") * 100 + Number(frac.padEnd(2, "0") || "0");
  return neg ? -cents : cents;
}

const LEGAL = /\b(sarl|sas|sasu|eurl|sa|sci|snc|ei|eirl|ets|etablissements?|societe|ste|monsieur|madame|mme|mr|m)\b/g;
/** Nom de client prêt à comparer : sans accents, majuscules, formes juridiques ni ponctuation. */
export const clientKey = (s: string) => norm(s).replace(LEGAL, " ").replace(/\s+/g, " ").trim();

/** Prospect dont le nom est celui du client (comparaison stricte, après nettoyage). Plusieurs candidats ou aucun : null. */
export function matchProspect(client: string, prospects: Pick<Prospect, "id" | "name">[]): string | null {
  const key = clientKey(client);
  if (!key) return null;
  const hits = prospects.filter((p) => clientKey(p.name) === key);
  return hits.length === 1 ? hits[0].id : null;
}

export type InvoiceRowStatus = "new" | "duplicate" | "invalid";
export interface InvoiceImportRow {
  line: number; // numéro de ligne dans le fichier (1 = titres)
  status: InvoiceRowStatus;
  reason?: string;
  input?: InvoiceInput;
  matched: boolean;
}

const PAID = /^(paye|payee|payes|payees|paid|regle|reglee|oui|yes|encaisse|encaissee)$/;
const UNPAID = /^(impaye|impayee|impayes|impayees|unpaid|non paye|non payee|en attente|a payer|non|no|en retard|retard|brouillon)$/;

export interface InvoiceContext { existingNumbers: Iterable<string>; prospects: Pick<Prospect, "id" | "name">[]; source?: string }

export function buildInvoiceRows(table: string[][], mapping: InvoiceMapping, ctx: InvoiceContext): InvoiceImportRow[] {
  const col = new Map<InvoiceFieldKey, number>();
  for (const [i, k] of Object.entries(mapping)) if (k) col.set(k, Number(i));
  const seen = new Set<string>(Array.from(ctx.existingNumbers, (n) => n.trim().toLowerCase()));
  const out: InvoiceImportRow[] = [];
  table.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    if (cells.every((c) => !c.trim())) return;
    const get = (k: InvoiceFieldKey) => (col.has(k) ? (cells[col.get(k)!] ?? "").trim() : "");
    const bad = (reason: string): void => { out.push({ line, status: "invalid", reason, matched: false }); };

    const number = get("number");
    if (!number) return bad("pas de numéro de facture");
    const key = number.toLowerCase();
    if (seen.has(key)) { out.push({ line, status: "duplicate", reason: `la facture ${number} existe déjà`, matched: false }); return; }

    const ht = col.has("total_ht") && get("total_ht") ? parseAmount(get("total_ht")) : null;
    const vat = col.has("vat") && get("vat") ? parseAmount(get("vat")) : null;
    let total = col.has("total") && get("total") ? parseAmount(get("total")) : null;
    if (total == null && ht != null) total = ht + (vat ?? 0);
    if (total == null) return bad(get("total") || get("total_ht") ? "montant illisible" : "pas de montant");

    const issued = get("issued_on") ? parseDate(get("issued_on")) : null;
    let paid: string | null = null;
    const paidRaw = get("paid_on");
    if (paidRaw && paidRaw !== "-" && paidRaw !== "—") paid = parseDate(paidRaw);
    const st = norm(get("status"));
    if (st) {
      if (UNPAID.test(st) || /^non /.test(st)) paid = null;
      else if (PAID.test(st) && !paid) paid = issued;
    }
    const kind: InvoiceKind = total < 0 || /\bavoir\b/i.test(number) ? "credit" : /acompte/i.test(number) ? "deposit" : "invoice";
    const client = get("client") || "Client inconnu";
    const prospect_id = matchProspect(client, ctx.prospects);
    seen.add(key);
    out.push({
      line, status: "new", matched: prospect_id != null,
      input: { number, prospect_id, client_name: client, issued_on: issued, paid_on: paid, total_ht_cents: ht ?? (vat != null ? total - vat : null), vat_cents: vat, total_cents: total, kind, source: ctx.source ?? "Shine" },
    });
  });
  return out;
}

export interface InvoiceStats { billed: number; paid: number; unpaid: number; count: number; unpaidCount: number }
export function invoiceStats(list: { total_cents: number; paid_on: string | null }[]): InvoiceStats {
  let billed = 0, paid = 0, unpaidCount = 0;
  for (const i of list) { billed += i.total_cents; if (i.paid_on) paid += i.total_cents; else unpaidCount++; }
  return { billed, paid, unpaid: billed - paid, count: list.length, unpaidCount };
}
