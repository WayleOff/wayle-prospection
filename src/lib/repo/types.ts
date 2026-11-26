import type { Activity, ActivityKind, Channel, Goal, MessageInput, Prospect, ProspectInput, ProspectPatch, Reference, RunStatus, SentMessage, Sequence, SequenceInput, SequenceRun, Template, TemplateInput } from "../types";

/**
 * Accès aux données. Deux implémentations : Supabase (production) et mémoire (mode démonstration,
 * NEXT_PUBLIC_DEMO=1, sans compte ni base). Le reste de l'application ne connaît que cette interface.
 */
export interface Repo {
  mode: "demo" | "supabase";
  reference(): Promise<Reference>;
  listProspects(): Promise<Prospect[]>;
  createProspect(input: ProspectInput, authorId: string | null): Promise<Prospect>;
  updateProspect(id: string, patch: ProspectPatch): Promise<Prospect>;
  setTags(id: string, tagIds: string[]): Promise<void>;
  listActivities(prospectId: string): Promise<Activity[]>;
  addActivity(prospectId: string, a: { kind: ActivityKind; channel?: Channel | null; body: string | null }, authorId: string | null): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;
  /** Toutes les entrées d'historique depuis une date (ISO), pour les indicateurs. */
  listActivitiesSince(iso: string): Promise<Activity[]>;
  getGoal(month: string): Promise<Goal | null>;
  setGoal(goal: Goal): Promise<Goal>;
  listTemplates(): Promise<Template[]>;
  saveTemplate(t: TemplateInput): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;
  /** Enregistre un message envoyé (sent_at = maintenant). */
  addMessage(m: MessageInput, authorId: string | null): Promise<SentMessage>;
  deleteMessage(id: string): Promise<void>;
  listMessages(limit: number): Promise<SentMessage[]>;
  listSequences(): Promise<Sequence[]>;
  saveSequence(s: SequenceInput): Promise<Sequence>;
  deleteSequence(id: string): Promise<void>;
  /** Parcours en cours uniquement (status « running »). */
  listRuns(): Promise<SequenceRun[]>;
  createRun(r: { prospect_id: string; sequence_id: string; current_step: number }): Promise<SequenceRun>;
  updateRun(id: string, patch: { current_step?: number; status?: RunStatus }): Promise<SequenceRun>;
  deleteRun(id: string): Promise<void>;
  signOut(): Promise<void>;
}
