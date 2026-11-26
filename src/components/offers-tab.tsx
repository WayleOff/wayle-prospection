"use client";
import { useState } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, CloseButton, Dialog, Empty, inputCls } from "./ui";
import { STARTER_OFFERS, eurosText, fmtMoney, parseEuros } from "@/lib/quote";
import type { Offer, OfferInput } from "@/lib/types";

/** Catalogue des offres : ce qu'on peut mettre sur un devis. */
export function OffersTab() {
  const { offers, saveOffer, deleteOffer } = useApp();
  const [editing, setEditing] = useState<OfferInput | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const blank: OfferInput = { name: "", description: "", price_cents: 0, is_recurring: false, is_active: true };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted">Les offres se choisissent en un clic quand tu prépares un devis. Le prix reste modifiable devis par devis.</p>
        <Button onClick={() => setEditing(blank)}><Plus size={15} aria-hidden /> Nouvelle offre</Button>
      </div>
      {offers.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border">
          <Empty icon={<Package size={22} />} title="Aucune offre pour l’instant" text="Commence par le reel d’essai à 90 € (tu pourras changer le prix), puis ajoute la collaboration mensuelle avec ton tarif.">
            <Button variant="primary" onClick={async () => { for (const o of STARTER_OFFERS) await saveOffer(o); }}>Ajouter le reel d’essai</Button>
          </Empty>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{o.name}{!o.is_active ? <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-normal text-muted">Désactivée</span> : null}</p>
                {o.description ? <p className="mt-0.5 text-xs text-muted">{o.description}</p> : null}
              </div>
              <p className="text-sm font-medium tabular-nums">{fmtMoney(o.price_cents)}{o.is_recurring ? <span className="font-normal text-muted"> /mois</span> : null}</p>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => setEditing(o)} aria-label={`Modifier ${o.name}`}><Pencil size={13} aria-hidden /> Modifier</Button>
                {confirmDel === o.id
                  ? <Button size="sm" variant="danger" onClick={async () => { if (await deleteOffer(o.id)) setConfirmDel(null); }}>Confirmer</Button>
                  : <Button size="sm" variant="danger" onClick={() => setConfirmDel(o.id)} aria-label={`Supprimer ${o.name}`}><Trash2 size={13} aria-hidden /></Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing ? <OfferDialog value={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function OfferDialog({ value, onClose }: { value: OfferInput | Offer; onClose: () => void }) {
  const { saveOffer } = useApp();
  const [name, setName] = useState(value.name);
  const [description, setDescription] = useState(value.description ?? "");
  const [price, setPrice] = useState(value.id ? eurosText(value.price_cents) : "");
  const [recurring, setRecurring] = useState(value.is_recurring);
  const [active, setActive] = useState(value.is_active);
  const [busy, setBusy] = useState(false);
  const cents = parseEuros(price);
  const valid = name.trim() !== "" && cents != null && cents >= 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || cents == null) return;
    setBusy(true);
    const saved = await saveOffer({ id: value.id, name: name.trim(), description: description.trim() || null, price_cents: cents, is_recurring: recurring, is_active: active });
    setBusy(false);
    if (saved) onClose();
  };

  return (
    <Dialog open onClose={onClose} variant="modal" label="Offre">
      <form onSubmit={submit} className="p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">{value.id ? "Modifier l’offre" : "Nouvelle offre"}</h2><CloseButton onClick={onClose} /></div>
        <div className="space-y-3">
          <div>
            <label htmlFor="of-name" className="mb-1 block text-xs font-medium text-muted">Nom</label>
            <input id="of-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Reel d’essai" required autoFocus />
          </div>
          <div>
            <label htmlFor="of-desc" className="mb-1 block text-xs font-medium text-muted">Description (imprimée sur le devis)</label>
            <textarea id="of-desc" className={`${inputCls} !h-20 py-2`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label htmlFor="of-price" className="mb-1 block text-xs font-medium text-muted">Prix en euros</label>
            <input id="of-price" className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="90" aria-invalid={price !== "" && cents == null} />
            {price !== "" && cents == null ? <p className="mt-1 text-xs text-danger" role="alert">Un montant comme 90 ou 90,50.</p> : null}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Abonnement mensuel (facturé chaque mois)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (proposée dans les devis)</label>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" disabled={!valid || busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button></div>
      </form>
    </Dialog>
  );
}
