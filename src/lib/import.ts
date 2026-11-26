import { findDuplicates, type Duplicate } from "./duplicates";
import { normHandle, normText } from "./normalize";
import type { Category, IgActivity, Prospect, ProspectInput, Stage, Tag } from "./types";

export type ImportOrigin = "csv" | "notion";

/** Champs de la fiche qu'une colonne du fichier peut alimenter. */
export const IMPORT_FIELDS = [
  { key: "name", label: "Nom", words: ["nom", "name", "nom du commerce", "etablissement", "commerce", "entreprise", "societe", "raison sociale", "titre", "title", "enseigne"] },
  { key: "category", label: "Catégorie", words: ["categorie", "category", "type", "secteur", "activite"] },
  { key: "instagram", label: "Instagram", words: ["instagram", "insta", "ig", "compte instagram", "profil instagram"] },
  { key: "phone", label: "Téléphone", words: ["telephone", "tel", "phone", "mobile", "portable", "numero"] },
  { key: "email", label: "E-mail", words: ["email", "e mail", "mail", "courriel", "adresse mail", "adresse email"] },
  { key: "website", label: "Site web", words: ["site", "site web", "website", "web", "url", "lien"] },
  { key: "address", label: "Adresse", words: ["adresse", "address", "localisation", "lieu", "rue"] },
  { key: "contact_first_name", label: "Prénom du contact", words: ["prenom", "prenom du contact", "first name", "contact prenom"] },
  { key: "contact_last_name", label: "Nom du contact", words: ["nom du contact", "contact", "interlocuteur", "last name", "contact nom"] },
  { key: "opened_on", label: "Date d’ouverture", words: ["ouverture", "date d ouverture", "ouvert le", "opened", "opening date", "date ouverture"] },
  { key: "highlights", label: "Points d’accroche / notes", words: ["notes", "note", "remarques", "remarque", "commentaire", "commentaires", "points d accroche", "description", "observations"] },
  { key: "ig_activity", label: "Activité Instagram", words: ["activite instagram", "activite ig", "instagram activite"] },
  { key: "is_independent", label: "Indépendant (oui/non)", words: ["independant", "independent"] },
  { key: "tags", label: "Étiquettes", words: ["etiquettes", "etiquette", "tags", "tag", "labels"] },
] as const;
export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type Mapping = Record<number, ImportFieldKey | "">; // index de colonne → champ

const norm = (s: string) => normText(s) ?? "";

/** Propose une correspondance colonne → champ d'après les titres (mots français ou anglais). Chaque champ et chaque colonne servent une fois. */
export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const usedField = new Set<string>();
  const heads = headers.map(norm);
  headers.forEach((_, i) => { mapping[i] = ""; });
  const assign = (i: number, key: ImportFieldKey) => { mapping[i] = key; usedField.add(key); };
  // 1. Titre exactement égal à un mot connu.
  for (const f of IMPORT_FIELDS) {
    const i = heads.findIndex((h, idx) => !mapping[idx] && f.words.some((w) => norm(w) === h));
    if (i >= 0 && !usedField.has(f.key)) assign(i, f.key);
  }
  // 2. Titre qui contient un mot connu d'au moins 4 lettres (« Compte Instagram principal »).
  for (const f of IMPORT_FIELDS) {
    if (usedField.has(f.key)) continue;
    const i = heads.findIndex((h, idx) => !mapping[idx] && f.words.some((w) => norm(w).length >= 4 && (` ${h} `).includes(` ${norm(w)} `)));
    if (i >= 0) assign(i, f.key);
  }
  return mapping;
}

// ── Nettoyage des valeurs ──

/** Notion écrit les liens de page « Titre (https://www.notion.so/…) » : on retire le lien. */
export function stripNotionLinks(v: string): string {
  return v.replace(/\s*\((?:https?:\/\/)?(?:www\.)?notion\.(?:so|site)\/[^)]*\)/gi, "").trim();
}

