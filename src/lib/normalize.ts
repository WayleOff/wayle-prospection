/**
 * Normalisation : mêmes règles que les fonctions SQL norm_text / norm_handle / norm_phone
 * (supabase/migrations). Un test compare les deux sur quelques exemples.
 */

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function normText(t: string | null | undefined): string | null {
  const v = strip((t ?? "").toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();
  return v === "" ? null : v;
}

export function normHandle(t: string | null | undefined): string | null {
  const v = (t ?? "")
    .replace(/^\s*(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  return v === "" ? null : v;
}

export function normPhone(t: string | null | undefined): string | null {
  const d = (t ?? "").replace(/[^0-9+]/g, "");
  if (d === "") return null;
  if (d.startsWith("+")) return d.replace(/[^0-9]/g, "") || null;
  if (d.startsWith("00")) return d.slice(2) || null;
  if (d.startsWith("0") && d.length === 10) return "33" + d.slice(1);
  return d;
}

/** Similarité de trigrammes identique à pg_trgm (jaccard sur les trigrammes de chaque mot, remplis par 2 espaces devant et 1 derrière). */
export function trigramSimilarity(a: string, b: string): number {
  const grams = (s: string) => {
    const set = new Set<string>();
    for (const w of s.split(/[^a-z0-9]+/).filter(Boolean)) {
      const p = `  ${w} `;
      for (let i = 0; i + 3 <= p.length; i++) set.add(p.slice(i, i + 3));
    }
    return set;
  };
  const A = grams(a), B = grams(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Adresse affichable d'un compte Instagram, ou null. */
export function instagramUrl(v: string | null | undefined): string | null {
  const h = normHandle(v);
  return h ? `https://www.instagram.com/${h}/` : null;
}

/** Numéro joignable par « tel: » (espaces retirés), ou null. */
export function telHref(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/[^0-9+]/g, "");
  return d.length >= 6 ? `tel:${d}` : null;
}
