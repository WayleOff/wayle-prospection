"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Archive, CalendarClock, CheckCheck, ExternalLink, MessageSquareText, Phone, Send, Trash2 } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, CloseButton, Dialog, Dot, inputCls } from "./ui";
import { MessageComposer } from "./message-composer";
import { stepText } from "@/lib/sequence";
import { ACTIVITY_LABEL, CHANNEL_LABEL, DISTRICT_LABEL, HEAT_COLOR, HEAT_LABEL, IG_LABEL, addDays, fmtDue, fmtEuros, fmtWhen } from "@/lib/labels";
import { instagramUrl, telHref } from "@/lib/normalize";
import type { Activity, Channel, District, Heat, IgActivity, Prospect, ProspectPatch } from "@/lib/types";

/** Fiche prospect : panneau latéral ouvert par ?fiche=<id>, champs enregistrés à la sortie du champ. */
export function ProspectSheet() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = sp.get("fiche");
  const { byId } = useApp();
  const prospect = id ? byId(id) : undefined;

  const close = useCallback(() => {
    const qs = new URLSearchParams(sp.toString());
    qs.delete("fiche");
    const s = qs.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [sp, pathname, router]);

  return (
    <Dialog open={!!id} onClose={() => { if (id) close(); }} variant="drawer" label="Fiche prospect">
      {prospect ? <Sheet key={prospect.id} p={prospect} onClose={close} />
        : <div className="p-6"><div className="mb-4 flex justify-end"><CloseButton onClick={close} /></div><p className="text-sm text-muted">Cette fiche n’existe pas ou a été archivée.</p></div>}
    </Dialog>
  );
}

function Label({ text, children, htmlFor }: { text: string; children: ReactNode; htmlFor?: string }) {
  return <div><label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted">{text}</label>{children}</div>;
}

/** Champ texte : on garde la saisie localement et on enregistre quand on quitte le champ. */
function Text({ id, label, value, onSave, type = "text", multiline, placeholder, inputMode }: {
  id: string; label: string; value: string | null; onSave: (v: string | null) => void; type?: string; multiline?: boolean; placeholder?: string; inputMode?: "numeric" | "tel" | "email" | "url" | "text";
}) {
  const [v, setV] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setV(value ?? ""); } // la fiche a changé ailleurs : on suit
  const commit = () => { const n = v.trim() === "" ? null : v.trim(); if (n !== (value ?? null)) onSave(n); };
  return (
    <Label text={label} htmlFor={id}>
      {multiline
        ? <textarea id={id} rows={3} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted/70 hover:border-muted/50" />
        : <input id={id} type={type} inputMode={inputMode} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className={inputCls} />}
    </Label>
  );
}

function Pick<T extends string>({ id, label, value, options, onChange, empty }: {
  id: string; label: string; value: T | null; options: { value: T; label: string }[]; onChange: (v: T | null) => void; empty?: string;
}) {
  return (
    <Label text={label} htmlFor={id}>
      <select id={id} value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as T | null)} className={inputCls}>
        {empty !== undefined ? <option value="">{empty}</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Label>
  );
}

const SECTION = "text-[11px] font-semibold uppercase tracking-wide text-muted";

