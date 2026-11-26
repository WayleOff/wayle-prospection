"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, CloseButton, Dialog, inputCls } from "./ui";
import { findDuplicates } from "@/lib/duplicates";
import { parseQuickInput } from "@/lib/quick-input";

const REASON = { instagram: "même compte Instagram", phone: "même téléphone", name: "nom proche" } as const;

/** Ajout rapide (touche N) : un nom, un lien Instagram ou Google Maps, un téléphone… puis on complète dans la fiche. */
export function QuickAdd() {
  const { quickAddOpen, setQuickAddOpen } = useApp();
  return (
    <Dialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} variant="modal" label="Ajouter un prospect">
      <QuickAddForm />
    </Dialog>
  );
}

// Monté seulement quand la boîte est ouverte : l'état repart à zéro à chaque ouverture.
function QuickAddForm() {
  const { setQuickAddOpen, ref, prospects, create, toast, archive } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const parsed = useMemo(() => parseQuickInput(text), [text]);
  const dups = useMemo(
    () => (parsed.patch.name || parsed.patch.instagram || parsed.patch.phone
      ? findDuplicates(prospects, { name: parsed.patch.name, instagram: parsed.patch.instagram, phone: parsed.patch.phone })
      : []),
    [parsed, prospects],
  );
  const firstStage = ref.stages.find((s) => s.kind === "open") ?? ref.stages[0];
  const canCreate = !!parsed.patch.name?.trim() || !!parsed.patch.instagram;

  const openFiche = (id: string) => {
    setQuickAddOpen(false);
    const qs = new URLSearchParams(window.location.search);
    qs.set("fiche", id);
    router.push(`${pathname.startsWith("/prospects") || pathname.startsWith("/pipeline") ? pathname : "/prospects"}?${qs.toString()}`);
  };

  const submit = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    const patch = { ...parsed.patch };
    // Un lien Instagram seul : on nomme la fiche d'après le compte, à renommer ensuite.
    const name = patch.name?.trim() || (patch.instagram ?? "").replace(/^@/, "");
    const p = await create({ ...patch, name, stage_id: firstStage.id, category_id: categoryId || null, source: patch.source ?? "Ajout rapide" });
    setBusy(false);
    if (!p) return;
    toast(`« ${p.name} » ajouté`, { undo: () => archive(p.id) });
    openFiche(p.id);
  };

  return (
      <form onSubmit={(e) => { e.preventDefault(); if (dups.length === 0) void submit(); }} className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Nouveau prospect</h2>
          <CloseButton onClick={() => setQuickAddOpen(false)} />
        </div>
        <label className="sr-only" htmlFor="qa-text">Nom, lien Instagram ou Google Maps</label>
        <input id="qa-text" ref={input} className={inputCls} value={text} onChange={(e) => setText(e.target.value.replace(/\n+/g, " "))}
          placeholder="Nom, lien Instagram ou Google Maps, téléphone…" autoComplete="off" />

        {parsed.understood.length > 0 ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Ce qui a été compris">
            {parsed.understood.map((u) => (
              <li key={u} className="inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-1 text-xs"><Check size={12} className="text-accent" aria-hidden /> {u}</li>
            ))}
          </ul>
        ) : <p className="mt-2 text-xs text-muted">Collez un lien ou tapez un nom : je remplis ce que je peux, vous complétez ensuite dans la fiche.</p>}
        {parsed.warnings.map((w) => <p key={w} className="mt-2 text-xs text-muted">{w}</p>)}

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="qa-cat">Catégorie (facultatif)</label>
          <select id="qa-cat" className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">—</option>
            {ref.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {dups.length > 0 ? (
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3" role="alert">
            <p className="flex items-center gap-1.5 text-sm font-medium"><AlertTriangle size={15} aria-hidden /> Ce prospect existe peut-être déjà</p>
            <ul className="mt-2 space-y-1.5">
              {dups.map((d) => (
                <li key={d.prospect.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{d.prospect.name} <span className="text-xs text-muted">· {REASON[d.reason]}</span></span>
                  <Button size="sm" onClick={() => openFiche(d.prospect.id)}>Ouvrir la fiche</Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setQuickAddOpen(false)}>Annuler</Button>
          <Button variant={dups.length ? "secondary" : "primary"} disabled={!canCreate || busy} onClick={() => void submit()}>
            {dups.length ? "Créer quand même" : "Créer et compléter"}
          </Button>
        </div>
      </form>
  );
}
