import type { Activity, ActivityKind, Channel, Goal, Prospect, ProspectInput, ProspectPatch, Reference } from "../types";

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
  signOut(): Promise<void>;
}
