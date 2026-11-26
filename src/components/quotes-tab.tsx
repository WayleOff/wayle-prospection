"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Copy, Download, FileText, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, Empty } from "./ui";
import { QuoteDialog, type QuoteDraft } from "./quote-dialog";
import { downloadQuote } from "./quote-download";
import { STATUS_LABEL, STATUS_ORDER, fmtDateFr, fmtMoney, totals } from "@/lib/quote";
import type { Quote, QuoteStatus } from "@/lib/types";

const MIGRATION_SQL = `alter table quotes add column if not exists valid_until date;
alter table quotes add column if not exists notes text;`;

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: "bg-subtle text-muted", sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300", accepted: "bg-green-500/15 text-green-700 dark:text-green-300", refused: "bg-red-500/15 text-red-700 dark:text-red-300",
};
export const amountText = (q: Quote) => { const t = totals(q.lines); return t.monthly !== 0 && t.oneTime !== 0 ? `${fmtMoney(t.oneTime)} + ${fmtMoney(t.monthly)} /mois` : t.monthly !== 0 ? `${fmtMoney(t.monthly)} /mois` : fmtMoney(t.oneTime); };

/** Onglet « Devis » de la page Offres : tous les devis, leur état, leur PDF. */
export function QuotesTab({ newOpen, onNewClose }: { newOpen: boolean; onNewClose: () => void }) {
  const { quotes, quotesReady, byId, company, logo, setQuoteStatus, deleteQuote, toast } = useApp();
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const [filter, setFilter] = useState<QuoteStatus | "">("");
  const [editing, setEditing] = useState<QuoteDraft | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busyPdf, setBusyPdf] = useState<string | null>(null);

  if (!quotesReady) {
    return (
      <div role="alert" className="mt-6 space-y-3 rounded-2xl border border-danger/40 bg-danger/5 p-5 text-sm">
        <p className="flex items-center gap-2 font-medium text-danger"><TriangleAlert size={16} aria-hidden /> La base doit être mise à jour pour les devis</p>
        <p className="text-muted">Dans Supabase, ouvre <strong>SQL Editor</strong>, colle ces deux lignes et clique sur <strong>Run</strong>. C’est sans risque pour tes données. Recharge ensuite cette page.</p>
        <pre className="overflow-x-auto rounded-lg bg-surface p-3 text-xs">{MIGRATION_SQL}</pre>
        <Button size="sm" onClick={() => { void navigator.clipboard?.writeText(MIGRATION_SQL).then(() => toast("SQL copié")); }}><Copy size={13} aria-hidden /> Copier le SQL</Button>
      </div>
    );
  }

  const list = quotes.filter((q) => !filter || q.status === filter);
  const openFiche = (id: string) => { const qs = new URLSearchParams(sp.toString()); qs.set("fiche", id); router.push(`${pathname}?${qs.toString()}`, { scroll: false }); };
  const pdf = async (q: Quote) => {
    const p = byId(q.prospect_id);
    if (!p) return;
    setBusyPdf(q.id);
    try { await downloadQuote(q, p, company, logo); } catch { toast("Le PDF n’a pas pu être créé.", { kind: "error" }); }
    setBusyPdf(null);
  };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par état">
        {([["", "Tous"], ...STATUS_ORDER.map((s) => [s, STATUS_LABEL[s]])] as [QuoteStatus | "", string][]).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
            className={`h-8 rounded-lg px-3 text-[13px] ${filter === k ? "bg-accent font-medium text-accent-fg" : "border border-border bg-surface hover:bg-subtle"}`}>
            {label}{k ? <span className="ml-1 opacity-70">{quotes.filter((q) => q.status === k).length}</span> : null}
          </button>
        ))}
      </div>

      {quotes.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border">
          <Empty icon={<FileText size={22} />} title="Aucun devis pour l’instant" text="Crée un devis depuis la fiche d’un prospect (bouton « Créer un devis ») ou ici. Le PDF se télécharge en un clic.">
            <Button variant="primary" onClick={() => setEditing({ prospect_id: null, lines: [], valid_until: null, notes: null })}><Plus size={15} aria-hidden /> Nouveau devis</Button>
          </Empty>
        </div>
      ) : list.length === 0 ? <p className="mt-4 text-sm text-muted">Aucun devis dans cet état.</p> : (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
          {list.map((q) => {
            const p = byId(q.prospect_id);
            return (
              <li key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-52">
                  <p className="text-sm font-medium">{q.number} <span className="font-normal text-muted">· {fmtDateFr(q.created_at)}</span></p>
                  {p ? <button type="button" onClick={() => openFiche(p.id)} className="mt-0.5 max-w-full truncate text-left text-sm text-muted underline-offset-2 hover:text-fg hover:underline">{p.name}</button>
                    : <p className="mt-0.5 text-sm text-muted">Prospect archivé</p>}
                </div>
                <p className="text-sm font-medium tabular-nums">{amountText(q)}</p>
                <label className="sr-only" htmlFor={`qs-${q.id}`}>État du devis {q.number}</label>
                <select id={`qs-${q.id}`} value={q.status} onChange={(e) => void setQuoteStatus(q.id, e.target.value as QuoteStatus)}
                  className={`h-8 rounded-full border-0 px-3 text-xs font-medium ${STATUS_STYLE[q.status]}`}>
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <div className="flex gap-1.5">
                  <Button size="sm" disabled={!p || busyPdf === q.id} onClick={() => void pdf(q)} aria-label={`Télécharger le PDF du devis ${q.number}`}><Download size={13} aria-hidden /> PDF</Button>
                  {q.status === "draft" ? <Button size="sm" onClick={() => setEditing({ id: q.id, prospect_id: q.prospect_id, lines: q.lines, valid_until: q.valid_until, notes: q.notes, deposit_percent: q.deposit_percent })} aria-label={`Modifier le devis ${q.number}`}><Pencil size={13} aria-hidden /></Button> : null}
                  <Button size="sm" onClick={() => setEditing({ prospect_id: q.prospect_id, lines: q.lines, valid_until: null, notes: q.notes, deposit_percent: q.deposit_percent })} aria-label={`Dupliquer le devis ${q.number}`} title="Dupliquer"><Copy size={13} aria-hidden /></Button>
                  {confirmDel === q.id
                    ? <Button size="sm" variant="danger" onClick={async () => { if (await deleteQuote(q.id)) setConfirmDel(null); }}>Confirmer</Button>
                    : <Button size="sm" variant="danger" onClick={() => setConfirmDel(q.id)} aria-label={`Supprimer le devis ${q.number}`}><Trash2 size={13} aria-hidden /></Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing ? <QuoteDialog value={editing} onClose={() => setEditing(null)} /> : null}
      {newOpen ? <QuoteDialog value={{ prospect_id: null, lines: [], valid_until: null, notes: null }} onClose={onNewClose} /> : null}
    </div>
  );
}
