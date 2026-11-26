import { ACTIVITY_LABEL, CHANNEL_LABEL, DISTRICT_LABEL, HEAT_LABEL } from "./labels";
import type { Activity, Category, Prospect, Stage, Tag } from "./types";

/** Cellule CSV : guillemets doublés, et une apostrophe devant =, +, -, @ pour qu'Excel ne l'exécute pas comme une formule (sauf un nombre). */
export function cell(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV à la française : séparateur « ; », fin de ligne CRLF, BOM UTF-8 (Excel ouvre les accents correctement). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");
const timeFr = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const euros = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

/** Journal des `days` derniers jours : une ligne par action (message, appel, visite, réponse, changement d'étape, note). */
export function weekReport(activities: Activity[], prospects: Prospect[], categories: Category[], days = 7, now = new Date()): string {
  const since = now.getTime() - days * 86400000;
  const pById = new Map(prospects.map((p) => [p.id, p]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const rows = activities.filter((a) => new Date(a.created_at).getTime() >= since).sort((a, b) => a.created_at.localeCompare(b.created_at));
  return toCsv([
    ["Date", "Heure", "Prospect", "Catégorie", "Type", "Canal", "Détail"],
    ...rows.map((a) => {
      const p = pById.get(a.prospect_id);
      return [dateFr(a.created_at), timeFr(a.created_at), p?.name ?? "(fiche supprimée)", (p?.category_id && catName.get(p.category_id)) || "", ACTIVITY_LABEL[a.kind], a.channel ? CHANNEL_LABEL[a.channel] : "", a.body ?? ""];
    }),
  ]);
}

/** Toutes les fiches actives, une ligne chacune : de quoi les rouvrir dans Excel ou les sauvegarder. */
export function prospectsExport(prospects: Prospect[], stages: Stage[], categories: Category[], tags: Tag[]): string {
  const stage = new Map(stages.map((s) => [s.id, s.name])), cat = new Map(categories.map((c) => [c.id, c.name])), tag = new Map(tags.map((t) => [t.id, t.name]));
  return toCsv([
    ["Nom", "Catégorie", "Étape", "Chaleur", "Score", "Étiquettes", "Instagram", "Téléphone", "E-mail", "Site web", "Adresse", "Quartier", "Prénom du contact", "Nom du contact", "Ouverture", "Source", "Montant estimé (€)", "Prochaine action", "Date prochaine action", "Points d’accroche", "Motif de perte", "Ne pas contacter", "Créée le"],
    ...prospects.filter((p) => !p.archived_at).sort((a, b) => a.name.localeCompare(b.name, "fr")).map((p) => [
      p.name, (p.category_id && cat.get(p.category_id)) || "", stage.get(p.stage_id) ?? "", HEAT_LABEL[p.heat], p.score, p.tag_ids.map((t) => tag.get(t)).filter(Boolean).join(", "),
      p.instagram, p.phone, p.email, p.website, p.address, p.district ? DISTRICT_LABEL[p.district] : "", p.contact_first_name, p.contact_last_name, p.opened_on, p.source,
      euros(p.est_amount_cents), p.next_action_label, p.next_action_at, p.highlights, p.lost_reason, p.do_not_contact ? "oui" : "", dateFr(p.created_at),
    ]),
  ]);
}

export function downloadText(name: string, text: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
}
