/** Lecture du texte d'un PDF dans le navigateur (pdf.js), une ligne de texte par ligne visuelle. Chargé à la demande. */
export async function pdfToText(data: ArrayBuffer): Promise<string> {
  const pdfjs = (await import("pdfjs-dist")) as typeof import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  const out: string[] = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const rows: { y: number; items: { x: number; s: string }[] }[] = [];
      for (const it of content.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        const x = it.transform[4], y = it.transform[5];
        const row = rows.find((r) => Math.abs(r.y - y) < 3);
        if (row) row.items.push({ x, s: it.str }); else rows.push({ y, items: [{ x, s: it.str }] });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) out.push(r.items.sort((a, b) => a.x - b.x).map((i) => i.s).join(" "));
      out.push("");
    }
  } finally { void task.destroy(); }
  return out.join("\n");
}
