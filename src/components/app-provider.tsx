"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getRepo } from "@/lib/repo";
import { addDays, today as todayStr } from "@/lib/labels";
import { isMessageAction, planAfter, planStart, progressOf, stageStopsSequence, stepByNo } from "@/lib/sequence";
import { RELANCE_DAYS } from "@/lib/message";
import { fmtMoney, mergeCompany, nextNumber, STATUS_LABEL, totals } from "@/lib/quote";
import { DEFAULT_SCORE_RULES, SCORE_FIELDS, computeScore, mergeRules } from "@/lib/score";
import type { Activity, ActivityKind, Channel, Goal, MessageInput, Prospect, ProspectInput, ProspectPatch, Company, Offer, OfferInput, Quote, QuoteInput, QuoteStatus, Reference, RunStatus, ScoreRule, SentMessage, Sequence, SequenceInput, SequenceRun, SequenceStep, Template, TemplateInput } from "@/lib/types";

export interface Toast { id: number; message: string; kind: "info" | "error"; undo?: () => Promise<void> | void }

interface AppCtx {
  ref: Reference;
  mode: "demo" | "supabase";
  prospects: Prospect[];
  byId: (id: string) => Prospect | undefined;
  stageName: (id: string | null) => string;
  /** Nombre qui change à chaque ajout dans l'historique d'une fiche (pour recharger le fil). */
  activityTick: number;
  create: (input: ProspectInput) => Promise<Prospect | null>;
  update: (id: string, patch: ProspectPatch) => Promise<void>;
  moveStage: (id: string, stageId: string) => Promise<void>;
  setTags: (id: string, tagIds: string[]) => Promise<void>;
  archive: (id: string) => Promise<void>;
  addActivity: (id: string, a: { kind: ActivityKind; channel?: Channel | null; body: string | null }) => Promise<Activity | null>;
  listActivities: (id: string) => Promise<Activity[]>;
  deleteActivity: (id: string) => Promise<void>;
  listActivitiesSince: (iso: string) => Promise<Activity[]>;
  getGoal: (month: string) => Promise<Goal | null>;
  setGoal: (goal: Goal) => Promise<Goal | null>;
  listTemplates: () => Promise<Template[]>;
  saveTemplate: (t: TemplateInput) => Promise<Template | null>;
  deleteTemplate: (id: string) => Promise<boolean>;
  listMessages: (limit: number) => Promise<SentMessage[]>;
  /** « Marquer comme envoyé » : journalise le message, programme la relance et passe un premier contact à l'étape suivante. */
  sendMessage: (prospectId: string, m: Omit<MessageInput, "prospect_id">, opts?: { sequenceId?: string | null }) => Promise<boolean>;
  sequences: Sequence[];
  /** Parcours en cours (un par prospect au plus). */
  runs: SequenceRun[];
  /** Faux tant que la migration SQL de l'étape d n'a pas été appliquée à la base. */
  sequencesReady: boolean;
  /** Séquence en cours d'un prospect : étape à faire, position (« 2/4 »). */
  runFor: (prospectId: string) => { run: SequenceRun; seq: Sequence; step: SequenceStep | null; index: number; total: number } | null;
  saveSequence: (s: SequenceInput) => Promise<Sequence | null>;
  deleteSequence: (id: string) => Promise<boolean>;
  startSequence: (prospectId: string, sequenceId: string, opts?: { firstDone?: boolean }) => Promise<boolean>;
  /** L'étape en cours est faite : programme la suivante (ou termine). Renvoie l'annulation. */
  completeStep: (prospectId: string) => Promise<(() => Promise<void>) | null>;
  stopSequence: (prospectId: string, status?: RunStatus) => Promise<void>;
  offers: Offer[];
  saveOffer: (o: OfferInput) => Promise<Offer | null>;
  deleteOffer: (id: string) => Promise<boolean>;
  quotes: Quote[];
  /** Faux tant que la migration SQL de l'étape f n'a pas été appliquée à la base. */
  quotesReady: boolean;
  /** Crée un devis (brouillon) avec le prochain numéro de l'année. */
  createQuote: (input: QuoteInput) => Promise<Quote | null>;
  updateQuote: (id: string, input: Pick<QuoteInput, "lines" | "valid_until" | "notes">) => Promise<Quote | null>;
  /** Change l'état du devis, l'écrit dans l'historique ; « accepté » met à jour le montant de la fiche. */
  setQuoteStatus: (id: string, status: QuoteStatus) => Promise<void>;
  deleteQuote: (id: string) => Promise<boolean>;
  company: Company;
  saveCompany: (c: Company) => Promise<boolean>;
  /** Importe les lignes retenues d'un fichier ; le score est calculé ici. Renvoie le nombre de fiches créées (null si échec). Annulable depuis la notification. */
  importProspects: (origin: "csv" | "notion", mapping: Record<string, string>, rows: { input: ProspectInput; tag_ids: string[] }[], skipped: number) => Promise<number | null>;
  /** Critères du score (règles enregistrées + règles de départ). */
  scoreRules: ScoreRule[];
  /** Enregistre les critères puis recalcule le score de toutes les fiches ; renvoie le nombre de scores modifiés. */
  saveScoreRules: (rules: ScoreRule[]) => Promise<number | null>;
  signOut: () => Promise<void>;
  toasts: Toast[];
  toast: (message: string, opts?: { undo?: Toast["undo"]; kind?: Toast["kind"] }) => void;
  dismissToast: (id: number) => void;
  undoLast: () => void;
  quickAddOpen: boolean;
  setQuickAddOpen: (v: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}

const Ctx = createContext<AppCtx | null>(null);
export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp hors de AppProvider");
  return c;
}

