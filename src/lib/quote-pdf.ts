import type { Company, Logo, Prospect, Quote } from "./types";
import { depositSplit, fmtDateFr, fmtMoney, lineTotal, totals } from "./quote";
import { logoBytes } from "./logo";

const W = 595.28, H = 841.89, M = 48; // A4 en points, marges
const FOOT = 56; // place réservée au pied de page

/** Génère le PDF du devis (A4). pdf-lib est chargé à la demande : il ne pèse pas sur le reste de l'application. */
export async function buildQuotePdf(quote: Quote, prospect: Pick<Prospect, "name" | "contact_first_name" | "contact_last_name" | "address" | "email" | "phone">, company: Company, logo: Logo | null = null): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const charset = new Set(reg.getCharacterSet());
  const ink = rgb(0.09, 0.09, 0.1), muted = rgb(0.42, 0.42, 0.45), line = rgb(0.86, 0.86, 0.88), accent = rgb(0.81, 0.25, 0.09);

  // Les polices standard ne contiennent pas tous les caractères : on remplace l'inconnu plutôt que de planter.
  const clean = (t: string) => Array.from(t.replace(/[  ]/g, " ").replace(/[\r\n\t]+/g, " "))
    .map((c) => (charset.has(c.codePointAt(0)!) ? c : c === "→" ? "->" : "?")).join("");
  const width = (t: string, size: number, f = reg) => f.widthOfTextAtSize(clean(t), size);
  const wrap = (t: string, size: number, max: number, f = reg): string[] => {
    const out: string[] = [];
    for (const para of t.split(/\r?\n/)) {
      let cur = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = cur ? `${cur} ${word}` : word;
        if (width(next, size, f) <= max) cur = next;
        else { if (cur) out.push(cur); cur = word; }
      }
      out.push(cur);
    }
    return out;
  };

  let page = doc.addPage([W, H]);
  const pages = [page];
  let y = H - M;
  const text = (t: string, x: number, size = 10, f = reg, color = ink) => page.drawText(clean(t), { x, y, size, font: f, color });
  const textRight = (t: string, xRight: number, size = 10, f = reg, color = ink) => page.drawText(clean(t), { x: xRight - width(t, size, f), y, size, font: f, color });
  const rule = (yy: number, color = line, thickness = 0.7) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness, color });

  // ── En-tête : entreprise à gauche, devis à droite
  const top = y;
  const png = logoBytes(logo);
  if (png) {
    // Logo en haut à gauche, dans une boîte de 150 × 56 pt : on garde ses proportions.
    try {
      const img = await doc.embedPng(png);
      const k = Math.min(150 / img.width, 56 / img.height, 3);
      const w = img.width * k, h = img.height * k;
      page.drawImage(img, { x: M, y: y - h, width: w, height: h });
      y -= h + 20;
    } catch { /* logo illisible : le devis part sans */ }
  }
  text(company.name, M, 18, bold);
  y -= 18;
  for (const l of [company.owner, company.address, company.zip_city, company.phone, company.email].filter((v) => v.trim())) { text(l, M, 9, reg, muted); y -= 12.5; }
  const leftBottom = y;
  y = top;
  textRight("DEVIS", W - M, 22, bold, accent);
  y -= 20; textRight(`N° ${quote.number}`, W - M, 11, bold);
  y -= 15; textRight(`Date : ${fmtDateFr(quote.created_at)}`, W - M, 9.5, reg, muted);
  if (quote.valid_until) { y -= 13; textRight(`Valable jusqu’au ${fmtDateFr(quote.valid_until)}`, W - M, 9.5, reg, muted); }
  y = Math.min(leftBottom, y) - 12;
  rule(y, accent, 1.5);

  // ── Destinataire
  y -= 28;
  text("DESTINATAIRE", M, 8, bold, muted);
  y -= 15; text(prospect.name, M, 12, bold);
  const contact = [prospect.contact_first_name, prospect.contact_last_name].filter(Boolean).join(" ");
  for (const l of [contact && `À l’attention de ${contact}`, prospect.address, prospect.email].filter((v): v is string => !!v)) { y -= 13; text(l, M, 9.5, reg, muted); }
  y -= 30;

  // ── Tableau
  const colQty = W - M - 200, colUnit = W - M - 100, colTot = W - M;
  const header = () => {
    rule(y + 14);
    text("Désignation", M, 8.5, bold, muted);
    textRight("Qté", colQty + 30, 8.5, bold, muted);
    textRight("Prix unitaire", colUnit + 15, 8.5, bold, muted);
    textRight("Total", colTot, 8.5, bold, muted);
    y -= 8; rule(y); y -= 16;
  };
  const newPage = () => { page = doc.addPage([W, H]); pages.push(page); y = H - M; };
  header();
  const labelMax = colQty - M - 30;
  for (const l of quote.lines) {
    const labelLines = wrap(l.label, 10.5, labelMax, bold);
    const descLines = l.description.trim() ? wrap(l.description, 9, labelMax) : [];
    const need = labelLines.length * 13 + descLines.length * 11.5 + 14;
    if (y - need < M + FOOT) { newPage(); header(); }
    const rowTop = y;
    for (const t of labelLines) { text(t, M, 10.5, bold); y -= 13; }
    for (const t of descLines) { text(t, M, 9, reg, muted); y -= 11.5; }
    const after = y;
    y = rowTop;
    textRight(String(+l.qty.toFixed(2)).replace(".", ","), colQty + 30, 10);
    textRight(fmtMoney(l.unit_cents) + (l.recurring ? " /mois" : ""), colUnit + 15, 10);
    textRight(fmtMoney(lineTotal(l)) + (l.recurring ? " /mois" : ""), colTot, 10, bold);
    y = after - 6;
    rule(y + 2); y -= 14;
  }

  // ── Totaux
  const t = totals(quote.lines);
  const both = t.oneTime !== 0 && t.monthly !== 0;
  const rows: [string, string, boolean][] = both
    ? [["Total ponctuel", fmtMoney(t.oneTime), true], ["Abonnement mensuel", `${fmtMoney(t.monthly)} /mois`, true]]
    : t.monthly !== 0 ? [["Total mensuel", `${fmtMoney(t.monthly)} /mois`, true]] : [["Total", fmtMoney(t.oneTime), true]];
  if (y - rows.length * 22 - 150 < M + FOOT) { newPage(); }
  y -= 4;
  for (const [label, value] of rows) {
    textRight(label, colUnit + 15, 10.5, bold);
    textRight(value, colTot, 13, bold, accent);
    y -= 21;
  }
  const split = depositSplit(quote.lines, quote.deposit_percent);
  if (split) {
    textRight(`Acompte à la commande (${quote.deposit_percent} %)`, colUnit + 15, 10, reg, muted);
    textRight(fmtMoney(split.deposit), colTot, 10.5, bold);
    y -= 16;
    textRight("Solde à la livraison", colUnit + 15, 10, reg, muted);
    textRight(fmtMoney(split.balance), colTot, 10.5, bold);
    y -= 18;
  }
  if (company.vat_mention.trim()) { textRight(company.vat_mention, colTot, 8.5, reg, muted); y -= 20; } else y -= 8;

  // ── Notes, conditions, accord
  const block = (title: string, body: string) => {
    const lines = wrap(body, 9.5, W - 2 * M);
    if (y - 20 - lines.length * 12.5 < M + FOOT) newPage();
    text(title.toUpperCase(), M, 8, bold, muted); y -= 14;
    for (const l of lines) { text(l, M, 9.5); y -= 12.5; }
    y -= 10;
  };
  if (quote.notes?.trim()) block("Remarques", quote.notes.trim());
  block("Conditions", [
    split ? `Acompte de ${quote.deposit_percent} % (${fmtMoney(split.deposit)}) à régler à la commande ; solde de ${fmtMoney(split.balance)} à la livraison.` : "",
    company.payment_terms.trim(), quote.valid_until ? `Devis valable jusqu’au ${fmtDateFr(quote.valid_until)}.` : ""].filter(Boolean).join("\n"));

  const boxH = 74;
  if (y - boxH - 30 < M + FOOT) newPage();
  y -= 6;
  text("BON POUR ACCORD", M, 8, bold, muted);
  y -= 8;
  page.drawRectangle({ x: M, y: y - boxH, width: W - 2 * M, height: boxH, borderColor: line, borderWidth: 0.8 });
  y -= 15; text("Date, signature précédée de la mention « Bon pour accord »", M + 10, 9, reg, muted);

  // ── Pied de page sur chaque page
  const foot = [company.name, company.siret.trim() ? `SIRET ${company.siret.trim()}` : "", company.phone, company.email].filter((v) => v.trim()).join("  ·  ");
  pages.forEach((p, i) => {
    page = p;
    y = M - 14;
    p.drawLine({ start: { x: M, y: M + 4 }, end: { x: W - M, y: M + 4 }, thickness: 0.5, color: line });
    text(foot, M, 8, reg, muted);
    textRight(`Page ${i + 1}/${pages.length}`, W - M, 8, reg, muted);
  });

  doc.setTitle(`Devis ${quote.number}`);
  doc.setAuthor(company.name);
  doc.setCreator("Wayle Prospection");
  return doc.save();
}
