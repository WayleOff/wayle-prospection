/** Lecture de CSV : séparateur `;` `,` ou tabulation détecté, guillemets (y compris doublés et sur plusieurs lignes), BOM ignoré. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  // Lignes entièrement vides ignorées ; toutes les lignes ramenées à la même largeur.
  const kept = rows.filter((r) => r.some((v) => v.trim() !== ""));
  const width = Math.max(0, ...kept.map((r) => r.length));
  return kept.map((r) => [...r, ...Array<string>(width - r.length).fill("")]);
}

function detectDelimiter(text: string): string {
  // On compte les séparateurs hors guillemets sur la première ligne.
  let quoted = false;
  const count: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  for (const c of text) {
    if (c === '"') quoted = !quoted;
    else if (!quoted) {
      if (c === "\n" || c === "\r") break;
      if (c in count) count[c]++;
    }
  }
  const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ",";
}

/** Décode un fichier : UTF-8 si valide, sinon Windows-1252 (export Excel français). */
export function decodeText(bytes: Uint8Array): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("windows-1252").decode(bytes); }
}
