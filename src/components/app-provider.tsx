"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getRepo } from "@/lib/repo";
import { addDays } from "@/lib/labels";
import { RELANCE_DAYS } from "@/lib/message";
import type { Activity, ActivityKind, Channel, Goal, MessageInput, Prospect, ProspectInput, ProspectPatch, Reference, SentMessage, Template, TemplateInput } from "@/lib/types";

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
  sendMessage: (prospectId: string, m: Omit<MessageInput, "prospect_id">) => Promise<boolean>;
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

  const api = useMemo<AppCtx | null>(() => {
    if (!ready) return null;
    const get = (id: string) => prospectsRef.current.find((p) => p.id === id);

    const update: AppCtx["update"] = async (id, patch) => {
      const before = get(id);
      if (!before) return;
      setProspects((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x))); // affichage immédiat
      try { replace(await repo.updateProspect(id, patch)); }
      catch (e) { replace(before); fail(e, "Enregistrement impossible"); }
    };

    const addActivity: AppCtx["addActivity"] = async (id, a) => {
      try { const act = await repo.addActivity(id, a, meId); setActivityTick((n) => n + 1); return act; }
      catch (e) { fail(e, "Ajout impossible"); return null; }
    };

    return {
      ref: ready, mode: repo.mode, prospects,
      byId: (id) => prospects.find((p) => p.id === id), // lu pendant l'affichage : toujours l'état courant
      stageName: (id) => ready.stages.find((s) => s.id === id)?.name ?? "",
      activityTick,
      async create(input) {
        try {
          const p = await repo.createProspect(input, meId);
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
      async sendMessage(prospectId, m) {
        const p = get(prospectId);
        if (!p) return false;
        let msg: SentMessage;
        try { msg = await repo.addMessage({ ...m, prospect_id: prospectId }, meId); }
        catch (e) { fail(e, "Message non enregistré"); return false; }
        const before = { stage_id: p.stage_id, next_action_at: p.next_action_at, next_action_label: p.next_action_label };
        const open = ready.stages.filter((s) => s.kind === "open").sort((a, b) => a.position - b.position);
        const advance = open.length > 1 && p.stage_id === open[0].id ? open[1] : null;
        const patch: ProspectPatch = { next_action_at: addDays(RELANCE_DAYS), next_action_label: "Relance courte", ...(advance ? { stage_id: advance.id } : {}) };
        const created: Activity[] = [];
        const act = await addActivity(prospectId, { kind: "message", channel: m.channel, body: m.body });
        if (act) created.push(act);
        await update(prospectId, patch);
        if (advance) {
          const sc = await addActivity(prospectId, { kind: "stage_change", body: `${ready.stages.find((s) => s.id === before.stage_id)?.name ?? "?"} → ${advance.name}` });
          if (sc) created.push(sc);
        }
        toast(`Message enregistré, relance dans ${RELANCE_DAYS} jours`, {
          undo: async () => {
            try { await repo.deleteMessage(msg.id); } catch (e) { fail(e, "Annulation incomplète"); }
            for (const a of created) await repo.deleteActivity(a.id).catch(() => undefined);
            setActivityTick((n) => n + 1);
            await update(prospectId, before);
          },
        });
        return true;
      },
      signOut: async () => { await repo.signOut(); toLogin(); },
      toasts, toast, dismissToast, undoLast,
      quickAddOpen, setQuickAddOpen, paletteOpen, setPaletteOpen,
    };
  }, [ready, repo, prospects, activityTick, toasts, toast, dismissToast, undoLast, meId, fail, replace, quickAddOpen, paletteOpen]);

  if (state.status === "loading") return <>{fallback({ status: "loading" })}</>;
  if (state.status === "error") return <>{fallback(state)}</>;
  if (!state.ref.me && repo.mode === "supabase") return <>{fallback({ status: "no-profile", signOut: () => repo.signOut().then(() => { toLogin(); }) })}</>;
  return <Ctx.Provider value={api!}>{children}</Ctx.Provider>;
}
