"use client";
import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Repeat, TriangleAlert, Trash2, X } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, CloseButton, Dialog, Empty, inputCls } from "./ui";
import { CHANNEL_LABEL } from "@/lib/labels";
import { ACTIONS, ACTION_LABEL, isMessageAction, normalizeSteps, sortSteps, starterSequence, stepText } from "@/lib/sequence";
import type { Channel, SequenceInput, SequenceStep, StepAction, Template } from "@/lib/types";

const CHANNELS: Channel[] = ["instagram", "email", "linkedin", "phone", "visit", "tiktok"];

const MIGRATION_SQL = `alter table sequence_steps add column if not exists label text;
create unique index if not exists sequence_runs_one_running on sequence_runs (prospect_id) where status = 'running';`;

/** Onglet « Séquences » de la page Messages : parcours de relance (ex. J0 message → J+3 relance → J+7 visite → J+14 dernier message). */
export function SequencesTab() {
  const { sequences, sequencesReady, runs, listTemplates, saveSequence, deleteSequence, toast } = useApp();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<SequenceInput | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  useEffect(() => { listTemplates().then(setTemplates).catch(() => setTemplates([])); }, [listTemplates]);

  if (!sequencesReady) {
    return (
      <div role="alert" className="mt-6 space-y-3 rounded-2xl border border-danger/40 bg-danger/5 p-5 text-sm">
        <p className="flex items-center gap-2 font-medium text-danger"><TriangleAlert size={16} aria-hidden /> La base doit être mise à jour pour les séquences</p>
        <p className="text-muted">Dans Supabase, ouvre <strong>SQL Editor</strong>, colle ces deux lignes et clique sur <strong>Run</strong>. C’est sans risque et sans effet sur tes données. Recharge ensuite cette page.</p>
        <pre className="overflow-x-auto rounded-lg bg-surface p-3 text-xs">{MIGRATION_SQL}</pre>
        <Button size="sm" onClick={() => { void navigator.clipboard?.writeText(MIGRATION_SQL).then(() => toast("SQL copié")); }}><Copy size={13} aria-hidden /> Copier le SQL</Button>
      </div>
    );
  }

  const inProgress = (id: string) => runs.filter((r) => r.sequence_id === id).length;
  const blank: SequenceInput = { name: "", is_active: true, steps: [{ step_no: 1, day_offset: 0, action: "first_contact", channel: "instagram", label: "Premier message", template_id: null }] };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted">Une séquence programme automatiquement la suite dans « Aujourd’hui » et s’arrête dès que le prospect répond.</p>
        <Button onClick={() => setEditing(blank)}><Plus size={15} aria-hidden /> Nouvelle séquence</Button>
      </div>

      {sequences.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border">
          <Empty icon={<Repeat size={22} />} title="Aucune séquence" text="La séquence de départ enchaîne un premier message, une relance courte à J+3, une visite ou un appel à J+7 et un dernier message à J+14. Tu peux la modifier ensuite.">
            <Button variant="primary" onClick={async () => { await saveSequence(starterSequence(templates)); }}>Ajouter la séquence de départ</Button>
          </Empty>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {sequences.map((q) => (
            <li key={q.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">{q.name}</h3>
                {!q.is_active ? <span className="rounded-full bg-subtle px-2 py-0.5 text-xs text-muted">Désactivée</span> : null}
                <span className="text-xs text-muted">{inProgress(q.id)} en cours</span>
                <div className="ml-auto flex gap-1.5">
                  <Button size="sm" onClick={() => setEditing({ id: q.id, name: q.name, is_active: q.is_active, steps: q.steps })} aria-label={`Modifier ${q.name}`}><Pencil size={13} aria-hidden /> Modifier</Button>
                  {confirmDel === q.id
                    ? <Button size="sm" variant="danger" onClick={async () => { if (await deleteSequence(q.id)) setConfirmDel(null); }}>Confirmer</Button>
                    : <Button size="sm" variant="danger" onClick={() => setConfirmDel(q.id)} aria-label={`Supprimer ${q.name}`}><Trash2 size={13} aria-hidden /></Button>}
                </div>
              </div>
              <ol className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm">
                {sortSteps(q.steps).map((s, i) => (
                  <li key={s.step_no} className="flex items-center gap-1.5">
                    {i > 0 ? <span className="text-muted" aria-hidden>→</span> : null}
                    <span className="rounded-lg bg-subtle px-2 py-1">{stepText(s)}</span>
                  </li>
                ))}
              </ol>
              {confirmDel === q.id && inProgress(q.id) > 0 ? <p className="mt-2 text-xs text-danger">{inProgress(q.id)} prospect(s) sont en cours de séquence : elle sera arrêtée pour eux.</p> : null}
            </li>
          ))}
        </ul>
      )}

      {editing ? <SequenceDialog value={editing} templates={templates} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function SequenceDialog({ value, templates, onClose }: { value: SequenceInput; templates: Template[]; onClose: () => void }) {
  const { saveSequence } = useApp();
  const [name, setName] = useState(value.name);
  const [active, setActive] = useState(value.is_active);
  const [steps, setSteps] = useState<SequenceStep[]>(sortSteps(value.steps));
  const [busy, setBusy] = useState(false);
  const patch = (i: number, p: Partial<SequenceStep>) => setSteps((l) => l.map((s, k) => (k === i ? { ...s, ...p } : s)));
  const valid = name.trim() !== "" && steps.length > 0;
  const forChannel = useMemo(() => (c: Channel | null) => templates.filter((t) => !c || t.channel === c), [templates]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    const saved = await saveSequence({ id: value.id, name: name.trim(), is_active: active, steps: normalizeSteps(steps) });
    setBusy(false);
    if (saved) onClose();
  };

  return (
    <Dialog open onClose={onClose} variant="drawer" label="Séquence de relance">
      <form onSubmit={submit} className="flex h-full flex-col">
        <div className="flex items-center border-b border-border px-5 py-3"><h2 className="text-base font-semibold">{value.id ? "Modifier la séquence" : "Nouvelle séquence"}</h2><div className="ml-auto"><CloseButton onClick={onClose} /></div></div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label htmlFor="sq-name" className="mb-1 block text-xs font-medium text-muted">Nom</label>
            <input id="sq-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Relance standard (commerces)" required />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (proposée au moment d’envoyer un message)</label>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-xs font-medium text-muted">Étapes (jours à partir du lancement)</legend>
            {steps.map((s, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex items-end gap-2">
                  <div className="w-20">
                    <label htmlFor={`sq-d-${i}`} className="mb-1 block text-xs text-muted">Jour</label>
                    <input id={`sq-d-${i}`} type="number" min={0} max={365} inputMode="numeric" className={inputCls} value={s.day_offset}
                      onChange={(e) => patch(i, { day_offset: Math.max(0, Math.min(365, Math.round(Number(e.target.value) || 0))) })} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`sq-a-${i}`} className="mb-1 block text-xs text-muted">Action</label>
                    <select id={`sq-a-${i}`} className={inputCls} value={s.action} onChange={(e) => { const a = e.target.value as StepAction; patch(i, { action: a, label: s.label === ACTION_LABEL[s.action] ? ACTION_LABEL[a] : s.label, template_id: isMessageAction(a) ? s.template_id : null }); }}>
                      {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => setSteps((l) => l.filter((_, k) => k !== i))} disabled={steps.length === 1} aria-label={`Retirer l'étape ${i + 1}`}
                    className="mb-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-danger disabled:opacity-40"><X size={15} aria-hidden /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={`sq-l-${i}`} className="mb-1 block text-xs text-muted">Libellé dans « Aujourd’hui »</label>
                    <input id={`sq-l-${i}`} className={inputCls} value={s.label} onChange={(e) => patch(i, { label: e.target.value })} placeholder={ACTION_LABEL[s.action]} />
                  </div>
                  <div>
                    <label htmlFor={`sq-c-${i}`} className="mb-1 block text-xs text-muted">Canal</label>
                    <select id={`sq-c-${i}`} className={inputCls} value={s.channel ?? ""} onChange={(e) => patch(i, { channel: (e.target.value || null) as Channel | null, template_id: null })}>
                      <option value="">—</option>{CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
                    </select>
                  </div>
                </div>
                {isMessageAction(s.action) ? (
                  <div>
                    <label htmlFor={`sq-t-${i}`} className="mb-1 block text-xs text-muted">Modèle de message</label>
                    <select id={`sq-t-${i}`} className={inputCls} value={s.template_id ?? ""} onChange={(e) => patch(i, { template_id: e.target.value || null })}>
                      <option value="">Automatique (selon le libellé, le canal et le ton)</option>
                      {forChannel(s.channel).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                ) : null}
              </div>
            ))}
            <Button onClick={() => setSteps((l) => [...l, { step_no: l.length + 1, day_offset: (l[l.length - 1]?.day_offset ?? 0) + 3, action: "follow_up", channel: l[l.length - 1]?.channel ?? "instagram", label: "Relance", template_id: null }])}><Plus size={15} aria-hidden /> Ajouter une étape</Button>
          </fieldset>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3"><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" disabled={!valid || busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button></div>
      </form>
    </Dialog>
  );
}