/** Séquence de relance du prospect : lancer, marquer l'étape faite, arrêter. */
function SequenceBlock({ p }: { p: Prospect }) {
  const { sequences, sequencesReady, runFor, startSequence, completeStep, stopSequence, toast } = useApp();
  const active = sequences.filter((q) => q.is_active && q.steps.length > 0);
  const [pick, setPick] = useState("");
  if (!sequencesReady) return null;
  const rf = runFor(p.id);
  const chosen = pick || active[0]?.id || "";
  return (
    <div className="rounded-xl border border-border p-3" role="group" aria-label="Séquence de relance">
      <div className="mb-1.5 text-xs font-medium text-muted">Séquence de relance</div>
      {rf ? (
        <div className="space-y-2">
          <p className="text-sm">« {rf.seq.name} » · étape {rf.index}/{rf.total}{rf.step ? <> : <span className="font-medium">{stepText(rf.step)}</span></> : null}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={async () => { const undo = await completeStep(p.id); if (undo) toast("Étape faite, suite programmée", { undo }); }}><CheckCheck size={14} aria-hidden /> Étape faite</Button>
            <Button size="sm" variant="danger" onClick={() => void stopSequence(p.id)}>Arrêter la séquence</Button>
          </div>
        </div>
      ) : active.length === 0 ? (
        <p className="text-sm text-muted">Aucune séquence active. Crée-en une dans Messages → Séquences.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="f-seq" className="sr-only">Séquence à lancer</label>
          <select id="f-seq" className={`${inputCls} !w-auto min-w-0 flex-1`} value={chosen} onChange={(e) => setPick(e.target.value)}>
            {active.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          <Button size="sm" onClick={() => void startSequence(p.id, chosen)}>Lancer</Button>
        </div>
      )}
    </div>
  );
}

function Sheet({ p, onClose }: { p: Prospect; onClose: () => void }) {
  const app = useApp();
  const { ref, update, setTags, moveStage, archive, addActivity, toast } = app;
  const save = (patch: ProspectPatch) => update(p.id, patch);
  const [relance, setRelance] = useState(false);
  const [compose, setCompose] = useState(false);

  useEffect(() => {
    const open = () => setRelance((v) => !v);
    const message = () => setCompose(true);
    window.addEventListener("wayle:relance", open);
    window.addEventListener("wayle:message", message);
    return () => { window.removeEventListener("wayle:relance", open); window.removeEventListener("wayle:message", message); };
  }, []);

  const ig = instagramUrl(p.instagram);
  const tel = telHref(p.phone);
  const due = fmtDue(p.next_action_at);
  const stage = ref.stages.find((s) => s.id === p.stage_id);

  const planRelance = (days: number) => {
    const before = { next_action_at: p.next_action_at, next_action_label: p.next_action_label };
    setRelance(false);
    void save({ next_action_at: addDays(days), next_action_label: "Relancer" });
    toast(`Relance prévue ${days === 1 ? "demain" : `dans ${days} jours`}`, { undo: () => save(before) });
  };

  const markVisited = async () => {
    const a = await addActivity(p.id, { kind: "visit", channel: "visit", body: "Passage sur place" });
    if (a) toast("Visite enregistrée", { undo: () => app.deleteActivity(a.id) });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-2 border-b border-border px-5 py-3">
        <div className="min-w-0 flex-1">
          <Text id="f-name" label="Nom" value={p.name} onSave={(v) => { if (v) void save({ name: v }); }} />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {stage ? <span className="inline-flex items-center gap-1.5"><Dot color={stage.color} /> {stage.name}</span> : null}
            <span className="inline-flex items-center gap-1.5"><Dot color={HEAT_COLOR[p.heat]} /> {HEAT_LABEL[p.heat]}</span>
            <span title="Calculé automatiquement d’après la fiche">Score {p.score}</span>
            {due ? <span className={due.late ? "font-medium text-danger" : ""}>{p.next_action_label ?? "Action"} · {due.text}</span> : null}
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        {/* Actions rapides */}
        <div className="flex flex-wrap gap-2">
          {ig ? <a href={ig} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium hover:bg-subtle"><ExternalLink size={15} aria-hidden /> Ouvrir Instagram</a>
            : <Button disabled title="Aucun compte Instagram renseigné"><ExternalLink size={15} aria-hidden /> Ouvrir Instagram</Button>}
          {tel ? <a href={tel} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium hover:bg-subtle"><Phone size={15} aria-hidden /> Appeler</a>
            : <Button disabled title="Aucun téléphone renseigné"><Phone size={15} aria-hidden /> Appeler</Button>}
          <Button variant="primary" onClick={() => setCompose(true)}><MessageSquareText size={15} aria-hidden /> Générer un message</Button>
          <div className="relative">
            <Button onClick={() => setRelance((v) => !v)} aria-expanded={relance}><CalendarClock size={15} aria-hidden /> Planifier une relance</Button>
            {relance ? (
              <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-xl border border-border bg-surface p-1.5 shadow-lg" role="menu">
                {[2, 7, 14].map((d) => <Button key={d} size="sm" role="menuitem" onClick={() => planRelance(d)}>+{d} j</Button>)}
              </div>
            ) : null}
          </div>
          <Button onClick={() => void markVisited()}><CheckCheck size={15} aria-hidden /> Marquer visité</Button>
        </div>

        {/* Suivi */}
        <section aria-labelledby="s-suivi" className="space-y-3">
          <h3 id="s-suivi" className={SECTION}>Suivi</h3>
          <div className="grid grid-cols-2 gap-3">
            <Pick id="f-stage" label="Étape" value={p.stage_id} options={ref.stages.map((s) => ({ value: s.id, label: s.name }))} onChange={(v) => { if (v) void moveStage(p.id, v); }} />
            <Pick<Heat> id="f-heat" label="Température" value={p.heat} options={(["cold", "warm", "hot"] as const).map((h) => ({ value: h, label: HEAT_LABEL[h] }))} onChange={(v) => { if (v) void save({ heat: v }); }} />
            <Pick id="f-cat" label="Catégorie" value={p.category_id} empty="—" options={ref.categories.map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => void save({ category_id: v })} />
            <Pick id="f-owner" label="Responsable" value={p.owner_id} empty="Personne" options={ref.profiles.map((x) => ({ value: x.id, label: x.name }))} onChange={(v) => void save({ owner_id: v })} />
            <Text id="f-next" label="Prochaine action" value={p.next_action_label} onSave={(v) => void save({ next_action_label: v })} placeholder="Ex. Relancer par message" />
            <Label text="Pour le" htmlFor="f-next-at">
              <input id="f-next-at" type="date" value={p.next_action_at ?? ""} onChange={(e) => void save({ next_action_at: e.target.value || null })} className={inputCls} />
            </Label>
          </div>
          <SequenceBlock p={p} />
          <div>
            <div className="mb-1 text-xs font-medium text-muted">Étiquettes</div>
            <div className="flex flex-wrap gap-1.5">
              {ref.tags.map((t) => {
                const on = p.tag_ids.includes(t.id);
                return (
                  <button key={t.id} type="button" aria-pressed={on}
                    onClick={() => void setTags(p.id, on ? p.tag_ids.filter((x) => x !== t.id) : [...p.tag_ids, t.id])}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs ${on ? "border-transparent bg-subtle font-medium" : "border-border text-muted hover:bg-subtle"}`}>
                    <Dot color={t.color} size={7} /> {t.name}
                  </button>
                );
              })}
              {ref.tags.length === 0 ? <span className="text-xs text-muted">Aucune étiquette définie.</span> : null}
            </div>
          </div>
        </section>

        {/* Coordonnées */}
        <section aria-labelledby="s-coord" className="space-y-3">
          <h3 id="s-coord" className={SECTION}>Coordonnées</h3>
          <div className="grid grid-cols-2 gap-3">
            <Text id="f-ig" label="Instagram" value={p.instagram} onSave={(v) => void save({ instagram: v })} placeholder="@compte" />
            <Text id="f-phone" label="Téléphone" value={p.phone} onSave={(v) => void save({ phone: v })} type="tel" inputMode="tel" />
            <Text id="f-email" label="E-mail" value={p.email} onSave={(v) => void save({ email: v })} type="email" inputMode="email" />
            <Text id="f-web" label="Site web" value={p.website} onSave={(v) => void save({ website: v })} inputMode="url" />
            <Text id="f-fn" label="Prénom du contact" value={p.contact_first_name} onSave={(v) => void save({ contact_first_name: v })} />
            <Text id="f-ln" label="Nom du contact" value={p.contact_last_name} onSave={(v) => void save({ contact_last_name: v })} />
            <Pick<Channel> id="f-chan" label="Canal préféré" value={p.preferred_channel} empty="—" options={(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))} onChange={(v) => void save({ preferred_channel: v })} />
            <Pick<District> id="f-dist" label="Quartier" value={p.district} empty="—" options={(Object.keys(DISTRICT_LABEL) as District[]).map((d) => ({ value: d, label: DISTRICT_LABEL[d] }))} onChange={(v) => void save({ district: v })} />
          </div>
          <Text id="f-addr" label="Adresse" value={p.address} onSave={(v) => void save({ address: v })} />
        </section>

        {/* Profil */}
        <section aria-labelledby="s-profil" className="space-y-3">
          <h3 id="s-profil" className={SECTION}>Profil</h3>
          <Text id="f-high" label="Points d’accroche" value={p.highlights} onSave={(v) => void save({ highlights: v })} multiline placeholder="Ce qui rend ce prospect intéressant, pour personnaliser le message" />
          <div className="grid grid-cols-2 gap-3">
            <Pick<IgActivity> id="f-iga" label="Activité Instagram" value={p.ig_activity} empty="—" options={(Object.keys(IG_LABEL) as IgActivity[]).map((k) => ({ value: k, label: IG_LABEL[k] }))} onChange={(v) => void save({ ig_activity: v })} />
            <Text id="f-amount" label="Montant estimé (€)" value={p.est_amount_cents == null ? null : String(Math.round(p.est_amount_cents / 100))} inputMode="numeric"
              onSave={(v) => { const n = v == null ? null : Number(v.replace(/\s/g, "").replace(",", ".")); void save({ est_amount_cents: n == null || Number.isNaN(n) ? null : Math.round(n * 100) }); }} placeholder={p.est_amount_cents ? fmtEuros(p.est_amount_cents) : ""} />
            <Text id="f-src" label="Source" value={p.source} onSave={(v) => void save({ source: v })} />
            <Label text="Ouverture" htmlFor="f-open"><input id="f-open" type="date" value={p.opened_on ?? ""} onChange={(e) => void save({ opened_on: e.target.value || null })} className={inputCls} /></Label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.is_independent} onChange={(e) => void save({ is_independent: e.target.checked })} className="size-4 accent-[var(--accent)]" /> Établissement indépendant</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.do_not_contact} onChange={(e) => void save({ do_not_contact: e.target.checked })} className="size-4 accent-[var(--accent)]" /> Ne pas contacter (opposition reçue)</label>
        </section>

        <Feed prospectId={p.id} />

        <div className="border-t border-border pt-4">
          <Button variant="danger" onClick={() => { onClose(); void archive(p.id); }}><Archive size={15} aria-hidden /> Archiver cette fiche</Button>
        </div>
      </div>
      {compose ? <MessageComposer prospectId={p.id} onClose={() => setCompose(false)} /> : null}
    </div>
  );
}

const KIND_COLOR: Record<Activity["kind"], string> = { note: "#64748b", message: "#2563eb", call: "#16a34a", visit: "#9333ea", reply: "#ea580c", stage_change: "#a8a29a" };

function Feed({ prospectId }: { prospectId: string }) {
  const { listActivities, addActivity, deleteActivity, activityTick, ref } = useApp();
  const [items, setItems] = useState<Activity[] | null>(null);
  const [note, setNote] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    listActivities(prospectId).then((l) => { if (alive) setItems(l); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [prospectId, activityTick, listActivities]);

  const send = async () => {
    const body = note.trim();
    if (!body) return;
    setNote("");
    await addActivity(prospectId, { kind: "note", body });
  };
  const who = (id: string | null) => ref.profiles.find((x) => x.id === id)?.name;

  return (
    <section aria-labelledby="s-feed" className="space-y-3">
      <h3 id="s-feed" className={SECTION}>Historique</h3>
      <div>
        <label htmlFor="f-note" className="sr-only">Ajouter une note</label>
        <textarea id="f-note" ref={area} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter une note…  (Ctrl + Entrée pour enregistrer)"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted/70 hover:border-muted/50" />
        <div className="mt-1.5 flex justify-end"><Button size="sm" variant="primary" disabled={!note.trim()} onClick={() => void send()}><Send size={13} aria-hidden /> Enregistrer la note</Button></div>
      </div>
      {items === null ? <p className="text-sm text-muted">Chargement…</p>
        : items.length === 0 ? <p className="text-sm text-muted">Rien pour l’instant. Les notes, appels, messages et changements d’étape apparaîtront ici.</p>
        : (
          <ol className="space-y-3">
            {items.map((a) => (
              <li key={a.id} className="group flex gap-3">
                <span className="mt-1.5"><Dot color={KIND_COLOR[a.kind]} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-xs text-muted">
                    <span className="font-medium text-fg">{ACTIVITY_LABEL[a.kind]}</span>
                    {a.channel ? <span>· {CHANNEL_LABEL[a.channel]}</span> : null}
                    <span className="ml-auto shrink-0">{who(a.author_id) ? `${who(a.author_id)} · ` : ""}{fmtWhen(a.created_at)}</span>
                  </div>
                  {a.body ? <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{a.body}</p> : null}
                </div>
                <button type="button" aria-label="Supprimer cette entrée" onClick={() => void deleteActivity(a.id)}
                  className="mt-0.5 h-6 shrink-0 rounded px-1 text-muted opacity-0 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"><Trash2 size={14} /></button>
              </li>
            ))}
          </ol>
        )}
    </section>
  );
}
