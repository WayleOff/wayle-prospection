import { normHandle, normPhone, normText, trigramSimilarity } from "./normalize";
import type { Prospect } from "./types";

export interface Duplicate {
  prospect: Prospect;
  reason: "instagram" | "phone" | "name";
  similarity: number;
}

/**
 * Prospects qui ressemblent à une saisie : même Instagram, même téléphone, ou nom identique / proche (≥ 0,6).
 * Mêmes règles que la fonction SQL find_duplicates ; les fiches archivées sont ignorées.
 */
export function findDuplicates(
  list: Prospect[],
  input: { name?: string | null; instagram?: string | null; phone?: string | null },
  excludeId?: string,
): Duplicate[] {
  const ig = normHandle(input.instagram);
  const ph = normPhone(input.phone);
  const nm = normText(input.name);
  const out: Duplicate[] = [];
  for (const p of list) {
    if (p.archived_at || p.id === excludeId) continue;
    const pName = normText(p.name) ?? "";
    const sim = nm ? trigramSimilarity(pName, nm) : 0;
    let reason: Duplicate["reason"] | null = null;
    if (ig && normHandle(p.instagram) === ig) reason = "instagram";
    else if (ph && normPhone(p.phone) === ph) reason = "phone";
    else if (nm && (pName === nm || sim >= 0.6)) reason = "name";
    if (reason) out.push({ prospect: p, reason, similarity: sim });
  }
  return out.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}