// Rechargement complet voulu après la déconnexion : on repart d'un état vierge.
// eslint-disable-next-line @next/next/no-location-assign-relative-destination
const toLogin = () => { window.location.href = "/login"; };

/** Valeurs par défaut des champs qui comptent pour le score, pour une fiche en cours de création. */
const EMPTY_SCORABLE = { opened_on: null, ig_activity: null, instagram: null, is_independent: true, category_id: null, email: null, phone: null };

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; ref: Reference };

export function AppProvider({ children, fallback }: { children: ReactNode; fallback: (s: { status: "loading" } | { status: "error"; message: string } | { status: "no-profile"; signOut: () => Promise<void> }) => ReactNode }) {
  const repo = useMemo(() => getRepo(), []);
  const [state, setState] = useState<State>({ status: "loading" });
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activityTick, setActivityTick] = useState(0);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const undoStack = useRef<Toast[]>([]);
  const nextId = useRef(1);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [runs, setRuns] = useState<SequenceRun[]>([]);
  const [sequencesReady, setSequencesReady] = useState(false);
  const sequencesRef = useRef<Sequence[]>([]);
  const runsRef = useRef<SequenceRun[]>([]);
  const [scoreRules, setScoreRules] = useState<ScoreRule[]>(DEFAULT_SCORE_RULES);
  const scoreRulesRef = useRef<ScoreRule[]>(DEFAULT_SCORE_RULES);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesReady, setQuotesReady] = useState(false);
  const quotesRef = useRef<Quote[]>([]);
  const [company, setCompany] = useState<Company>(mergeCompany(null));
  const prospectsRef = useRef<Prospect[]>([]);
  useEffect(() => { prospectsRef.current = prospects; }, [prospects]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ref, list] = await Promise.all([repo.reference(), repo.listProspects()]);
        if (!alive) return;
        setProspects(list);
        setState({ status: "ready", ref });
      } catch (e) {
        if (alive) setState({ status: "error", message: e instanceof Error ? e.message : "Chargement impossible" });
      }
    })();
    return () => { alive = false; };
  }, [repo]);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    undoStack.current = undoStack.current.filter((x) => x.id !== id);
  }, []);

  const toast = useCallback<AppCtx["toast"]>((message, opts) => {
    const t: Toast = { id: nextId.current++, message, kind: opts?.kind ?? "info", undo: opts?.undo };
    setToasts((l) => [...l.slice(-3), t]);
    if (t.undo) undoStack.current = [...undoStack.current.slice(-19), t];
    window.setTimeout(() => setToasts((l) => l.filter((x) => x.id !== t.id)), t.undo ? 8000 : 4500);
  }, []);

  const undoLast = useCallback(() => {
    const t = undoStack.current.pop();
    if (!t?.undo) return;
    setToasts((l) => l.filter((x) => x.id !== t.id));
    void t.undo();
  }, []);

  const fail = useCallback((e: unknown, what: string) => {
    toast(`${what} : ${e instanceof Error ? e.message : "erreur inconnue"}`, { kind: "error" });
  }, [toast]);

  const replace = useCallback((p: Prospect) => setProspects((l) => l.map((x) => (x.id === p.id ? p : x))), []);

  const ready = state.status === "ready" ? state.ref : null;
  const meId = ready?.me?.id ?? null;

  // Séquences : chargées à part pour que l'application reste utilisable si la migration SQL de l'étape d n'est pas encore appliquée.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    Promise.all([repo.listSequences(), repo.listRuns()])
      .then(([sq, rn]) => { if (!alive) return; sequencesRef.current = sq; runsRef.current = rn; setSequences(sq); setRuns(rn); setSequencesReady(true); })
      .catch(() => { if (alive) setSequencesReady(false); });
    return () => { alive = false; };
  }, [ready, repo]);

  // Offres, devis, coordonnées de l'entreprise. Les devis se chargent à part : leurs colonnes viennent de la migration de l'étape f.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    repo.listOffers().then((o) => { if (alive) setOffers(o); }).catch(() => undefined);
    repo.getSetting<Partial<Company>>("company").then((c) => { if (alive) setCompany(mergeCompany(c)); }).catch(() => undefined);
    repo.listQuotes().then((q) => { if (!alive) return; quotesRef.current = q; setQuotes(q); setQuotesReady(true); }).catch(() => { if (alive) setQuotesReady(false); });
    return () => { alive = false; };
  }, [ready, repo]);

  // Critères du score : si la table est vide ou illisible, les critères de départ s'appliquent.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    repo.listScoreRules().then((r) => { if (!alive) return; const m = mergeRules(r); scoreRulesRef.current = m; setScoreRules(m); }).catch(() => undefined);
    return () => { alive = false; };
  }, [ready, repo]);

  const api = useMemo<AppCtx | null>(() => {
    if (!ready) return null;
    const get = (id: string) => prospectsRef.current.find((p) => p.id === id);

    const runOf = (pid: string) => runsRef.current.find((r) => r.prospect_id === pid) ?? null;
    const seqOf = (id: string) => sequencesRef.current.find((q) => q.id === id) ?? null;
    const setRunList = (fn: (l: SequenceRun[]) => SequenceRun[]) => { runsRef.current = fn(runsRef.current); setRuns(runsRef.current); };
    const setSeqList = (fn: (l: Sequence[]) => Sequence[]) => { sequencesRef.current = fn(sequencesRef.current); setSequences(sequencesRef.current); };

    const scoreOf = (p: Prospect) => computeScore(p, scoreRulesRef.current, ready.categories, todayStr()).score;

    const update: AppCtx["update"] = async (id, patchIn) => {
      const before = get(id);
      if (!before) return;
      // Le score suit la fiche : recalculé quand un champ qui le détermine change.
      let patch = patchIn;
      if (!("score" in patch) && SCORE_FIELDS.some((k) => k in patch)) {
        const s = scoreOf({ ...before, ...patch });
        if (s !== before.score) patch = { ...patch, score: s };
      }
      setProspects((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x))); // affichage immédiat
      try { replace(await repo.updateProspect(id, patch)); }
      catch (e) { replace(before); fail(e, "Enregistrement impossible"); return; }
      // Une réponse (étape « Répondu » ou au-delà) ou « Ne pas contacter » arrête la séquence en cours.
      if (runOf(id) && ((patch.stage_id && stageStopsSequence(ready.stages, patch.stage_id)) || patch.do_not_contact === true)) {
        await stopRun(id, "stopped_reply", before.name);
      }
    };

    const addActivity: AppCtx["addActivity"] = async (id, a) => {
      let act: Activity;
      try { act = await repo.addActivity(id, a, meId); setActivityTick((n) => n + 1); }
      catch (e) { fail(e, "Ajout impossible"); return null; }
      if (a.kind === "reply" && runOf(id)) await stopRun(id, "stopped_reply", get(id)?.name);
      return act;
    };

    /** Termine le parcours en cours ; l'action prévue par la séquence est effacée si elle n'a pas été modifiée. */
    async function stopRun(pid: string, status: RunStatus, name?: string) {
      const run = runOf(pid);
      if (!run) return;
      const step = seqOf(run.sequence_id) ? stepByNo(seqOf(run.sequence_id)!, run.current_step) : null;
      try { await repo.updateRun(run.id, { status }); } catch (e) { fail(e, "Séquence non arrêtée"); return; }
      setRunList((l) => l.filter((r) => r.id !== run.id));
      const p = get(pid);
      if (step && p && p.next_action_label === step.label) await update(pid, { next_action_at: null, next_action_label: null });
      if (status === "stopped_reply") toast(`Séquence arrêtée${name ? ` pour « ${name} »` : ""} : il a répondu`);
    }

    /** L'étape en cours est faite : programme la suivante (ou termine la séquence). */
    async function advanceRun(pid: string): Promise<(() => Promise<void>) | null> {
      const run = runOf(pid);
      const seq = run ? seqOf(run.sequence_id) : null;
      if (!run || !seq) return null;
      const p = get(pid);
      const prevNext = { next_action_at: p?.next_action_at ?? null, next_action_label: p?.next_action_label ?? null };
      const prevStep = run.current_step;
      const plan = planAfter(seq, run.started_at, run.current_step, todayStr());
      try {
        if (plan.finished) {
          await repo.updateRun(run.id, { status: "finished" });
          setRunList((l) => l.filter((r) => r.id !== run.id));
          if (p && p.next_action_label === stepByNo(seq, prevStep)?.label) await update(pid, { next_action_at: null, next_action_label: null });
        } else {
          const upd = await repo.updateRun(run.id, { current_step: plan.step.step_no });
          setRunList((l) => l.map((r) => (r.id === run.id ? upd : r)));
          await update(pid, { next_action_at: plan.dueOn, next_action_label: plan.step.label });
        }
      } catch (e) { fail(e, "Séquence non mise à jour"); return null; }
      return async () => {
        try {
          const back = await repo.updateRun(run.id, { current_step: prevStep, status: "running" });
          setRunList((l) => [...l.filter((r) => r.id !== run.id), back]);
        } catch (e) { fail(e, "Annulation incomplète"); }
        await update(pid, prevNext);
      };
    }

    /** Lance une séquence ; `firstDone` = la première étape vient d'être faite (message envoyé). Renvoie l'annulation. */
    async function startRun(pid: string, sequenceId: string, firstDone: boolean): Promise<(() => Promise<void>) | null> {
      const seq = seqOf(sequenceId);
      const p = get(pid);
      const start = seq ? planStart(seq, todayStr()) : null;
      if (!seq || !p || !start) { toast("Cette séquence n'a pas d'étape.", { kind: "error" }); return null; }
      if (runOf(pid)) { toast("Une séquence est déjà en cours pour ce prospect.", { kind: "error" }); return null; }
      const prevNext = { next_action_at: p.next_action_at, next_action_label: p.next_action_label };
      let run: SequenceRun;
      try { run = await repo.createRun({ prospect_id: pid, sequence_id: seq.id, current_step: start.step.step_no }); }
      catch (e) { fail(e, "Séquence non lancée"); return null; }
      setRunList((l) => [...l, run]);
      if (firstDone) await advanceRun(pid);
      else await update(pid, { next_action_at: start.dueOn, next_action_label: start.step.label });
      return async () => {
        await repo.deleteRun(run.id).catch((e) => fail(e, "Annulation incomplète"));
        setRunList((l) => l.filter((r) => r.id !== run.id));
        await update(pid, prevNext);
      };
    }

    return {
      ref: ready, mode: repo.mode, prospects,
      byId: (id) => prospects.find((p) => p.id === id), // lu pendant l'affichage : toujours l'état courant
      stageName: (id) => ready.stages.find((s) => s.id === id)?.name ?? "",
      activityTick,
      async create(input) {
        try {
          const p = await repo.createProspect({ ...input, score: "score" in input ? input.score : scoreOf({ ...EMPTY_SCORABLE, ...input } as Prospect) }, meId);
          setProspects((l) => [p, ...l]);
          return p;
        } catch (e) { fail(e, "Création impossible"); return null; }
      },
      update,
      async moveStage(id, stageId) {
        const p = get(id);
        if (!p || p.stage_id === stageId) return;
        const from = p.stage_id;
        const name = (sid: string) => ready.stages.find((s) => s.id === sid)?.name ?? "?";
        await update(id, { stage_id: stageId });
        await addActivity(id, { kind: "stage_change", body: `${name(from)} → ${name(stageId)}` });
        toast(`« ${p.name} » passe à « ${name(stageId)} »`, {
          undo: async () => { await update(id, { stage_id: from }); await addActivity(id, { kind: "stage_change", body: `${name(stageId)} → ${name(from)} (annulé)` }); },
        });
      },
      async setTags(id, tagIds) {
        const before = get(id)?.tag_ids ?? [];
        setProspects((l) => l.map((x) => (x.id === id ? { ...x, tag_ids: tagIds } : x)));
        try { await repo.setTags(id, tagIds); } catch (e) { setProspects((l) => l.map((x) => (x.id === id ? { ...x, tag_ids: before } : x))); fail(e, "Étiquettes non enregistrées"); }
      },
      async archive(id) {
        const p = get(id);
        if (!p) return;
        const at = new Date().toISOString();
        try {
          await repo.updateProspect(id, { archived_at: at });
          setProspects((l) => l.filter((x) => x.id !== id));
          toast(`« ${p.name} » archivée`, {
            undo: async () => { try { const back = await repo.updateProspect(id, { archived_at: null }); setProspects((l) => [back, ...l.filter((x) => x.id !== id)]); } catch (e) { fail(e, "Restauration impossible"); } },
          });
        } catch (e) { fail(e, "Archivage impossible"); }
      },
      addActivity,
      listActivities: (id) => repo.listActivities(id),
      async deleteActivity(id) { try { await repo.deleteActivity(id); setActivityTick((n) => n + 1); } catch (e) { fail(e, "Suppression impossible"); } },
      listActivitiesSince: (iso) => repo.listActivitiesSince(iso),
      getGoal: (month) => repo.getGoal(month),
      async setGoal(goal) { try { return await repo.setGoal(goal); } catch (e) { fail(e, "Objectif non enregistré"); return null; } },
      listTemplates: () => repo.listTemplates(),
      async saveTemplate(t) { try { return await repo.saveTemplate(t); } catch (e) { fail(e, "Modèle non enregistré"); return null; } },
      async deleteTemplate(id) { try { await repo.deleteTemplate(id); return true; } catch (e) { fail(e, "Suppression impossible"); return false; } },
      listMessages: (limit) => repo.listMessages(limit),
      async sendMessage(prospectId, m, opts) {
        const p = get(prospectId);
        if (!p) return false;
        let msg: SentMessage;
        try { msg = await repo.addMessage({ ...m, prospect_id: prospectId }, meId); }
        catch (e) { fail(e, "Message non enregistré"); return false; }
        const before = { stage_id: p.stage_id, next_action_at: p.next_action_at, next_action_label: p.next_action_label };
        const open = ready.stages.filter((s) => s.kind === "open").sort((a, b) => a.position - b.position);
        const advance = open.length > 1 && p.stage_id === open[0].id ? open[1] : null;
        const created: Activity[] = [];
        const act = await addActivity(prospectId, { kind: "message", channel: m.channel, body: m.body });
        if (act) created.push(act);
        if (advance) {
          await update(prospectId, { stage_id: advance.id });
          const sc = await addActivity(prospectId, { kind: "stage_change", body: `${ready.stages.find((s) => s.id === before.stage_id)?.name ?? "?"} → ${advance.name}` });
          if (sc) created.push(sc);
        }
        // Suite : séquence en cours → étape suivante ; séquence choisie → on la lance ; sinon relance simple à J+3.
        let undoSeq: (() => Promise<void>) | null = null;
        let note = `relance dans ${RELANCE_DAYS} jours`;
        const running = runOf(prospectId);
        const runStep = running ? stepByNo(seqOf(running.sequence_id) ?? { id: "", name: "", is_active: true, steps: [] }, running.current_step) : null;
        let keepAction = false;
        if (running) {
          if (runStep && !isMessageAction(runStep.action)) { keepAction = true; note = "la séquence continue à son étape"; } // ex. un appel prévu : un message libre ne la fait pas avancer
          else { undoSeq = await advanceRun(prospectId); note = "étape suivante programmée"; }
        } else if (opts?.sequenceId) {
          undoSeq = await startRun(prospectId, opts.sequenceId, true);
          note = undoSeq ? "séquence lancée, étape suivante programmée" : note;
        }
        if (!undoSeq && !keepAction) await update(prospectId, { next_action_at: addDays(RELANCE_DAYS), next_action_label: "Relance courte" });
        toast(`Message enregistré, ${note}`, {
          undo: async () => {
            try { await repo.deleteMessage(msg.id); } catch (e) { fail(e, "Annulation incomplète"); }
            for (const a of created) await repo.deleteActivity(a.id).catch(() => undefined);
            setActivityTick((n) => n + 1);
            if (undoSeq) await undoSeq();
            await update(prospectId, before);
          },
        });
        return true;
      },
      offers,
      async saveOffer(o) {
        try {
          const saved = await repo.saveOffer(o);
          setOffers((l) => (o.id ? l.map((x) => (x.id === saved.id ? saved : x)) : [...l, saved]).sort((a, b) => a.name.localeCompare(b.name, "fr")));
          return saved;
        } catch (e) { fail(e, "Offre non enregistrée"); return null; }
      },
      async deleteOffer(id) {
        try { await repo.deleteOffer(id); setOffers((l) => l.filter((x) => x.id !== id)); return true; }
        catch (e) { fail(e, "Suppression impossible"); return false; }
      },
      quotes, quotesReady,
      async createQuote(input) {
        const year = new Date().getFullYear();
        const total = totals(input.lines).amount;
        try {
          let created: Quote | null = null;
          for (let attempt = 0; !created; attempt++) {
            try {
              created = await repo.createQuote({ ...input, number: nextNumber(quotesRef.current.map((q) => q.number), year), total_cents: total, status: "draft" });
            } catch (e) {
              // Numéro déjà pris (autre onglet, autre appareil) : on relit la liste et on réessaie.
              if (attempt < 3 && /duplicate|unique/i.test(e instanceof Error ? e.message : "")) { quotesRef.current = await repo.listQuotes(); continue; }
              throw e;
            }
          }
          quotesRef.current = [created, ...quotesRef.current];
          setQuotes(quotesRef.current);
          await addActivity(input.prospect_id, { kind: "note", body: `Devis ${created.number} créé (${fmtMoney(total)})` });
          return created;
        } catch (e) { fail(e, "Devis non créé"); return null; }
      },
      async updateQuote(id, input) {
        try {
          const saved = await repo.updateQuote(id, { ...input, total_cents: totals(input.lines).amount });
          quotesRef.current = quotesRef.current.map((q) => (q.id === id ? saved : q));
          setQuotes(quotesRef.current);
          return saved;
        } catch (e) { fail(e, "Devis non enregistré"); return null; }
      },
      async setQuoteStatus(id, status) {
        const q = quotesRef.current.find((x) => x.id === id);
        if (!q || q.status === status) return;
        const prev = q.status;
        const p = get(q.prospect_id);
        const prevAmount = p?.est_amount_cents ?? null;
        const put = async (st: QuoteStatus) => {
          const saved = await repo.updateQuote(id, { status: st });
          quotesRef.current = quotesRef.current.map((x) => (x.id === id ? saved : x));
          setQuotes(quotesRef.current);
        };
        try { await put(status); } catch (e) { fail(e, "Statut non enregistré"); return; }
        if (status !== "draft") await addActivity(q.prospect_id, { kind: "note", body: `Devis ${q.number} ${STATUS_LABEL[status].toLowerCase()}${status === "accepted" ? ` (${fmtMoney(q.total_cents)})` : ""}` });
        if (status === "accepted" && p) await update(p.id, { est_amount_cents: q.total_cents });
        toast(status === "accepted" ? `Devis ${q.number} accepté, montant de la fiche mis à jour` : `Devis ${q.number} : ${STATUS_LABEL[status].toLowerCase()}`, {
          undo: async () => {
            try { await put(prev); } catch (e) { fail(e, "Annulation impossible"); return; }
            if (status === "accepted" && p) await update(p.id, { est_amount_cents: prevAmount });
          },
        });
      },
      async deleteQuote(id) {
        try {
          await repo.deleteQuote(id);
          quotesRef.current = quotesRef.current.filter((q) => q.id !== id);
          setQuotes(quotesRef.current);
          return true;
        } catch (e) { fail(e, "Suppression impossible"); return false; }
      },
      company,
      async saveCompany(c) {
        try { await repo.setSetting("company", c); setCompany(c); return true; }
        catch (e) { fail(e, "Coordonnées non enregistrées"); return false; }
      },
      async importProspects(origin, mapping, rows, skipped) {
        if (rows.length === 0) return 0;
        try {
          const scored = rows.map((r) => ({ ...r, input: { ...r.input, score: scoreOf({ ...EMPTY_SCORABLE, ...r.input } as Prospect) } }));
          const { batch_id, prospects: created } = await repo.importProspects(origin, mapping, scored, skipped, meId);
          setProspects((l) => [...created, ...l]);
          const ids = new Set(created.map((p) => p.id));
          toast(`${created.length} prospect${created.length > 1 ? "s" : ""} importé${created.length > 1 ? "s" : ""}`, {
            undo: async () => {
              try {
                const done = await repo.undoImport(batch_id);
                setProspects((l) => l.filter((p) => !ids.has(p.id)));
                toast(`Import annulé : ${done.length} fiche${done.length > 1 ? "s" : ""} archivée${done.length > 1 ? "s" : ""}`);
              } catch (e) { fail(e, "Annulation impossible"); }
            },
          });
          return created.length;
        } catch (e) { fail(e, "Import impossible"); return null; }
      },
      scoreRules,
      async saveScoreRules(rules) {
        try {
          const saved = mergeRules(await repo.saveScoreRules(rules));
          scoreRulesRef.current = saved; setScoreRules(saved);
          let changed = 0;
          const todo = prospectsRef.current.map((p) => ({ p, s: scoreOf(p) })).filter((x) => x.s !== x.p.score);
          for (let i = 0; i < todo.length; i += 8) {
            await Promise.all(todo.slice(i, i + 8).map(async ({ p, s }) => { const back = await repo.updateProspect(p.id, { score: s }); replace(back); changed++; }));
          }
          return changed;
        } catch (e) { fail(e, "Critères non enregistrés"); return null; }
      },
      sequences, runs, sequencesReady,
      runFor(pid) {
        const run = runs.find((r) => r.prospect_id === pid);
        const seq = run ? sequences.find((q) => q.id === run.sequence_id) : undefined;
        if (!run || !seq) return null;
        return { run, seq, step: stepByNo(seq, run.current_step), ...progressOf(seq, run.current_step) };
      },
      async saveSequence(input) {
        try {
          const saved = await repo.saveSequence(input);
          setSeqList((l) => (input.id ? l.map((x) => (x.id === saved.id ? saved : x)) : [...l, saved]));
          return saved;
        } catch (e) { fail(e, "Séquence non enregistrée"); return null; }
      },
      async deleteSequence(id) {
        try {
          await repo.deleteSequence(id);
          setSeqList((l) => l.filter((x) => x.id !== id));
          setRunList((l) => l.filter((r) => r.sequence_id !== id));
          return true;
        } catch (e) { fail(e, "Suppression impossible"); return false; }
      },
      async startSequence(pid, sequenceId, opts) {
        const undo = await startRun(pid, sequenceId, !!opts?.firstDone);
        if (undo) toast("Séquence lancée", { undo });
        return !!undo;
      },
      completeStep: (pid) => advanceRun(pid),
      async stopSequence(pid, status = "finished") { await stopRun(pid, status); },
      signOut: async () => { await repo.signOut(); toLogin(); },
      toasts, toast, dismissToast, undoLast,
      quickAddOpen, setQuickAddOpen, paletteOpen, setPaletteOpen,
    };
  }, [ready, repo, prospects, scoreRules, offers, quotes, quotesReady, company, sequences, runs, sequencesReady, activityTick, toasts, toast, dismissToast, undoLast, meId, fail, replace, quickAddOpen, paletteOpen]);

  if (state.status === "loading") return <>{fallback({ status: "loading" })}</>;
  if (state.status === "error") return <>{fallback(state)}</>;
  if (!state.ref.me && repo.mode === "supabase") return <>{fallback({ status: "no-profile", signOut: () => repo.signOut().then(() => { toLogin(); }) })}</>;
  return <Ctx.Provider value={api!}>{children}</Ctx.Provider>;
}
