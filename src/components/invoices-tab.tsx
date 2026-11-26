"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, FileUp, Receipt, Trash2, TriangleAlert } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, Empty, inputCls } from "./ui";
import { InvoiceImportDialog } from "./invoice-import-dialog";
import { fmtDateFr, fmtMoney } from "@/lib/quote";
import { invoiceStats } from "@/lib/invoice-import";
import { INVOICES_SQL } from "@/lib/migrations";
import { today } from "@/lib/labels";
import type { Invoice } from "@/lib/types";

type Filter = "all" | "unpaid" | "paid";
const KIND_LABEL = { invoice: "", deposit: "Acompte", credit: "Avoir" } as const;

/** Onglet « Factures » : les factures importées de Shine, ce qui est encaissé et ce qui reste à encaisser. */
export function InvoicesTab({ importOpen, onImportClose }: { importOpen: boolean; onImportClose: () => void }) {
  const { invoices, invoicesReady, prospects, byId, updateInvoice, deleteInvoice, toast } = useApp();
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [linkFilter, setLinkFilter] = useState("");

  const stats = useMemo(() => invoiceStats(invoices), [invoices]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return invoices.filter((i) => (filter === "all" || (filter === "paid") === !!i.paid_on) && (!needle || i.number.toLowerCase().includes(needle) || i.client_name.toLowerCase().includes(needle)));
  }, [invoices, filter, q]);
  const options = useMemo(() => {
    const n = linkFilter.trim().toLowerCase();
    return prospects.filter((p) => !n || p.name.toLowerCase().includes(n)).sort((a, b) => a.name.localeCompare(b.name, "fr")).slice(0, 50);
  }, [prospects, linkFilter]);

  if (!invoicesReady) {
    return (
      <div role="alert" className="mt-6 space-y-3 rounded-2xl border border-danger/40 bg-danger/5 p-5 text-sm">
        <p className="flex items-center gap-2 font-medium text-danger"><TriangleAlert size={16} aria-hidden /> La base doit être mise à jour pour les factures et les acomptes</p>
        <p className="text-muted">Dans Supabase, ouvre <strong>SQL Editor</strong>, colle ce SQL et clique sur <strong>Run</strong>. C’est sans risque pour tes données. Recharge ensuite cette page.</p>
        <pre className="max-h-64 overflow-auto rounded-lg bg-surface p-3 text-xs">{INVOICES_SQL}</pre>
        <Button size="sm" onClick={() => { void navigator.clipboard?.writeText(INVOICES_SQL).then(() => toast("SQL copié")); }}><Copy size={13} aria-hidden /> Copier le SQL</Button>
      </div>
    );
  }

  const openFiche = (id: string) => { const qs = new URLSearchParams(sp.toString()); qs.set("fiche", id); router.push(`${pathname}?${qs.toString()}`, { scroll: false }); };
  const pay = (i: Invoice) => void updateInvoice(i.id, { paid_on: i.paid_on ? null : today() });

  return (
    <div className="mt-5">
      {invoices.length > 0 ? (
        <>
          <dl className="grid grid-cols-3 gap-3" data-testid="invoice-stats">
            {([["Facturé", stats.billed, `${stats.count} facture${stats.count > 1 ? "s" : ""}`], ["Encaissé", stats.paid, `${stats.count - stats.unpaidCount} payée${stats.count - stats.unpaidCount > 1 ? "s" : ""}`], ["À encaisser", stats.unpaid, `${stats.unpaidCount} en attente`]] as const).map(([label, v, sub]) => (
              <div key={label} className="rounded-2xl border border-border bg-surface px-4 py-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{fmtMoney(v)}</dd>
                <dd className="text-xs text-muted">{sub}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Filtrer par paiement" className="flex gap-2">
              {([["all", "Toutes"], ["unpaid", "À encaisser"], ["paid", "Payées"]] as [Filter, string][]).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
                  className={`h-8 rounded-lg px-3 text-[13px] ${filter === k ? "bg-accent font-medium text-accent-fg" : "border border-border bg-surface hover:bg-subtle"}`}>{label}</button>
              ))}
            </div>
            <input aria-label="Chercher une facture" className={`${inputCls} !h-8 !w-auto min-w-0 flex-1 basis-40 sm:max-w-60`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Numéro ou client…" />
          </div>
        </>
      ) : null}

      {invoices.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border">
          <Empty icon={<Receipt size={22} />} title="Aucune facture importée" text="Exporte ton rapport de ventes depuis Shine (.csv) et importe-le ici : tu vois ce qui est encaissé, ce qui reste à encaisser, et les factures s’affichent sur la fiche de chaque client.">
            <Button variant="primary" onClick={() => document.getElementById("invoice-import-open")?.click()}><FileUp size={15} aria-hidden /> Importer des factures</Button>
          </Empty>
        </div>
      ) : list.length === 0 ? <p className="mt-4 text-sm text-muted">Aucune facture ne correspond.</p> : (
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
          {list.map((i) => {
            const p = i.prospect_id ? byId(i.prospect_id) : undefined;
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-52">
                  <p className="text-sm font-medium">{i.number}{KIND_LABEL[i.kind] ? <span className="ml-2 rounded-full bg-subtle px-2 py-0.5 text-xs font-normal">{KIND_LABEL[i.kind]}</span> : null} <span className="font-normal text-muted">· {i.issued_on ? fmtDateFr(i.issued_on) : "date inconnue"}</span></p>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {p ? <button type="button" onClick={() => openFiche(p.id)} className="underline-offset-2 hover:text-fg hover:underline">{p.name}</button> : i.client_name}
                    {!p ? <button type="button" className="ml-2 text-xs underline underline-offset-2 hover:text-fg" onClick={() => { setLinking(linking === i.id ? null : i.id); setLinkFilter(""); }} aria-label={`Associer la facture ${i.number} à un prospect`}>Associer à un prospect</button> : null}
                    {p ? <button type="button" className="ml-2 text-xs underline underline-offset-2 hover:text-fg" onClick={() => void updateInvoice(i.id, { prospect_id: null })} aria-label={`Dissocier la facture ${i.number}`}>Dissocier</button> : null}
                  </p>
                </div>
                <p className="text-sm font-medium tabular-nums">{fmtMoney(i.total_cents)}</p>
                <button type="button" onClick={() => pay(i)} aria-label={i.paid_on ? `Marquer la facture ${i.number} comme impayée` : `Marquer la facture ${i.number} comme payée`}
                  className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium ${i.paid_on ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"}`}>
                  {i.paid_on ? <><Check size={13} aria-hidden /> Payée le {fmtDateFr(i.paid_on)}</> : "À encaisser"}
                </button>
                {confirmDel === i.id
                  ? <Button size="sm" variant="danger" onClick={async () => { if (await deleteInvoice(i.id)) setConfirmDel(null); }}>Confirmer</Button>
                  : <Button size="sm" variant="danger" onClick={() => setConfirmDel(i.id)} aria-label={`Supprimer la facture ${i.number}`}><Trash2 size={13} aria-hidden /></Button>}
                {linking === i.id ? (
                  <div className="w-full rounded-xl border border-border p-3">
                    <label htmlFor={`lk-${i.id}`} className="mb-1 block text-xs font-medium text-muted">Prospect pour « {i.client_name} »</label>
                    <input id={`lk-${i.id}`} className={`${inputCls} mb-2`} value={linkFilter} onChange={(e) => setLinkFilter(e.target.value)} placeholder="Chercher un nom…" autoComplete="off" />
                    <select aria-label="Prospect" className={inputCls} size={Math.min(6, Math.max(2, options.length))} value="" onChange={(e) => { if (e.target.value) void updateInvoice(i.id, { prospect_id: e.target.value }).then(() => setLinking(null)); }}>
                      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <InvoiceImportDialog open={importOpen} onClose={onImportClose} />
    </div>
  );
}
