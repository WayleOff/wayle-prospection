"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, inputCls } from "./ui";
import { KIND_LABEL, STAGE_COLORS, moveStage, nameWarnings, renumber, sortStages, stageProblems } from "@/lib/stages";
import type { Stage, StageKind } from "@/lib/types";

/** Colonnes du pipeline : noms, couleurs, ordre, type (en cours / gagné / perdu). */
export function PipelineSettings() {
  const { ref, prospects, saveStages, deleteStage, toast } = useApp();
  const [draft, setDraft] = useState<Stage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const list = draft ?? sortStages(ref.stages);
  const dirty = draft != null;
  const problems = useMemo(() => stageProblems(list), [list]);
  const warnings = useMemo(() => nameWarnings(list), [list]);
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const p of prospects) m.set(p.stage_id, (m.get(p.stage_id) ?? 0) + 1); return m; }, [prospects]);

  const edit = (f: (l: Stage[]) => Stage[]) => setDraft(renumber(f(list)));
  const patch = (id: string, p: Partial<Stage>) => edit((l) => l.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const add = () => edit((l) => {
    // Une nouvelle étape « en cours » se range avant la première étape gagné/perdu.
    const at = l.findIndex((s) => s.kind !== "open");
    const s: Stage = { id: crypto.randomUUID(), name: "", position: 0, kind: "open", color: STAGE_COLORS[l.length % STAGE_COLORS.length] };
    return at < 0 ? [...l, s] : [...l.slice(0, at), s, ...l.slice(at)];
  });

  const save = async () => {
    if (problems.length || busy) return;
    setBusy(true);
    const ok = await saveStages(list.map((s) => ({ ...s, name: s.name.trim() })));
    setBusy(false);
    if (ok) { setDraft(null); toast("Colonnes du pipeline enregistrées"); }
  };

  const startRemove = (id: string) => { setRemoving(id); setTarget(list.find((s) => s.id !== id && s.kind === list.find((x) => x.id === id)!.kind)?.id ?? list.find((s) => s.id !== id)!.id); };
  const confirmRemove = async (id: string) => {
    setBusy(true);
    const ok = await deleteStage(id, target);
    setBusy(false);
    if (ok) { setRemoving(null); toast("Étape supprimée"); }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="p-pipeline">
      <h2 id="p-pipeline" className="text-sm font-semibold">Colonnes du pipeline</h2>
      <p className="mt-2 text-xs text-muted">Renomme, recolore et réordonne les étapes. Le type décide de leur sens : « En cours » pour le travail à faire, « Gagné » et « Perdu » pour les issues.</p>
      <ul className="mt-4 space-y-2">
        {list.map((s, i) => {
          const n = counts.get(s.id) ?? 0;
          const saved = ref.stages.some((x) => x.id === s.id);
          return (
            <li key={s.id} className="rounded-xl border border-border p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <input type="color" aria-label={`Couleur de l’étape ${s.name || i + 1}`} value={/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#64748b"} onChange={(e) => patch(s.id, { color: e.target.value })} className="size-9 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5" />
                <input aria-label={`Nom de l’étape ${i + 1}`} className={`${inputCls} min-w-0 flex-1 basis-36`} value={s.name} placeholder="Nom de l’étape" onChange={(e) => patch(s.id, { name: e.target.value })} maxLength={40} />
                <select aria-label={`Type de l’étape ${s.name || i + 1}`} className={`${inputCls} !w-auto`} value={s.kind} onChange={(e) => patch(s.id, { kind: e.target.value as StageKind })}>
                  {(Object.keys(KIND_LABEL) as StageKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={i === 0} onClick={() => edit((l) => moveStage(l, s.id, -1))} aria-label={`Monter l’étape ${s.name || i + 1}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle disabled:opacity-30"><ArrowUp size={15} aria-hidden /></button>
                  <button type="button" disabled={i === list.length - 1} onClick={() => edit((l) => moveStage(l, s.id, 1))} aria-label={`Descendre l’étape ${s.name || i + 1}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle disabled:opacity-30"><ArrowDown size={15} aria-hidden /></button>
                  {saved ? (
                    <button type="button" disabled={dirty || list.length < 4} onClick={() => startRemove(s.id)} title={dirty ? "Enregistre d’abord tes modifications" : "Supprimer l’étape"} aria-label={`Supprimer l’étape ${s.name || i + 1}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-danger disabled:opacity-30"><Trash2 size={15} aria-hidden /></button>
                  ) : (
                    <button type="button" onClick={() => edit((l) => l.filter((x) => x.id !== s.id))} aria-label="Retirer cette nouvelle étape" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-danger"><Trash2 size={15} aria-hidden /></button>
                  )}
                </div>
              </div>
              {saved ? <p className="mt-1 pl-11 text-xs text-muted">{n} fiche{n > 1 ? "s" : ""}</p> : null}
              {removing === s.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-subtle p-2.5 text-sm">
                  <label htmlFor={`mv-${s.id}`}>{n > 0 ? `Déplacer les ${n} fiche${n > 1 ? "s" : ""} vers` : "Supprimer cette étape vide. Garder une destination par sécurité :"}</label>
                  <select id={`mv-${s.id}`} className={`${inputCls} !w-auto`} value={target} onChange={(e) => setTarget(e.target.value)}>
                    {list.filter((x) => x.id !== s.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => void confirmRemove(s.id)}>Supprimer</Button>
                  <Button size="sm" onClick={() => setRemoving(null)}>Annuler</Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {problems.length > 0 ? <ul role="alert" className="mt-3 space-y-0.5 text-sm text-danger">{problems.map((p) => <li key={p}>{p}</li>)}</ul> : null}
      {dirty && warnings.length > 0 ? <ul className="mt-3 space-y-0.5 text-xs text-muted">{warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={add}><Plus size={15} aria-hidden /> Ajouter une étape</Button>
        <Button variant="primary" disabled={!dirty || problems.length > 0 || busy} onClick={() => void save()}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
        {dirty ? <Button onClick={() => setDraft(null)}>Annuler les modifications</Button> : null}
      </div>
    </section>
  );
}
