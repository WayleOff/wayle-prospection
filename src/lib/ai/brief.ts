import { STYLE_RULES, buildUserPrompt, type GenerateInput } from "./generate";

const MARK = (n: number) => `=== VARIANTE ${n} ===`;

/** Texte à coller dans l'application Claude (abonnement) pour obtenir des variantes, sans passer par la clé API. */
export function buildBrief(i: GenerateInput): string {
  return `${STYLE_RULES}

${buildUserPrompt(i)}

Format de réponse : écris ${i.count} variantes d'angles différents (par exemple : partir du détail remarqué, partir de la proposition, partir d'une question). Avant chaque variante, mets une ligne exactement comme ceci, puis le message seul, sans commentaire :
${Array.from({ length: i.count }, (_, k) => MARK(k + 1)).join("\n")}`;
}

/** Découpe la réponse collée depuis l'application Claude en variantes (repère « === VARIANTE n === », « Variante n », ou « --- »). */
export function parsePastedVariants(text: string, max = 3): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  const json = t.match(/\{[\s\S]*"variants"[\s\S]*\}/);
  if (json) {
    try {
      const v = (JSON.parse(json[0]) as { variants?: unknown }).variants;
      if (Array.isArray(v)) { const list = v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()); if (list.length) return list.slice(0, max); }
    } catch { /* on essaie les autres formats */ }
  }
  const clean = (parts: string[]) => parts.map((p) => p.replace(/^\s*[`*_]+\s*|\s*[`*_]+\s*$/g, "").trim()).filter(Boolean);
  const marker = /^[ \t>*#=_-]*variante\s*\d+\s*[:.)]?[ \t*#=_-]*$/gim;
  if (marker.test(t)) {
    const parts = t.split(/^[ \t>*#=_-]*variante\s*\d+\s*[:.)]?[ \t*#=_-]*$/gim);
    // Ce qui précède la première variante (« Voici 3 variantes : ») n'est pas un message.
    const byMarker = clean(parts.slice(1));
    if (byMarker.length) return byMarker.slice(0, max);
  }
  const byRule = clean(t.split(/^\s*-{3,}\s*$/gm));
  if (byRule.length > 1) return byRule.slice(0, max);
  return [t];
}
