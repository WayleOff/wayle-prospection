import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Ce qu'on retient de la page d'accueil d'un site : du texte, et des indices sur sa présence vidéo / réseaux. */
export interface SiteInfo {
  url: string;
  title: string;
  description: string;
  text: string;
  signals: { videoTags: number; embeds: string[]; socials: string[] };
}

/** Adresse locale ou privée : jamais jointe depuis le serveur (protège contre le détournement vers le réseau interne). */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (v === 6) {
    const t = ip.toLowerCase();
    if (t === "::1" || t === "::") return true;
    if (t.startsWith("::ffff:")) return isPrivateAddress(t.slice(7));
    return /^f[cd]/.test(t) || /^fe[89ab]/.test(t);
  }
  return true;
}

const decode = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Extrait le texte utile (titre, description, titres, paragraphes) et les indices vidéo d'un HTML. Fonction pure. */
export function extractSiteInfo(html: string, url: string): SiteInfo {
  const strip = (h: string) => decode(h.replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? "").slice(0, 160);
  const metaTag = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0] ?? html.match(/<meta[^>]+property=["']og:description["'][^>]*>/i)?.[0] ?? "";
  const description = decode((metaTag.match(/content=["']([^"']*)["']/i) ?? [])[1] ?? "").trim().slice(0, 300);
  const body = (html.match(/<body[\s\S]*<\/body>/i) ?? [html])[0].replace(/<(nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ");
  const text = strip(body.replace(/<\/(p|div|li|h[1-6]|section|br)>/gi, "$& ")).slice(0, 3500);
  const embeds = [...new Set([...html.matchAll(/(?:src|href)=["'][^"']*(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com)[^"']*/gi)].map((m) => m[1].replace("youtu.be", "youtube.com")))];
  const socials = [...new Set([...html.matchAll(/href=["'][^"']*(instagram\.com|tiktok\.com|facebook\.com|youtube\.com\/(?:@|c\/|channel)|linkedin\.com)[^"']*/gi)].map((m) => m[1].replace(/\/.*/, "")))];
  return { url, title, description, text, signals: { videoTags: (html.match(/<video[\s>]/gi) ?? []).length, embeds, socials } };
}

/** Lit la page d'accueil d'un site public (http/https). Renvoie null si impossible : l'analyse se fait alors sans le site. */
export async function fetchSiteInfo(raw: string, opts: { fetchImpl?: typeof fetch; resolve?: (host: string) => Promise<string[]>; timeoutMs?: number } = {}): Promise<SiteInfo | null> {
  const f = opts.fetchImpl ?? fetch;
  const resolve = opts.resolve ?? (async (h: string) => (await lookup(h, { all: true })).map((a) => a.address));
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  const deadline = Date.now() + (opts.timeoutMs ?? 7000);
  for (let hop = 0; hop < 4; hop++) {
    if (!/^https?:$/.test(url.protocol) || (url.port && !["80", "443"].includes(url.port))) return null;
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return null;
    try {
      const addrs = isIP(host) ? [host] : await resolve(host);
      if (addrs.length === 0 || addrs.some(isPrivateAddress)) return null;
    } catch { return null; }
    let res: Response;
    try {
      res = await f(url, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (compatible; WayleProspection/1.0)", accept: "text/html" }, signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())) });
    } catch { return null; }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      try { url = new URL(loc, url); } catch { return null; }
      continue;
    }
    if (!res.ok || !/text\/html|application\/xhtml/i.test(res.headers.get("content-type") ?? "")) return null;
    // Lecture plafonnée : une page géante ne doit pas saturer le serveur.
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = []; let size = 0;
    while (size < 400_000) { const { done, value } = await reader.read(); if (done || !value) break; chunks.push(value); size += value.length; }
    void reader.cancel().catch(() => undefined);
    const html = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
    return extractSiteInfo(html, url.toString());
  }
  return null;
}
