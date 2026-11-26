"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import Link from "next/link";
import { useApp } from "./app-provider";
import { Button, CloseButton, Dialog, inputCls } from "./ui";
import { downloadQuote } from "./quote-download";
import { addDaysISO, companyGaps, eurosText, fmtMoney, lineFromOffer, parseEuros, parseQty, totals } from "@/lib/quote";
import { today } from "@/lib/labels";
import type { Quote, QuoteLine } from "@/lib/types";

export interface QuoteDraft { id?: string; prospect_id: string | null; lines: QuoteLine[]; valid_until: string | null; notes: string | null }
interface Row { label: string; description: string; qty: string; price: string; recurring: boolean }

const toRow = (l: QuoteLine): Row => ({ label: l.label, description: l.description, qty: String(l.qty).replace(".", ","), price: eurosText(l.unit_cents), recurring: l.recurring });
function fromRow(r: Row): QuoteLine | null {
  const qty = parseQty(r.qty), unit = parseEuros(r.price);
  return r.label.trim() && qty != null && unit != null ? { label: r.label.trim(), description: r.description.trim(), qty, unit_cents: unit, recurring: r.recurring } : null;
}

/** Création ou modification d'un devis (brouillon). Le numéro est attribué à l'enregistrement. */
export function QuoteDialog({ value, onClose }: { value: QuoteDraft; onClose: () => void }) {
  const { prospects, offers, company, createQuote, updateQuote, byId, toast } = useApp();
  const [prospectId, setProspectId] = useState(value.prospect_id ?? "");
  const [filter, setFilter] = useState("");
  const [rows, setRows] = useState<Row[]>(value.lines.map(toRow));
  const [validUntil, setValidUntil] = useState(value.valid_until ?? addDaysISO(today(), company.validity_days));
  const [notes, setNotes] = useState(value.notes ?? "");
  const [busy, setBusy] = useState(false);

  const parsed = rows.map(fromRow);
  const allValid = rows.length > 0 && parsed.every(Boolean);
  const lines = parsed.filter((l): l is QuoteLine => !!l);
  const t = totals(lines);
  const gaps = companyGaps(company);
  const prospect = prospectId ? byId(prospectId) : undefined;
  const patch = (i: number, p: Partial<Row>) => setRows((l) => l.map((r, k) => (k === i ? { ...r, ...p } : r)));
  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return prospects.filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, "fr")).slice(0, 200);
  }, [prospects, filter]);

  const save = async (pdf: boolean) => {
    if (!allValid || !prospectId || busy) return;
    setBusy(true);
    const input = { lines, valid_until: validUntil || null, notes: notes.trim() || null };
    const saved: Quote | null = value.id ? await updateQuote(value.id, input) : await createQuote({ prospect_id: prospectId, ...input });
    if (saved && pdf && prospect) {
      try { await downloadQuote(saved, prospect, company); } catch { toast("Devis enregistré, mais le PDF n’a pas pu être créé.", { kind: "error" }); }
    }
    setBusy(false);
    if (saved) { if (!pdf) toast(`Devis ${saved.number} enregistré`); onClose(); }
  };

  return (
    <Dialog open onClose={onClose} variant="drawer" label="Devis">
      <div className="flex h-full flex-col">
        <div className="flex items-center border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">{value.id ? "Modifier le devis" : "Nouveau devis"}</h2>
          <div className="ml-auto"><CloseButton onClick={onClose} /></div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {value.prospect_id ? (
            <p className="text-sm"><span className="text-muted">Pour </span><strong>{prospect?.name}</strong></p>
          ) : (
            <div>
              <label htmlFor="qd-filter" className="mb-1 block text-xs font-medium text-muted">Prospect</label>
              <input id="qd-filter" className={`${inputCls} mb-2`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Chercher un nom…" autoComplete="off" />
              <select id="qd-prospect" aria-label="Prospect" className={inputCls} value={prospectId} onChange={(e) => setProspectId(e.target.value)} size={Math.min(6, Math.max(2, options.length))}>
                {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <fieldset className="space-y-3">
            <legend className="mb-1 text-xs font-medium text-muted">Lignes du devis</legend>
            {rows.map((r, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`ql-l-${i}`} className="mb-1 block text-xs text-muted">Désignation</label>
                    <input id={`ql-l-${i}`} className={inputCls} value={r.label} onChange={(e) => patch(i, { label: e.target.value })} />
                  </div>
                  <button type="button" onClick={() => setRows((l) => l.filter((_, k) => k !== i))} aria-label={`Retirer la ligne ${i + 1}`}
                    className="mb-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-danger"><X size={15} aria-hidden /></button>
                </div>
                <div>
                  <label htmlFor={`ql-d-${i}`} className="mb-1 block text-xs text-muted">Description (facultative)</label>
                  <textarea id={`ql-d-${i}`} className={`${inputCls} !h-16 py-2`} value={r.description} onChange={(e) => patch(i, { description: e.target.value })} />
                </div>
                <div className="grid grid-cols-[5rem_1fr] items-end gap-2">
                  <div>
                    <label htmlFor={`ql-q-${i}`} className="mb-1 block text-xs text-muted">Quantité</label>
                    <input id={`ql-q-${i}`} className={inputCls} inputMode="decimal" value={r.qty} onChange={(e) => patch(i, { qty: e.target.value })} aria-invalid={parseQty(r.qty) == null} />
                  </div>
                  <div>
                    <label htmlFor={`ql-p-${i}`} className="mb-1 block text-xs text-muted">Prix unitaire (€)</label>
                    <input id={`ql-p-${i}`} className={inputCls} inputMode="decimal" value={r.price} onChange={(e) => patch(i, { price: e.target.value })} aria-invalid={parseEuros(r.price) == null} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={r.recurring} onChange={(e) => patch(i, { recurring: e.target.checked })} /> Facturé chaque mois</label>
                  <span className="text-sm tabular-nums text-muted">{parsed[i] ? fmtMoney(Math.round(parsed[i]!.qty * parsed[i]!.unit_cents)) : "—"}</span>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {offers.filter((o) => o.is_active).length > 0 ? (
                <select aria-label="Ajouter une offre" className={`${inputCls} !w-auto min-w-0 max-w-60`} value="" onChange={(e) => { const o = offers.find((x) => x.id === e.target.value); if (o) setRows((l) => [...l, toRow(lineFromOffer(o))]); }}>
                  <option value="">+ Ajouter une offre…</option>
                  {offers.filter((o) => o.is_active).map((o) => <option key={o.id} value={o.id}>{o.name} · {fmtMoney(o.price_cents)}{o.is_recurring ? " /mois" : ""}</option>)}
                </select>
              ) : null}
              <Button onClick={() => setRows((l) => [...l, { label: "", description: "", qty: "1", price: "", recurring: false }])}><Plus size={15} aria-hidden /> Ligne libre</Button>
            </div>
            {rows.length === 0 ? <p className="text-xs text-muted">Ajoute au moins une ligne. Un prix négatif sert de remise.</p> : null}
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="qd-valid" className="mb-1 block text-xs font-medium text-muted">Valable jusqu’au</label>
              <input id="qd-valid" type="date" className={inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="qd-notes" className="mb-1 block text-xs font-medium text-muted">Remarques (imprimées sur le devis)</label>
            <textarea id="qd-notes" className={`${inputCls} !h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {gaps.length > 0 ? (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="status">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
              <span>Il manque {gaps.join(" et ")} dans tes coordonnées : ils sont obligatoires sur un devis. <Link href="/parametres" className="underline">Les renseigner dans Paramètres</Link></span>
            </p>
          ) : null}
        </div>
        <div className="border-t border-border px-5 py-3">
          <p className="mb-2 text-right text-sm" data-testid="quote-total">
            {t.monthly !== 0 && t.oneTime !== 0 ? <>Total ponctuel <strong>{fmtMoney(t.oneTime)}</strong> · <strong>{fmtMoney(t.monthly)}</strong> /mois</>
              : t.monthly !== 0 ? <>Total <strong>{fmtMoney(t.monthly)}</strong> /mois</> : <>Total <strong>{fmtMoney(t.oneTime)}</strong></>}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={onClose}>Annuler</Button>
            <Button disabled={!allValid || !prospectId || busy} onClick={() => void save(false)}>Enregistrer</Button>
            <Button variant="primary" disabled={!allValid || !prospectId || busy} onClick={() => void save(true)}>{busy ? "Enregistrement…" : "Enregistrer et télécharger le PDF"}</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
