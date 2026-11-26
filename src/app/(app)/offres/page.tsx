"use client";
import { useState } from "react";
import { FileUp, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { OffersTab } from "@/components/offers-tab";
import { QuotesTab } from "@/components/quotes-tab";
import { InvoicesTab } from "@/components/invoices-tab";

export default function Page() {
  const [tab, setTab] = useState<"devis" | "factures" | "offres">("devis");
  const [newQuote, setNewQuote] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { invoicesReady } = useApp();
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Offres, devis et factures</h1>
        {tab === "devis" ? <Button variant="primary" className="ml-auto" onClick={() => setNewQuote(true)}><Plus size={15} aria-hidden /> Nouveau devis</Button> : null}
        {tab === "factures" ? <Button id="invoice-import-open" variant="primary" disabled={!invoicesReady} className="ml-auto" onClick={() => setImportOpen(true)}><FileUp size={15} aria-hidden /> Importer des factures</Button> : null}
      </div>
      <div role="tablist" aria-label="Offres, devis et factures" className="mt-4 flex gap-1.5">
        {([["devis", "Devis"], ["factures", "Factures"], ["offres", "Offres"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`h-8 rounded-lg px-3 text-[13px] font-medium ${tab === k ? "bg-accent text-accent-fg" : "border border-border bg-surface hover:bg-subtle"}`}>{label}</button>
        ))}
      </div>
      {tab === "devis" ? <QuotesTab newOpen={newQuote} onNewClose={() => setNewQuote(false)} /> : tab === "factures" ? <InvoicesTab importOpen={importOpen} onImportClose={() => setImportOpen(false)} /> : <OffersTab />}
    </div>
  );
}
