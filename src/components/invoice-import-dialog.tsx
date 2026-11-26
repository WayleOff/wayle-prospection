"use client";
import { useMemo, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, CloseButton, Dialog, inputCls } from "./ui";
import { decodeText, parseCsv } from "@/lib/csv";
import { INVOICE_FIELDS, buildInvoiceRows, guessInvoiceMapping, type InvoiceFieldKey, type InvoiceMapping } from "@/lib/invoice-import";
import { PDF_HEADERS, parseInvoiceText, pdfRowCells, type PdfInvoice } from "@/lib/invoice-pdf";
import { fmtDateFr, fmtMoney } from "@/lib/quote";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_PDFS = 60;
const PDF_MAPPING: InvoiceMapping = guessInvoiceMapping([...PDF_HEADERS]);

export function InvoiceImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} variant="drawer" label="Importer des factures">
      <ImportForm onClose={onClose} />
    </Dialog>
  );
}

function ImportForm({ onClose }: { onClose: () => void }) {
  const { prospects, invoices, importInvoices } = useApp();
  const [fileName, setFileName] = useState("");
  const [csvTable, setTable] = useState<string[][] | null>(null);
  const [csvMapping, setMapping] = useState<InvoiceMapping>({});
  const [pdfs, setPdfs] = useState<PdfInvoice[] | null>(null);
  const [reading, setReading] = useState(false);
  // En mode PDF, le « tableau » est fabriqué à partir des fiches lues (corrigeables) et passe par le même circuit de vérification.
  const table = useMemo(() => (pdfs ? [[...PDF_HEADERS], ...pdfs.map(pdfRowCells)] : csvTable), [pdfs, csvTable]);
  const mapping = pdfs ? PDF_MAPPING : csvMapping;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const readPdfs = async (files: File[]) => {
    setError(""); setTable(null); setPdfs(null); setReading(true);
    try {
      if (files.length > MAX_PDFS) { setError(`Trop de fichiers d’un coup (${files.length}, ${MAX_PDFS} maximum).`); return; }
      const { pdfToText } = await import("@/lib/pdf-text");
      const out: PdfInvoice[] = [];
      for (const f of files) {
        if (f.size > MAX_BYTES) { out.push({ ...parseInvoiceText("", f.name), warnings: ["fichier trop gros (8 Mo maximum)"] }); continue; }
        try {
          const text = await pdfToText(await f.arrayBuffer());
          const p = parseInvoiceText(text, f.name);
          if (!text.trim()) p.warnings.unshift("aucun texte lisible (PDF scanné ou image ?) : à saisir à la main");
          out.push(p);
        } catch { out.push({ ...parseInvoiceText("", f.name), warnings: ["PDF illisible (protégé ou abîmé ?)"] }); }
      }
      setFileName(files.length === 1 ? files[0].name : `${files.length} fichiers PDF`);
      setPdfs(out);
    } catch { setError("Impossible de lire ces PDF. Réessaie, ou utilise l’export .csv."); }
    finally { setReading(false); }
  };
  const editPdf = (i: number, patch: Partial<PdfInvoice>) => setPdfs((l) => (l ?? []).map((p, k) => (k === i ? { ...p, ...patch } : p)));

  const readFile = async (f: File) => {
    setError(""); setTable(null); setPdfs(null);
    if (f.size > MAX_BYTES) { setError("Fichier trop gros (8 Mo maximum)."); return; }
    if (/\.xlsx?$/i.test(f.name)) { setError("Il me faut un fichier .csv ou des factures .pdf. Avec un .xlsx, ouvre-le dans Excel puis Fichier → Enregistrer sous → CSV."); return; }
    try {
      const t = parseCsv(decodeText(new Uint8Array(await f.arrayBuffer())));
      if (t.length < 2) { setError("Le fichier ne contient aucune ligne de données (il faut une ligne de titres puis au moins une facture)."); return; }
      if (t.length - 1 > MAX_ROWS) { setError(`Trop de lignes (${t.length - 1}, ${MAX_ROWS} maximum).`); return; }
      setFileName(f.name); setTable(t); setMapping(guessInvoiceMapping(t[0]));
    } catch { setError("Impossible de lire ce fichier. Enregistre-le au format CSV et réessaie."); }
  };

  const setMap = (col: number, key: InvoiceFieldKey | "") => setMapping((m) => {
    const next = { ...m };
    if (key) for (const k of Object.keys(next)) if (next[Number(k)] === key) next[Number(k)] = ""; // un champ = une colonne
    next[col] = key;
    return next;
  });

  const mapped = new Set(Object.values(mapping));
  const ready = mapped.has("number") && (mapped.has("total") || mapped.has("total_ht"));
  const rows = useMemo(
    () => (table && ready ? buildInvoiceRows(table, mapping, { existingNumbers: invoices.map((i) => i.number), prospects }) : []),
    [table, mapping, ready, invoices, prospects],
  );
  const fresh = rows.filter((r) => r.status === "new");
  const dups = rows.filter((r) => r.status === "duplicate");
  const invalid = rows.filter((r) => r.status === "invalid");
  const matched = fresh.filter((r) => r.matched).length;
  const skipped = rows.length - fresh.length;

  const submit = async () => {
    if (!table || fresh.length === 0 || busy) return;
    setBusy(true);
    const named: Record<string, string> = {};
    Object.entries(mapping).forEach(([i, k]) => { if (k) named[table[0][Number(i)] || `colonne ${Number(i) + 1}`] = k; });
    const n = await importInvoices(fresh.map((r) => r.input!), named, skipped);
    setBusy(false);
    if (n != null) onClose();
  };

  const sample = (col: number) => table!.slice(1, 4).map((r) => r[col]).filter(Boolean).join(" · ");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-base font-semibold">Importer des factures</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <p className="text-xs text-muted">Deux façons : choisis <strong>les factures en PDF</strong> (plusieurs d’un coup, lues dans ton navigateur : rien n’est envoyé nulle part), ou l’export <strong>.csv</strong> de Shine (<em>Rapports → Rapport de ventes → Exporter</em>). Les factures déjà importées (même numéro) sont ignorées : tu peux réimporter sans crainte.</p>
          <input ref={fileInput} type="file" multiple accept=".csv,.txt,.pdf,text/csv,application/pdf" className="sr-only" aria-label="Choisir un fichier"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              if (files.length && files.every((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf")) void readPdfs(files);
              else if (files[0]) void readFile(files[0]);
              e.target.value = "";
            }} />
          <Button className="mt-3" onClick={() => fileInput.current?.click()}><FileUp size={15} aria-hidden /> {table ? "Choisir d’autres fichiers" : "Choisir des fichiers"}</Button>
          {reading ? <span role="status" className="ml-2 text-xs text-muted">Lecture des PDF…</span> : null}
          {fileName && table ? <span className="ml-2 text-xs text-muted">{fileName} · {table.length - 1} {pdfs ? "facture" : "ligne"}{table.length > 2 ? "s" : ""}</span> : null}
          {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
        </div>

        {table ? (
          <>
            {pdfs ? (
              <section aria-labelledby="inv-pdf">
                <h3 id="inv-pdf" className="text-sm font-semibold">1. Ce que j’ai lu dans les PDF</h3>
                <p className="mt-1 text-xs text-muted">Vérifie chaque facture et corrige si besoin : la lecture d’un PDF reste une estimation.</p>
                <ul className="mt-3 space-y-3">
                  {pdfs.map((p, i) => (
                    <li key={i} className={`rounded-xl border px-3 py-3 ${p.warnings.length ? "border-amber-500/50" : "border-border"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-xs text-muted" title={p.file}>{p.file}</p>
                        <button type="button" className="text-xs text-muted underline underline-offset-2 hover:text-fg" onClick={() => setPdfs((l) => (l ?? []).filter((_, k) => k !== i))}>Retirer</button>
                      </div>
                      {p.warnings.length ? <p role="note" className="mt-1 text-xs text-amber-700 dark:text-amber-400">À vérifier : {p.warnings.join(" · ")}</p> : null}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="text-xs text-muted">Numéro<input className={inputCls} value={p.number} onChange={(e) => editPdf(i, { number: e.target.value })} /></label>
                        <label className="text-xs text-muted">Client<input className={inputCls} value={p.client} onChange={(e) => editPdf(i, { client: e.target.value })} /></label>
                        <label className="text-xs text-muted">Émise le<input type="date" className={inputCls} value={p.issued} onChange={(e) => editPdf(i, { issued: e.target.value })} /></label>
                        <label className="text-xs text-muted">Payée le <span className="opacity-70">(vide = non payée)</span><input type="date" className={inputCls} value={p.paid} onChange={(e) => editPdf(i, { paid: e.target.value })} /></label>
                        <label className="text-xs text-muted">Montant HT<input inputMode="decimal" className={inputCls} value={p.ht} onChange={(e) => editPdf(i, { ht: e.target.value })} /></label>
                        <label className="text-xs text-muted">Montant TTC<input inputMode="decimal" className={inputCls} value={p.total} onChange={(e) => editPdf(i, { total: e.target.value })} /></label>
                      </div>
                      <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted">Texte lu dans le PDF</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-subtle p-2 text-[11px]">{p.text || "(aucun texte)"}</pre></details>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
            <section aria-labelledby="inv-map">
              <h3 id="inv-map" className="text-sm font-semibold">1. Correspondance des colonnes</h3>
              <p className="mt-1 text-xs text-muted">J’ai deviné d’après les titres : vérifie, et change ce qui ne va pas.</p>
              <ul className="mt-3 space-y-2">
                {table[0].map((h, i) => (
                  <li key={i} className="grid grid-cols-[1fr_11rem] items-center gap-3 rounded-xl border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{h || `Colonne ${i + 1}`}</p>
                      <p className="truncate text-xs text-muted" title={sample(i)}>{sample(i) || "vide"}</p>
                    </div>
                    <select className={inputCls} aria-label={`Champ pour la colonne ${h || i + 1}`} value={mapping[i] ?? ""} onChange={(e) => setMap(i, e.target.value as InvoiceFieldKey | "")}>
                      <option value="">Ne pas importer</option>
                      {INVOICE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
              {!ready ? <p role="alert" className="mt-2 text-sm text-danger">Il faut au moins la colonne du numéro de facture et celle du montant (TTC, ou HT).</p> : null}
            </section>
            )}

            {ready ? (
              <section aria-labelledby="inv-check" className="space-y-3">
                <h3 id="inv-check" className="text-sm font-semibold">2. Vérification avant import</h3>
                <p className="text-sm" role="status" data-testid="invoice-import-summary">
                  <strong>{fresh.length}</strong> nouvelle{fresh.length > 1 ? "s" : ""} facture{fresh.length > 1 ? "s" : ""}
                  {dups.length ? <> · <strong>{dups.length}</strong> déjà importée{dups.length > 1 ? "s" : ""}</> : null}
                  {invalid.length ? <> · <strong>{invalid.length}</strong> ligne{invalid.length > 1 ? "s" : ""} inutilisable{invalid.length > 1 ? "s" : ""}</> : null}
                </p>
                {fresh.length > 0 ? <p className="text-xs text-muted">{matched} rattachée{matched > 1 ? "s" : ""} à un prospect d’après le nom du client. Les autres s’associent à la main depuis la liste.</p> : null}
                {fresh.length > 0 ? (
                  <ul className="divide-y divide-border rounded-xl border border-border text-sm" aria-label="Aperçu des premières factures">
                    {fresh.slice(0, 5).map((r) => (
                      <li key={r.line} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2">
                        <span className="font-medium">{r.input!.number}</span>
                        <span>{r.input!.client_name}</span>
                        <span className="ml-auto tabular-nums">{fmtMoney(r.input!.total_cents)}</span>
                        <span className="w-full text-xs text-muted">{r.input!.issued_on ? fmtDateFr(r.input!.issued_on) : "date inconnue"} · {r.input!.paid_on ? `payée le ${fmtDateFr(r.input!.paid_on)}` : "pas encore payée"}</span>
                      </li>
                    ))}
                    {fresh.length > 5 ? <li className="px-3 py-2 text-xs text-muted">… et {fresh.length - 5} autre{fresh.length - 5 > 1 ? "s" : ""}</li> : null}
                  </ul>
                ) : null}
                {invalid.length > 0 ? (
                  <details className="text-sm"><summary className="cursor-pointer text-muted">Lignes ignorées ({invalid.length})</summary>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted">{invalid.slice(0, 20).map((r) => <li key={r.line}>Ligne {r.line} : {r.reason}</li>)}{invalid.length > 20 ? <li>… et {invalid.length - 20} autres</li> : null}</ul>
                  </details>
                ) : null}
                {dups.length > 0 ? (
                  <details className="text-sm"><summary className="cursor-pointer text-muted">Déjà importées ({dups.length})</summary>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted">{dups.slice(0, 20).map((r) => <li key={r.line}>Ligne {r.line} : {r.reason}</li>)}{dups.length > 20 ? <li>… et {dups.length - 20} autres</li> : null}</ul>
                  </details>
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="primary" disabled={fresh.length === 0 || busy} onClick={() => void submit()}>
          {busy ? "Import…" : fresh.length ? `Importer ${fresh.length} facture${fresh.length > 1 ? "s" : ""}` : "Importer"}
        </Button>
      </div>
    </div>
  );
}