const MONTHS: Record<string, number> = {
  janvier: 1, january: 1, jan: 1, fevrier: 2, february: 2, feb: 2, fev: 2, mars: 3, march: 3, mar: 3, avril: 4, april: 4, apr: 4, avr: 4, mai: 5, may: 5,
  juin: 6, june: 6, jun: 6, juillet: 7, july: 7, jul: 7, juil: 7, aout: 8, august: 8, aug: 8, septembre: 9, september: 9, sep: 9, sept: 9,
  octobre: 10, october: 10, oct: 10, novembre: 11, november: 11, nov: 11, decembre: 12, december: 12, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, "0");
function validDate(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** Date en AAAA-MM-JJ depuis 2026-03-14, 14/03/2026, 14-03-26, « 14 mars 2026 », « March 14, 2026 », « 2026/03/14 » ; plage Notion « a → b » : la première. */
export function parseDate(raw: string): string | null {
  const t = stripNotionLinks(raw).split("→")[0].trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) return validDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  // « 14 mars 2026 », « March 14, 2026 »
  const words = norm(t).split(" ");
  const monthWord = words.find((w) => w in MONTHS);
  if (!monthWord) return null;
  const nums = words.filter((w) => /^\d+$/.test(w)).map(Number);
  const month = MONTHS[monthWord];
  if (nums.length >= 2) {
    const [a, b] = nums;
    return a > 31 ? validDate(a, month, b) : validDate(b < 100 ? 2000 + b : b, month, a);
  }
  return nums.length === 1 && nums[0] > 1900 ? validDate(nums[0], month, 1) : null;
}

const YES = new Set(["oui", "yes", "true", "vrai", "1", "x", "checked", "o", "y"]);
const NO = new Set(["non", "no", "false", "faux", "0", "unchecked", "n", ""]);
export function parseBool(raw: string): boolean | null {
  const v = norm(raw);
  if (YES.has(v)) return true;
  if (NO.has(v)) return false;
  return null;
}

export function parseIgActivity(raw: string): IgActivity | null {
  const v = norm(raw);
  if (!v) return null;
  if (/^(inactif|inactive|inactifs|aucune|aucun|mort|dormant)/.test(v)) return "inactive";
  if (/^(faible|low|peu|rare|irregulier|irreguliere)/.test(v)) return "low";
  if (/^(actif|active|regulier|reguliere|high|forte|fort)/.test(v)) return "active";
  return null;
}

const RE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export function cleanEmail(raw: string): string | null {
  const v = raw.trim().replace(/^mailto:/i, "").split(/[\s,;]+/)[0] ?? "";
  return RE_EMAIL.test(v) ? v.toLowerCase() : null;
}
export function cleanWebsite(raw: string): string | null {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(v) ? `https://${v}` : null;
}
export function cleanPhone(raw: string): string | null {
  const v = raw.trim();
  return v.replace(/\D/g, "").length >= 6 ? v : null;
}

// ── Construction des lignes à importer ──

export interface ImportContext {
  origin: ImportOrigin;
  categories: Category[];
  tags: Tag[];
  stages: Stage[];
  existing: Prospect[];
  /** Appliqués aux lignes qui n'ont pas la valeur dans le fichier. */
  defaultCategoryId: string | null;
  stageId: string;
}

export type RowStatus = "new" | "duplicate" | "invalid";
export interface ImportRow {
  line: number; // numéro de ligne dans le fichier (1 = titres)
  status: RowStatus;
  /** Raison lisible : pourquoi doublon / invalide. */
  reason: string | null;
  input: ProspectInput | null;
  tag_ids: string[];
  warnings: string[];
  /** Fiche déjà présente (ou ligne précédente du fichier) dont celle-ci est le doublon. */
  match: { name: string; inFile: boolean; reason: Duplicate["reason"] } | null;
}

export const DUP_REASON: Record<Duplicate["reason"], string> = { instagram: "même compte Instagram", phone: "même téléphone", name: "nom identique ou proche" };

