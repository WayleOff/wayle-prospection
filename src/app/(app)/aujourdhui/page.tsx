"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarCheck, Check, ChevronRight, Clock, PhoneOff, Target } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, CloseButton, Dialog, Dot, Empty, inputCls } from "@/components/ui";
import { CHANNEL_LABEL, addDays, fmtDue, fmtEuros, today } from "@/lib/labels";
import { computeIndicators, emptyGoal, monthKey, progress, statsSince, type Indicators } from "@/lib/stats";
import { buildToday } from "@/lib/today";
import type { Activity, Goal, Prospect } from "@/lib/types";

const NO_REPLY_DAYS = 3; // « Pas de réponse » reporte la relance de 3 jours

export default function Page() {
  const app = useApp();
  const { prospects, ref, listActivitiesSince, getGoal, activityTick } = app;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [goal, setGoalState] = useState<Goal | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const month = monthKey();

  useEffect(() => {
    let alive = true;
    listActivitiesSince(statsSince()).then((l) => { if (alive) setActivities(l); }).catch(() => { if (alive) setActivities([]); });
    return () => { alive = false; };
  }, [listActivitiesSince, activityTick]);
  useEffect(() => {
    let alive = true;
    getGoal(month).then((g) => { if (alive) setGoalState(g); }).catch(() => undefined);
    return () => { alive = false; };
  }, [getGoal, month]);

  const lists = useMemo(() => buildToday(prospects, ref.stages, today(), addDays(7)), [prospects, ref.stages]);
  const ind = useMemo<Indicators | null>(() => (activities ? computeIndicators(prospects, activities, ref.stages) : null), [prospects, activities, ref.stages]);

  const open = (id: string) => { const qs = new URLSearchParams(sp.toString()); qs.set("fiche", id); router.push(`${pathname}?${qs.toString()}`, { scroll: false }); };
  const dueCount = lists.late.length + lists.today.length;
  const dateRaw = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const dateLabel = dateRaw.charAt(0).toUpperCase() + dateRaw.slice(1);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Aujourd’hui</h1>
        <p className="mt-0.5 text-sm text-muted">{dateLabel}</p>
      </div>

      <Indicators ind={ind} goal={goal} onGoal={() => setGoalOpen(true)} />

      <div className="space-y-8">
        {dueCount === 0 && lists.firstContacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border"><Empty icon={<CalendarCheck size={22} />} title="Rien de prévu aujourd’hui" text="Aucune relance due et aucun prospect en attente de premier contact. Planifiez une relance depuis une fiche, ou ajoutez un prospect avec la touche N." /></div>
        ) : null}
        <Section title="En retard" tone="late" items={lists.late} render={(p) => <DueRow key={p.id} p={p} onOpen={open} />} />
        <Section title="Aujourd’hui" items={lists.today} render={(p) => <DueRow key={p.id} p={p} onOpen={open} />} />
        <Section title="Premiers contacts à faire" hint="Les mieux notés de l’étape « À contacter » sans action prévue." items={lists.firstContacts} render={(p) => <FirstRow key={p.id} p={p} onOpen={open} />} />
        <Section title="À venir (7 jours)" items={lists.upcoming} render={(p) => <UpcomingRow key={p.id} p={p} onOpen={open} />} />
      </div>

      {goalOpen ? <GoalDialog month={month} goal={goal ?? emptyGoal(month)} onClose={() => setGoalOpen(false)} onSaved={setGoalState} /> : null}
    </div>
  );
}

function Section<T extends Prospect>({ title, hint, items, render, tone }: { title: string; hint?: string; items: T[]; render: (p: T) => ReactNode; tone?: "late" }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className={`text-sm font-semibold ${tone === "late" ? "text-danger" : ""}`}>{title}</h2>
        <span className="text-xs text-muted tabular-nums">{items.length}</span>
        {hint ? <span className="text-xs text-muted">· {hint}</span> : null}
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">{items.map((p) => <li key={p.id}>{render(p)}</li>)}</ul>
    </section>
  );
}

