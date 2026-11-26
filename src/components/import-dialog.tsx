"use client";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, FileUp } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, CloseButton, Dialog, inputCls } from "./ui";
import { decodeText, parseCsv } from "@/lib/csv";
import { normText } from "@/lib/normalize";
import { ProspectSqlNotice } from "./sql-notice";
import { IMPORT_FIELDS, MULTI_FIELDS, buildRows, guessMapping, type ImportFieldKey, type ImportOrigin, type Mapping } from "@/lib/import";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 5000;

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} variant="drawer" label="Importer des prospects">
      <ImportForm onClose={onClose} />
    </Dialog>
  );
}

/** Choisit, dans une archive Notion, le CSV de la base : « … _all.csv » s'il existe, sinon le plus gros. */
async function csvFromZip(bytes: Uint8Array): Promise<Uint8Array | null> {
  const { unzipSync } = await import("fflate");
  const files = unzipSync(bytes, { filter: (f) => /\.csv$/i.test(f.name) });
  const names = Object.keys(files);
  if (names.length === 0) return null;
  const all = names.find((n) => /_all\.csv$/i.test(n));
  return files[all ?? names.sort((a, b) => files[b].length - files[a].length)[0]];
}

function ImportForm({ onClose }: { onClose: () => void }) {
  const { ref, prospects, importProspects, prospectExtras } = useApp();
  const [origin, setOrigin] = useState<ImportOrigin>("csv");
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const firstOpen = ref.stages.filter((s) => s.kind === "open").sort((a, b) => a.position - b.position)[0] ?? ref.stages[0];
  const [stageId, setStageId] = useState(firstOpen.id);
  const [categoryId, setCategoryId] = useState("");
  const [forced, setForced] = useState<Set<number>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);

  const readFile = async (f: File) => {
    setError(""); setTable(null); setForced(new Set());
    if (f.size > MAX_BYTES) { setError("Fichier trop gros (8 Mo maximum). Scindez-le en plusieurs fichiers."); return; }
    try {
      let bytes: Uint8Array = new Uint8Array(await f.arrayBuffer());
      let notion = origin === "notion";
      if (/\.zip$/i.test(f.name) || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
        const inner = await csvFromZip(bytes);
        if (!inner) { setError("Aucun fichier CSV dans cette archive. Dans Notion : ••• de la base → Exporter → Format CSV."); return; }
        bytes = inner; notion = true;
      }
      const t = parseCsv(decodeText(bytes));
      if (t.length < 2) { setError("Le fichier ne contient aucune ligne de données (il faut une ligne de titres puis au moins un prospect)."); return; }
      if (t.length - 1 > MAX_ROWS) { setError(`Trop de lignes (${t.length - 1}, ${MAX_ROWS} maximum). Scindez le fichier.`); return; }
      if (t[0].some((h) => /^(created time|last edited time|date de création|dernière modification)$/i.test(h.trim()))) notion = true;
      setOrigin(notion ? "notion" : "csv");
      setFileName(f.name);
      setTable(t);
      setMapping(guessMapping(t[0]));
    } catch { setError("Impossible de lire ce fichier. Enregistrez-le au format CSV et réessayez."); }
  };

  const setMap = (col: number, key: ImportFieldKey | "") => {
    setForced(new Set());
    setMapping((m) => {
      const next = { ...m };
      if (key && !MULTI_FIELDS.includes(key)) for (const k of Object.keys(next)) if (next[Number(k)] === key) next[Number(k)] = ""; // un champ = une colonne (sauf « notes »)
      next[col] = key;
      return next;
    });
  };

  // Colonnes qui contiennent des données mais ne seront pas importées : on ne les perd pas en silence.
  const TECHNICAL = /^(created time|last edited time|created by|last edited by|date de creation|derniere modification|cree par|modifie par)$/i;
  const dropped = table ? table[0].map((h, i) => ({ h: h.trim() || `Colonne ${i + 1}`, i })).filter(({ h, i }) => !mapping[i] && !TECHNICAL.test(normText(h) ?? "") && table.slice(1).some((r) => (r[i] ?? "").trim() !== "")) : [];
  const keepAsNotes = () => setMapping((m) => { const next = { ...m }; for (const d of dropped) next[d.i] = "extra"; return next; });
  const usesExtras = Object.values(mapping).some((k) => k === "contact_role" || k === "activity");
  const hasName = Object.values(mapping).some((k) => k === "name" || k === "instagram");
  const rows = useMemo(
    () => (table && hasName ? buildRows(table, mapping, { origin, categories: ref.categories, tags: ref.tags, stages: ref.stages, existing: prospects, defaultCategoryId: categoryId || null, stageId }) : []),
    [table, mapping, hasName, origin, ref.categories, ref.tags, ref.stages, prospects, categoryId, stageId],
  );
  const fresh = rows.filter((r) => r.status === "new");
  const dups = rows.filter((r) => r.status === "duplicate");
  const invalid = rows.filter((r) => r.status === "invalid");
  const warned = rows.filter((r) => r.warnings.length > 0 && r.status !== "invalid");
  const toImport = [...fresh, ...dups.filter((r) => forced.has(r.line))];
  const skipped = rows.length - toImport.length;

  const submit = async () => {
    if (!table || toImport.length === 0 || busy) return;
    setBusy(true);
    const named: Record<string, string> = {};
    Object.entries(mapping).forEach(([i, k]) => { if (k) named[table[0][Number(i)] || `colonne ${Number(i) + 1}`] = k; });
    const n = await importProspects(origin, named, toImport.map((r) => ({ input: r.input!, tag_ids: r.tag_ids })), skipped);
    setBusy(false);
    if (n != null) onClose();
  };

  const sample = (col: number) => table!.slice(1, 4).map((r) => r[col]).filter(Boolean).join(" · ");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-base font-semibold">Importer des prospects</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <div role="group" aria-label="Origine du fichier" className="flex gap-2">
            {([["csv", "Fichier CSV"], ["notion", "Export Notion"]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={origin === v} onClick={() => setOrigin(v)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${origin === v ? "border-accent bg-accent/10 font-medium" : "border-border hover:border-muted/60"}`}>{label}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            {origin === "notion"
              ? "Dans Notion : ••• en haut de la base → Exporter → Format CSV. Vous pouvez déposer l’archive .zip telle quelle ou le .csv qu’elle contient."
              : "Un fichier .csv (Excel : Fichier → Enregistrer sous → CSV). La première ligne doit contenir les titres des colonnes."}
          </p>
          <input ref={fileInput} type="file" accept=".csv,.txt,.zip,text/csv" className="sr-only" aria-label="Choisir un fichier"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} />
          <Button className="mt-3" onClick={() => fileInput.current?.click()}><FileUp size={15} aria-hidden /> {table ? "Choisir un autre fichier" : "Choisir un fichier"}</Button>
          {fileName ? <span className="ml-2 text-xs text-muted">{fileName} · {table ? table.length - 1 : 0} ligne{table && table.length > 2 ? "s" : ""}</span> : null}
          {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
        </div>

        {table ? (
          <>
            <section aria-labelledby="imp-map">
              <h3 id="imp-map" className="text-sm font-semibold">1. Correspondance des colonnes</h3>
              <p className="mt-1 text-xs text-muted">J’ai deviné d’après les titres : vérifiez, et changez ce qui ne va pas.</p>
              <ul className="mt-3 space-y-2">
                {table[0].map((h, i) => (
                  <li key={i} className="grid grid-cols-[1fr_11rem] items-center gap-3 rounded-xl border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{h || `Colonne ${i + 1}`}</p>
                      <p className="truncate text-xs text-muted" title={sample(i)}>{sample(i) || "vide"}</p>
                    </div>
                    <select className={inputCls} aria-label={`Champ pour la colonne ${h || i + 1}`} value={mapping[i] ?? ""} onChange={(e) => setMap(i, e.target.value as ImportFieldKey | "")}>
                      <option value="">Ne pas importer</option>
                      {IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
              {dropped.length > 0 ? (
                <div role="note" className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="flex items-center gap-1.5 font-medium"><AlertTriangle size={15} aria-hidden /> {dropped.length} colonne{dropped.length > 1 ? "s" : ""} avec des données ne seront pas importée{dropped.length > 1 ? "s" : ""}</p>
                  <p className="mt-1 text-xs text-muted">{dropped.map((d) => d.h).join(" · ")}</p>
                  <Button size="sm" className="mt-2" onClick={keepAsNotes}>Les ajouter aux notes de la fiche</Button>
                </div>
              ) : null}
              {usesExtras && !prospectExtras ? <div className="mt-3"><ProspectSqlNotice what="Le poste du contact et l’activité ne seront pas enregistrés" /></div> : null}
              {!hasName ? <p role="alert" className="mt-2 text-sm text-danger">Choisissez la colonne du nom (ou de l’Instagram) pour continuer.</p> : null}
            </section>

            <section aria-labelledby="imp-opts" className="grid grid-cols-2 gap-3">
              <h3 id="imp-opts" className="col-span-2 text-sm font-semibold">2. Où les ranger</h3>
              <div>
                <label htmlFor="imp-stage" className="mb-1 block text-xs font-medium text-muted">Étape de départ</label>
                <select id="imp-stage" className={inputCls} value={stageId} onChange={(e) => setStageId(e.target.value)}>
                  {ref.stages.filter((s) => s.kind === "open").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="imp-cat" className="mb-1 block text-xs font-medium text-muted">Catégorie par défaut</label>
                <select id="imp-cat" className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Aucune</option>
                  {ref.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </section>

            {hasName ? (
              <section aria-labelledby="imp-check" className="space-y-3">
                <h3 id="imp-check" className="text-sm font-semibold">3. Vérification</h3>
                <p className="text-sm" role="status" data-testid="import-summary">
                  <strong>{fresh.length}</strong> nouveau{fresh.length > 1 ? "x" : ""}
                  {dups.length ? <> · <strong>{dups.length}</strong> doublon{dups.length > 1 ? "s" : ""}</> : null}
                  {invalid.length ? <> · <strong>{invalid.length}</strong> ligne{invalid.length > 1 ? "s" : ""} inutilisable{invalid.length > 1 ? "s" : ""}</> : null}
                </p>

                {fresh.length > 0 ? (
                  <ul className="divide-y divide-border rounded-xl border border-border text-sm" aria-label="Aperçu des premières fiches">
                    {fresh.slice(0, 5).map((r) => (
                      <li key={r.line} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2">
                        <span className="font-medium">{r.input!.name}</span>
                        <span className="text-xs text-muted">{[ref.categories.find((c) => c.id === r.input!.category_id)?.name, r.input!.contact_first_name ? [r.input!.contact_first_name, r.input!.contact_last_name].filter(Boolean).join(" ") + (r.input!.contact_role ? ` (${r.input!.contact_role})` : "") : r.input!.contact_role, r.input!.instagram, r.input!.phone, r.input!.email, r.input!.address, r.input!.website].filter(Boolean).join(" · ")}</span>
                      </li>
                    ))}
                    {fresh.length > 5 ? <li className="px-3 py-2 text-xs text-muted">… et {fresh.length - 5} autre{fresh.length - 5 > 1 ? "s" : ""}</li> : null}
                  </ul>
                ) : null}

                {dups.length > 0 ? (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium"><AlertTriangle size={15} aria-hidden /> Doublons : ignorés sauf si vous les cochez</p>
                    <ul className="mt-2 space-y-1.5">
                      {dups.map((r) => (
                        <li key={r.line}>
                          <label className="flex items-start gap-2 text-sm">
                            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={forced.has(r.line)}
                              onChange={(e) => setForced((s) => { const n = new Set(s); if (e.target.checked) n.add(r.line); else n.delete(r.line); return n; })} />
                            <span><span className="font-medium">{r.input!.name}</span> <span className="text-xs text-muted">· {r.reason} que « {r.match!.name} » ({r.match!.inFile ? "ligne plus haut dans le fichier" : "déjà dans la base"}) · ligne {r.line}</span></span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {invalid.length > 0 ? (
                  <details className="text-sm"><summary className="cursor-pointer text-muted">Lignes ignorées ({invalid.length})</summary>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted">{invalid.slice(0, 20).map((r) => <li key={r.line}>Ligne {r.line} : {r.reason}</li>)}{invalid.length > 20 ? <li>… et {invalid.length - 20} autres</li> : null}</ul>
                  </details>
                ) : null}
                {warned.length > 0 ? (
                  <details className="text-sm"><summary className="cursor-pointer text-muted">Valeurs non reconnues, laissées vides ({warned.reduce((n, r) => n + r.warnings.length, 0)})</summary>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                      {warned.flatMap((r) => r.warnings.map((w) => `Ligne ${r.line} : ${w}`)).slice(0, 20).map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  </details>
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="primary" disabled={toImport.length === 0 || busy} onClick={() => void submit()}>
          {busy ? "Import…" : toImport.length ? `Importer ${toImport.length} prospect${toImport.length > 1 ? "s" : ""}` : "Importer"}
        </Button>
      </div>
    </div>
  );
}