export function buildRows(table: string[][], mapping: Mapping, ctx: ImportContext): ImportRow[] {
  const rows: ImportRow[] = [];
  const seen: Prospect[] = []; // lignes déjà lues dans ce fichier, pour repérer les doublons internes
  const catByName = new Map(ctx.categories.map((c) => [norm(c.name), c.id]));
  const tagByName = new Map(ctx.tags.map((t) => [norm(t.name), t.id]));
  const source = ctx.origin === "notion" ? "Import Notion" : "Import CSV";
  const cols = Object.entries(mapping).filter(([, k]) => k).map(([i, k]) => [Number(i), k as ImportFieldKey] as const);

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const val = (key: ImportFieldKey): string => {
      const found = cols.find(([, k]) => k === key);
      if (!found) return "";
      const raw = (cells[found[0]] ?? "").trim();
      return ctx.origin === "notion" ? stripNotionLinks(raw) : raw;
    };
    const warnings: string[] = [];
    const warn = (label: string, raw: string) => warnings.push(`${label} « ${raw.length > 30 ? raw.slice(0, 30) + "…" : raw} » non reconnu, ignoré`);

    const input: Partial<ProspectInput> = {};
    const ig = val("instagram");
    if (ig) { const h = normHandle(ig); if (h && /^[a-z0-9._]{1,40}$/.test(h)) input.instagram = `@${h}`; else warn("Instagram", ig); }
    let name = val("name");
    if (!name && input.instagram) name = input.instagram.slice(1); // comme l'ajout rapide : fiche nommée d'après le compte
    const email = val("email");
    if (email) { const e = cleanEmail(email); if (e) input.email = e; else warn("E-mail", email); }
    const phone = val("phone");
    if (phone) { const p = cleanPhone(phone); if (p) input.phone = p; else warn("Téléphone", phone); }
    const web = val("website");
    if (web) { const w = cleanWebsite(web); if (w) input.website = w; else warn("Site web", web); }
    const opened = val("opened_on");
    if (opened) { const d = parseDate(opened); if (d) input.opened_on = d; else warn("Date d'ouverture", opened); }
    const iga = val("ig_activity");
    if (iga) { const a = parseIgActivity(iga); if (a) input.ig_activity = a; else warn("Activité Instagram", iga); }
    const ind = val("is_independent");
    if (ind) { const b = parseBool(ind); if (b != null) input.is_independent = b; else warn("Indépendant", ind); }
    const addr = val("address"); if (addr) input.address = addr;
    const fn = val("contact_first_name"); if (fn) input.contact_first_name = fn;
    const ln = val("contact_last_name"); if (ln) input.contact_last_name = ln;
    const notes = val("highlights"); if (notes) input.highlights = notes;

    const catName = val("category");
    let category_id = ctx.defaultCategoryId;
    if (catName) {
      const id = catByName.get(norm(catName));
      if (id) category_id = id; else warnings.push(`Catégorie « ${catName} » inconnue, ${ctx.defaultCategoryId ? "catégorie par défaut utilisée" : "laissée vide"}`);
    }
    const tag_ids: string[] = [];
    const tagCell = val("tags");
    if (tagCell) {
      for (const t of tagCell.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)) {
        const id = tagByName.get(norm(t));
        if (id) { if (!tag_ids.includes(id)) tag_ids.push(id); } else warnings.push(`Étiquette « ${t} » inconnue, ignorée`);
      }
    }

    if (!name.trim()) {
      rows.push({ line: r + 1, status: "invalid", reason: "Nom manquant", input: null, tag_ids: [], warnings, match: null });
      continue;
    }
    const full: ProspectInput = { ...input, name: name.trim(), stage_id: ctx.stageId, category_id, source, is_independent: input.is_independent ?? true };

    // Doublons : fiches existantes d'abord, puis lignes déjà lues dans ce fichier.
    const probe = { name: full.name, instagram: full.instagram ?? null, phone: full.phone ?? null };
    const hit = findDuplicates(ctx.existing, probe)[0];
    const hitInFile = hit ? null : findDuplicates(seen, probe)[0];
    const dup = hit ?? hitInFile;
    seen.push({ id: `row-${r}`, name: full.name, instagram: full.instagram ?? null, phone: full.phone ?? null, archived_at: null } as Prospect);
    if (dup) {
      rows.push({
        line: r + 1, status: "duplicate", reason: DUP_REASON[dup.reason], input: full, tag_ids, warnings,
        match: { name: dup.prospect.name, inFile: !hit, reason: dup.reason },
      });
    } else rows.push({ line: r + 1, status: "new", reason: null, input: full, tag_ids, warnings, match: null });
  }
  return rows;
}