function Identity({ p, onOpen, line }: { p: Prospect; onOpen: (id: string) => void; line: ReactNode }) {
  const { ref } = useApp();
  const st = ref.stages.find((s) => s.id === p.stage_id);
  return (
    <button type="button" onClick={() => onOpen(p.id)} className="group min-w-[11rem] flex-1 text-left">
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-medium group-hover:underline">{p.name}</span>
        {st ? <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted sm:inline-flex"><Dot color={st.color} size={7} />{st.name}</span> : null}
      </div>
      <div className="mt-0.5 truncate text-xs text-muted">{line}</div>
    </button>
  );
}

/** Relance ou action prévue : Fait / Reporter à +2 j / Pas de réponse. */
function DueRow({ p, onOpen }: { p: Prospect; onOpen: (id: string) => void }) {
  const { update, addActivity, deleteActivity, toast } = useApp();
  const due = fmtDue(p.next_action_at);
  const before = { next_action_at: p.next_action_at, next_action_label: p.next_action_label };

  const done = async () => {
    const a = await addActivity(p.id, { kind: "note", body: `Fait : ${p.next_action_label ?? "action prévue"}` });
    await update(p.id, { next_action_at: null, next_action_label: null });
    toast(`« ${p.name} » : action faite`, { undo: async () => { await update(p.id, before); if (a) await deleteActivity(a.id); } });
  };
  const snooze = async () => {
    await update(p.id, { next_action_at: addDays(2) });
    toast(`« ${p.name} » : reportée à après-demain`, { undo: () => update(p.id, before) });
  };
  const noReply = async () => {
    const a = await addActivity(p.id, { kind: "note", body: "Pas de réponse" });
    await update(p.id, { next_action_at: addDays(NO_REPLY_DAYS), next_action_label: "Relancer" });
    toast(`« ${p.name} » : pas de réponse, relance dans ${NO_REPLY_DAYS} jours`, { undo: async () => { await update(p.id, before); if (a) await deleteActivity(a.id); } });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <Identity p={p} onOpen={onOpen} line={<><span className={due?.late ? "font-medium text-danger" : ""}>{due?.text}</span>{p.next_action_label ? ` · ${p.next_action_label}` : ""}{p.preferred_channel ? ` · ${CHANNEL_LABEL[p.preferred_channel]}` : ""}</>} />
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" variant="primary" onClick={() => void done()}><Check size={14} aria-hidden /> Fait</Button>
        <Button size="sm" onClick={() => void snooze()}><Clock size={14} aria-hidden /> +2 j</Button>
        <Button size="sm" onClick={() => void noReply()}><PhoneOff size={14} aria-hidden /> Pas de réponse</Button>
      </div>
    </div>
  );
}

/** Premier contact à faire : « Fait » enregistre le message et passe la fiche à l'étape suivante. */
function FirstRow({ p, onOpen }: { p: Prospect; onOpen: (id: string) => void }) {
  const { ref, moveStage, addActivity, update, toast } = useApp();
  const open = ref.stages.filter((s) => s.kind === "open").sort((a, b) => a.position - b.position);
  const next = open[1];
  const cat = ref.categories.find((c) => c.id === p.category_id)?.name;
  const done = async () => {
    await addActivity(p.id, { kind: "message", channel: p.preferred_channel, body: "Premier contact envoyé" });
    if (next) await moveStage(p.id, next.id);
  };
  const snooze = async () => {
    const before = { next_action_at: p.next_action_at, next_action_label: p.next_action_label };
    await update(p.id, { next_action_at: addDays(2), next_action_label: "Premier contact" });
    toast(`« ${p.name} » : reporté à après-demain`, { undo: () => update(p.id, before) });
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <Identity p={p} onOpen={onOpen} line={[cat, p.preferred_channel ? CHANNEL_LABEL[p.preferred_channel] : null, `score ${p.score}`].filter(Boolean).join(" · ")} />
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" variant="primary" onClick={() => void done()} title="Enregistre le premier contact et passe la fiche à l'étape suivante"><Check size={14} aria-hidden /> Contacté</Button>
        <Button size="sm" onClick={() => void snooze()}><Clock size={14} aria-hidden /> +2 j</Button>
      </div>
    </div>
  );
}

function UpcomingRow({ p, onOpen }: { p: Prospect; onOpen: (id: string) => void }) {
  const due = fmtDue(p.next_action_at);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Identity p={p} onOpen={onOpen} line={<>{due?.text}{p.next_action_label ? ` · ${p.next_action_label}` : ""}</>} />
      <ChevronRight size={16} className="text-muted" aria-hidden />
    </div>
  );
}

// ───────────── Indicateurs ─────────────

