"use client";
import { useState } from "react";
import { useApp } from "./app-provider";
import { Button, inputCls } from "./ui";
import type { Company } from "@/lib/types";

const FIELDS: { key: keyof Company; label: string; hint?: string; wide?: boolean }[] = [
  { key: "name", label: "Nom de l’entreprise" },
  { key: "owner", label: "Nom et prénom" },
  { key: "address", label: "Adresse", hint: "Obligatoire sur un devis" },
  { key: "zip_city", label: "Code postal et ville" },
  { key: "siret", label: "SIRET", hint: "Obligatoire sur un devis" },
  { key: "phone", label: "Téléphone" },
  { key: "email", label: "E-mail" },
  { key: "vat_mention", label: "Mention de TVA", hint: "Imprimée sous le total. À faire valider par ton comptable ou ton centre des impôts.", wide: true },
  { key: "payment_terms", label: "Conditions de paiement", wide: true },
];

/** Coordonnées et mentions imprimées sur les devis. */
export function CompanySettings() {
  const { company, saveCompany, toast } = useApp();
  const [draft, setDraft] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);
  const c = draft ?? company;
  const set = (p: Partial<Company>) => setDraft({ ...c, ...p });

  const save = async () => {
    setBusy(true);
    const ok = await saveCompany({ ...c, validity_days: Math.min(365, Math.max(1, Math.round(c.validity_days) || 30)) });
    setBusy(false);
    if (ok) { setDraft(null); toast("Coordonnées enregistrées"); }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="p-company">
      <h2 id="p-company" className="text-sm font-semibold">Mon entreprise (devis)</h2>
      <p className="mt-2 text-xs text-muted">Ces informations sont imprimées sur chaque devis PDF. Un devis doit porter ton SIRET et ton adresse.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
            <label htmlFor={`co-${f.key}`} className="mb-1 block text-xs font-medium text-muted">{f.label}</label>
            <input id={`co-${f.key}`} className={inputCls} value={String(c[f.key])} onChange={(e) => set({ [f.key]: e.target.value } as Partial<Company>)} />
            {f.hint ? <p className="mt-1 text-xs text-muted">{f.hint}</p> : null}
          </div>
        ))}
        <div>
          <label htmlFor="co-validity" className="mb-1 block text-xs font-medium text-muted">Validité d’un devis (jours)</label>
          <input id="co-validity" type="number" min={1} max={365} className={inputCls} value={c.validity_days} onChange={(e) => set({ validity_days: Number(e.target.value) })} />
        </div>
      </div>
      <Button variant="primary" className="mt-4" disabled={!draft || busy} onClick={() => void save()}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
    </section>
  );
}
