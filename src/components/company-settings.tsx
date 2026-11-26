"use client";
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, inputCls } from "./ui";
import { loadLogo } from "@/lib/logo";
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
  const { company, saveCompany, logo, saveLogo, toast } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState("");
  const [draft, setDraft] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);
  const c = draft ?? company;
  const set = (p: Partial<Company>) => setDraft({ ...c, ...p });

  const save = async () => {
    setBusy(true);
    const ok = await saveCompany({ ...c, validity_days: Math.min(365, Math.max(1, Math.round(c.validity_days) || 30)), default_deposit_percent: Math.min(100, Math.max(0, Math.round(c.default_deposit_percent) || 0)) });
    setBusy(false);
    if (ok) { setDraft(null); toast("Coordonnées enregistrées"); }
  };

  const pickLogo = async (f: File) => {
    setLogoError("");
    try { const l = await loadLogo(f); if (await saveLogo(l)) toast("Logo enregistré"); }
    catch (e) { setLogoError(e instanceof Error ? e.message : "Logo illisible."); }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="p-company">
      <h2 id="p-company" className="text-sm font-semibold">Mon entreprise (devis)</h2>
      <p className="mt-2 text-xs text-muted">Ces informations sont imprimées sur chaque devis PDF. Un devis doit porter ton SIRET et ton adresse.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-40 place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo.data_url} alt="Logo imprimé sur les devis" className="max-h-14 max-w-36 object-contain" data-testid="logo-preview" /> : <span className="text-xs text-muted">Pas de logo</span>}
        </div>
        <div>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg" className="sr-only" aria-label="Choisir un logo"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickLogo(f); e.target.value = ""; }} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => fileInput.current?.click()}><ImagePlus size={15} aria-hidden /> {logo ? "Changer le logo" : "Choisir un logo"}</Button>
            {logo ? <Button variant="danger" onClick={() => void saveLogo(null).then((ok) => ok && toast("Logo retiré"))}><Trash2 size={14} aria-hidden /> Retirer</Button> : null}
          </div>
          <p className="mt-1.5 text-xs text-muted">Imprimé en haut à gauche des devis. PNG, JPEG, WebP ou SVG ; fond transparent conseillé.</p>
          {logoError ? <p role="alert" className="mt-1 text-sm text-danger">{logoError}</p> : null}
        </div>
      </div>
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
        <div>
          <label htmlFor="co-deposit" className="mb-1 block text-xs font-medium text-muted">Acompte proposé par défaut (%)</label>
          <input id="co-deposit" type="number" min={0} max={100} className={inputCls} value={c.default_deposit_percent} onChange={(e) => set({ default_deposit_percent: Number(e.target.value) })} />
          <p className="mt-1 text-xs text-muted">Modifiable sur chaque devis. 0 = aucun acompte.</p>
        </div>
      </div>
      <Button variant="primary" className="mt-4" disabled={!draft || busy} onClick={() => void save()}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
    </section>
  );
}
