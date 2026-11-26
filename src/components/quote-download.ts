import { buildQuotePdf } from "@/lib/quote-pdf";
import { quoteFileName } from "@/lib/quote";
import type { Company, Prospect, Quote } from "@/lib/types";

/** Génère le PDF du devis dans le navigateur et le télécharge. */
export async function downloadQuote(q: Quote, p: Prospect, company: Company): Promise<void> {
  const bytes = await buildQuotePdf(q, p, company);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = quoteFileName(q, p.name);
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
}
