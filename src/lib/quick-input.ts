import type { ProspectPatch } from "./types";
import { normHandle } from "./normalize";

export interface QuickParse {
  patch: ProspectPatch;
  /** Ce que l'outil a compris, pour l'afficher à l'utilisateur. */
  understood: string[];
  /** Avertissements (lien raccourci non lisible, etc.). */
  warnings: string[];
}

const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const RE_PHONE = /(?:\+33|0033|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/;
const RE_URL = /https?:\/\/[^\s]+/i;
const MAPS_HOSTS = /(^|\.)(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl)$/i;

function parseMapsUrl(raw: string): { name?: string; lat?: number; lng?: number; short?: boolean } | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  const isMaps = MAPS_HOSTS.test(u.hostname) && (u.hostname.includes("goo.gl") || u.pathname.startsWith("/maps") || u.searchParams.has("q"));
  if (!isMaps) return null;
  if (u.hostname.includes("goo.gl")) return { short: true };
  const res: { name?: string; lat?: number; lng?: number } = {};
  const place = u.pathname.match(/\/maps\/place\/([^/@]+)/);
  if (place) res.name = decodeURIComponent(place[1].replace(/\+/g, " ")).trim();
  const at = (u.pathname + u.search).match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  const bang = raw.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  const q = u.searchParams.get("q")?.match(/^(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)$/);
  const c = bang ?? at ?? q;
  if (c) { res.lat = parseFloat(c[1]); res.lng = parseFloat(c[2]); }
  return res;
}

/** Comprend ce que l'utilisateur colle dans l'ajout rapide : nom, lien Instagram, lien Google Maps, e-mail, téléphone, site. */
export function parseQuickInput(text: string): QuickParse {
  const patch: ProspectPatch = {};
  const understood: string[] = [];
  const warnings: string[] = [];
  let rest = text.trim();
  const take = (m: RegExpMatchArray | null) => { if (m) rest = rest.replace(m[0], " "); };

  const url = rest.match(RE_URL);
  if (url) {
    const link = url[0].replace(/[),.;]+$/, "");
    const maps = parseMapsUrl(link);
    if (/instagram\.com|instagr\.am/i.test(link)) {
      const h = normHandle(link);
      if (h) { patch.instagram = `@${h}`; understood.push(`Instagram @${h}`); }
      take(url);
    } else if (maps) {
      if (maps.short) warnings.push("Lien Google Maps raccourci : je ne peux pas le lire d'ici. Ouvrez-le, copiez le lien complet de la page, ou complétez à la main.");
      if (maps.name) { patch.name = maps.name; understood.push(`Nom « ${maps.name} »`); }
      if (maps.lat != null && maps.lng != null) { patch.lat = maps.lat; patch.lng = maps.lng; understood.push("Position sur la carte"); }
      if (!maps.short && maps.lat == null && !maps.name) warnings.push("Lien Google Maps sans nom ni position lisibles.");
      take(url);
    } else if (/tiktok\.com\/@/i.test(link)) {
      const h = link.match(/tiktok\.com\/(@[A-Za-z0-9._]+)/i)?.[1];
      if (h) { patch.tiktok = h; understood.push(`TikTok ${h}`); }
      take(url);
    } else if (/linkedin\.com/i.test(link)) {
      patch.linkedin = link; understood.push("LinkedIn"); take(url);
    } else {
      patch.website = link; understood.push("Site web"); take(url);
    }
  }

  const email = rest.match(RE_EMAIL);
  if (email) { patch.email = email[0]; understood.push(`E-mail ${email[0]}`); take(email); }
  const phone = rest.match(RE_PHONE);
  if (phone) { patch.phone = phone[0].trim(); understood.push(`Téléphone ${phone[0].trim()}`); take(phone); }

  if (!patch.instagram) {
    const handle = rest.match(/(^|\s)@([A-Za-z0-9._]{2,30})(?=\s|$)/);
    if (handle) { patch.instagram = `@${handle[2].toLowerCase()}`; understood.push(`Instagram @${handle[2].toLowerCase()}`); rest = rest.replace(handle[0], " "); }
  }

  const name = rest.replace(/\s+/g, " ").trim();
  if (name) { patch.name = name; understood.unshift(`Nom « ${name} »`); }
  return { patch, understood, warnings };
}