function Indicators({ ind, goal, onGoal }: { ind: Indicators | null; goal: Goal | null; onGoal: () => void }) {
  const v = (x: number | string | undefined) => (ind ? x : "—");
  const revenueP = progress(ind?.revenueCents ?? 0, goal?.revenue_cents);
  const contactsP = progress(ind?.contactsMonth ?? 0, goal?.contacts);
  return (
    <section aria-label="Indicateurs" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Contacts cette semaine" value={v(ind?.contactsWeek)} hint="Messages, appels et visites depuis lundi" />
        <Tile label="Taux de réponse" value={ind ? (ind.replyRate == null ? "—" : `${Math.round(ind.replyRate * 100)} %`) : "—"} hint={ind && ind.contacted30 ? `${ind.replied30} sur ${ind.contacted30} contactés en 30 jours` : "Sur les 30 derniers jours"} />
        <Tile label="RDV obtenus" value={v(ind?.rdvMonth)} hint="Ce mois-ci" />
        <Tile label="Reels d’essai tournés" value={v(ind?.reelsMonth)} hint="Ce mois-ci" />
        <Tile label="CA signé" value={ind ? fmtEuros(ind.revenueCents) || "0 €" : "—"} hint={ind ? `${ind.wonMonth} signé${ind.wonMonth > 1 ? "s" : ""} ce mois-ci` : ""} />
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-muted" aria-hidden />
          <h2 className="text-sm font-semibold">Objectif du mois</h2>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onGoal}>{goal && (goal.revenue_cents || goal.contacts) ? "Modifier" : "Définir"}</Button>
        </div>
        {revenueP == null && contactsP == null ? (
          <p className="mt-2 text-sm text-muted">Aucun objectif pour ce mois. Définissez un objectif de chiffre d’affaires et de contacts pour suivre votre avancement.</p>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {revenueP != null ? <Bar label="Chiffre d’affaires" now={fmtEuros(ind?.revenueCents ?? 0)} goal={fmtEuros(goal!.revenue_cents)} value={revenueP} /> : null}
            {contactsP != null ? <Bar label="Contacts" now={String(ind?.contactsMonth ?? 0)} goal={String(goal!.contacts)} value={contactsP} /> : null}
          </div>
        )}
      </div>
    </section>
  );
}

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

function Bar({ label, now, goal, value }: { label: string; now: string; goal: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm"><span>{label}</span><span className="text-muted tabular-nums">{now} / {goal} · {pct} %</span></div>
      <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="mt-1.5 h-2 overflow-hidden rounded-full bg-subtle">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function GoalDialog({ month, goal, onClose, onSaved }: { month: string; goal: Goal; onClose: () => void; onSaved: (g: Goal) => void }) {
  const { setGoal } = useApp();
  return (
    <Dialog open onClose={onClose} variant="modal" label="Objectif du mois">
      <GoalForm month={month} goal={goal} onClose={onClose} onSaved={onSaved} setGoal={setGoal} />
    </Dialog>
  );
}

function GoalForm({ month, goal, onClose, onSaved, setGoal }: { month: string; goal: Goal; onClose: () => void; onSaved: (g: Goal) => void; setGoal: (g: Goal) => Promise<Goal | null> }) {
  const [revenue, setRevenue] = useState(goal.revenue_cents ? String(Math.round(goal.revenue_cents / 100)) : "");
  const [contacts, setContacts] = useState(goal.contacts ? String(goal.contacts) : "");
  const [busy, setBusy] = useState(false);
  const num = (s: string) => { const n = Number(s.replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };
  const label = new Date(month + "T00:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const saved = await setGoal({ month, revenue_cents: Math.round(num(revenue) * 100), contacts: Math.round(num(contacts)) });
    setBusy(false);
    if (saved) { onSaved(saved); onClose(); }
  };
  return (
    <form onSubmit={submit} className="p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Objectif de {label}</h2><CloseButton onClick={onClose} /></div>
      <div className="space-y-3">
        <div><label htmlFor="g-rev" className="mb-1 block text-xs font-medium text-muted">Chiffre d’affaires signé (€)</label><input id="g-rev" className={inputCls} inputMode="numeric" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="Ex. 3000" autoFocus /></div>
        <div><label htmlFor="g-con" className="mb-1 block text-xs font-medium text-muted">Contacts à établir</label><input id="g-con" className={inputCls} inputMode="numeric" value={contacts} onChange={(e) => setContacts(e.target.value)} placeholder="Ex. 40" /></div>
        <p className="text-xs text-muted">Laissez vide pour ne pas suivre cet objectif.</p>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button onClick={onClose}>Annuler</Button><Button variant="primary" type="submit" disabled={busy}>Enregistrer</Button></div>
    </form>
  );
}
