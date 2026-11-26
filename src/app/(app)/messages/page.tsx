"use client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MessageComposer } from "@/components/message-composer";
import { SequencesTab } from "@/components/sequences-tab";
import { Button, CloseButton, Dialog, Empty, inputCls } from "@/components/ui";
import { CHANNEL_LABEL, fmtWhen } from "@/lib/labels";
import { VARIABLES, starterTemplates } from "@/lib/message";
import { normText } from "@/lib/normalize";
import type { Channel, SentMessage, Template, TemplateInput, Tone } from "@/lib/types";

const CHANNELS: Channel[] = ["instagram", "email", "linkedin", "phone", "visit", "tiktok"];

export default function Page() {
  const { ref, listTemplates, saveTemplate, deleteTemplate, listMessages, byId } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<"modeles" | "sequences" | "envoyes">("modeles");
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [sent, setSent] = useState<SentMessage[] | null>(null);
  const [editing, setEditing] = useState<TemplateInput | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [composeFor, setComposeFor] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const reloadTemplates = useCallback(() => { listTemplates().then(setTemplates).catch(() => setTemplates([])); }, [listTemplates]);
  useEffect(() => { reloadTemplates(); }, [reloadTemplates]);
  useEffect(() => {
    if (tab !== "envoyes") return;
    let alive = true;
    listMessages(100).then((l) => { if (alive) setSent(l); }).catch(() => { if (alive) setSent([]); });
    return () => { alive = false; };
  }, [tab, listMessages, composeFor]);

  const seed = async () => {
    setSeeding(true);
    for (const t of starterTemplates(ref.categories)) await saveTemplate(t);
    setSeeding(false);
    reloadTemplates();
  };

  const grouped = useMemo(() => CHANNELS.map((c) => ({ c, list: (templates ?? []).filter((t) => t.channel === c) })).filter((g) => g.list.length), [templates]);
  const catName = (id: string | null) => ref.categories.find((c) => c.id === id)?.name;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Messages</h1>
        <div className="ml-auto flex gap-2">
          {tab === "modeles" ? <Button onClick={() => setEditing({ name: "", channel: "instagram", category_id: null, tone: "tu", body: "" })}><Plus size={15} aria-hidden /> Nouveau modèle</Button> : null}
          <Button variant="primary" onClick={() => setPickOpen(true)}><Sparkles size={15} aria-hidden /> Nouveau message</Button>
        </div>
      </div>

      <div role="tablist" aria-label="Messages" className="mt-4 flex gap-1.5">
        {([["modeles", "Modèles"], ["sequences", "Séquences"], ["envoyes", "Envoyés"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`h-8 rounded-lg px-3 text-[13px] font-medium ${tab === k ? "bg-accent text-accent-fg" : "border border-border bg-surface hover:bg-subtle"}`}>{label}</button>
        ))}
      </div>

      {tab === "modeles" ? (
        templates === null ? <p className="mt-6 text-sm text-muted">Chargement…</p>
        : templates.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border">
            <Empty icon={<MessageSquare size={22} />} title="Aucun modèle pour l'instant" text="Les modèles de départ couvrent Instagram, e-mail, LinkedIn, téléphone et visite, en tutoiement et vouvoiement. Tu pourras tous les modifier.">
              <Button variant="primary" onClick={() => void seed()} disabled={seeding}>{seeding ? "Ajout…" : "Ajouter les modèles de départ"}</Button>
            </Empty>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <p className="text-sm text-muted">Variables : {VARIABLES.join(" ")}. Le bouton « Générer un message » d’une fiche choisit le modèle selon le canal et le ton.</p>
            {grouped.map(({ c, list }) => (
              <section key={c} aria-label={CHANNEL_LABEL[c]}>
                <h2 className="mb-2 text-sm font-semibold">{CHANNEL_LABEL[c]}</h2>
                <ul className="space-y-2">
                  {list.map((t) => (
                    <li key={t.id} className="rounded-2xl border border-border bg-surface p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium">{t.name}</h3>
                        <span className="rounded-full bg-subtle px-2 py-0.5 text-xs text-muted">{t.tone === "tu" ? "Tutoiement" : "Vouvoiement"}</span>
                        {catName(t.category_id) ? <span className="rounded-full bg-subtle px-2 py-0.5 text-xs text-muted">{catName(t.category_id)}</span> : null}
                        <div className="ml-auto flex gap-1.5">
                          <Button size="sm" onClick={() => setEditing(t)} aria-label={`Modifier ${t.name}`}><Pencil size={13} aria-hidden /> Modifier</Button>
                          {confirmDel === t.id
                            ? <Button size="sm" variant="danger" onClick={async () => { if (await deleteTemplate(t.id)) { setConfirmDel(null); reloadTemplates(); } }}>Confirmer</Button>
                            : <Button size="sm" variant="danger" onClick={() => setConfirmDel(t.id)} aria-label={`Supprimer ${t.name}`}><Trash2 size={13} aria-hidden /></Button>}
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{t.body}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : tab === "sequences" ? <SequencesTab />
      : sent === null ? <p className="mt-6 text-sm text-muted">Chargement…</p>
      : sent.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border"><Empty icon={<MessageSquare size={22} />} title="Aucun message envoyé" text="Les messages marqués comme envoyés depuis le générateur apparaissent ici." /></div>
      ) : (
        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {sent.map((m) => {
            const pr = byId(m.prospect_id);
            return (
              <li key={m.id}>
                <button type="button" disabled={!pr} onClick={() => router.push(`${pathname}?fiche=${m.prospect_id}`)} className="block w-full px-4 py-3 text-left hover:bg-subtle disabled:hover:bg-transparent">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">{pr?.name ?? "Fiche archivée"}</span>
                    <span className="text-xs text-muted">{CHANNEL_LABEL[m.channel]}{m.written_by_ai ? " · Claude" : ""}</span>
                    <span className="ml-auto text-xs text-muted">{fmtWhen(m.sent_at ?? m.created_at)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted">{m.body}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? <TemplateDialog value={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reloadTemplates(); }} /> : null}
      {pickOpen ? <PickProspect onClose={() => setPickOpen(false)} onPick={(id) => { setPickOpen(false); setComposeFor(id); }} /> : null}
      {composeFor ? <MessageComposer prospectId={composeFor} onClose={() => setComposeFor(null)} /> : null}
    </div>
  );
}

function TemplateDialog({ value, onClose, onSaved }: { value: TemplateInput; onClose: () => void; onSaved: () => void }) {
  const { ref, saveTemplate } = useApp();
  const [t, setT] = useState(value);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const insert = (v: string) => {
    const el = area.current;
    const a = el?.selectionStart ?? t.body.length, b = el?.selectionEnd ?? t.body.length;
    setT({ ...t, body: t.body.slice(0, a) + v + t.body.slice(b) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + v.length, a + v.length); });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!t.name.trim() || !t.body.trim()) return;
    setBusy(true);
    const saved = await saveTemplate({ ...t, name: t.name.trim(), body: t.body.trim() });
    setBusy(false);
    if (saved) onSaved();
  };
  return (
    <Dialog open onClose={onClose} variant="modal" label="Modèle de message">
      <form onSubmit={submit} className="p-5">
        <div className="mb-4 flex items-center"><h2 className="text-base font-semibold">{value.id ? "Modifier le modèle" : "Nouveau modèle"}</h2><div className="ml-auto"><CloseButton onClick={onClose} /></div></div>
        <div className="space-y-3">
          <div>
            <label htmlFor="t-name" className="mb-1 block text-xs font-medium text-muted">Nom</label>
            <input id="t-name" className={inputCls} value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="Instagram · premier message (tu)" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="t-channel" className="mb-1 block text-xs font-medium text-muted">Canal</label>
              <select id="t-channel" className={inputCls} value={t.channel} onChange={(e) => setT({ ...t, channel: e.target.value as Channel })}>{CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}</select>
            </div>
            <div>
              <label htmlFor="t-tone" className="mb-1 block text-xs font-medium text-muted">Ton</label>
              <select id="t-tone" className={inputCls} value={t.tone} onChange={(e) => setT({ ...t, tone: e.target.value as Tone })}><option value="tu">Tutoiement</option><option value="vous">Vouvoiement</option></select>
            </div>
            <div>
              <label htmlFor="t-cat" className="mb-1 block text-xs font-medium text-muted">Catégorie</label>
              <select id="t-cat" className={inputCls} value={t.category_id ?? ""} onChange={(e) => setT({ ...t, category_id: e.target.value || null })}>
                <option value="">Toutes</option>{ref.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="t-body" className="mb-1 block text-xs font-medium text-muted">Texte</label>
            <textarea id="t-body" ref={area} rows={10} value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed hover:border-muted/50" />
            <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Insérer une variable">
              {VARIABLES.map((v) => <button key={v} type="button" onClick={() => insert(v)} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:bg-subtle">{v}</button>)}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button></div>
      </form>
    </Dialog>
  );
}

function PickProspect({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const { prospects, stageName } = useApp();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const n = normText(q) ?? "";
    return prospects.filter((p) => !p.do_not_contact && (!n || (normText(p.name) ?? "").includes(n))).slice(0, 8);
  }, [prospects, q]);
  return (
    <Dialog open onClose={onClose} variant="modal" label="Choisir un prospect">
      <div className="p-5">
        <div className="mb-3 flex items-center"><h2 className="text-base font-semibold">Écrire à…</h2><div className="ml-auto"><CloseButton onClick={onClose} /></div></div>
        <label htmlFor="pick-q" className="sr-only">Rechercher un prospect</label>
        <input id="pick-q" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un prospect" autoFocus />
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {list.length === 0 ? <li className="px-3 py-3 text-sm text-muted">Aucun prospect trouvé.</li> : list.map((p) => (
            <li key={p.id}><button type="button" onClick={() => onPick(p.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-subtle"><span className="min-w-0 flex-1 truncate font-medium">{p.name}</span><span className="shrink-0 text-xs text-muted">{stageName(p.stage_id)}</span></button></li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
