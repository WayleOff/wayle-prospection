import type { Activity, ActivityKind, Channel, Goal, MessageInput, Prospect, ProspectInput, ProspectPatch, Reference, RunStatus, Stage, SentMessage, Sequence, SequenceInput, Invoice, InvoiceInput, Offer, OfferInput, Quote, ScoreRule, SequenceRun, Template, TemplateInput } from "../types";

/**
 * Accès aux données. Deux implémentations : Supabase (production) et mémoire (mode démonstration,
 * NEXT_PUBLIC_DEMO=1, sans compte ni base). Le reste de l'application ne connaît que cette interface.
 */
export interface Repo {
  mode: "demo" | "supabase";
  reference(): Promise<Reference>;
  listProspects(): Promise<Prospect[]>;
  /** Faux tant que la migration « fiche prospect (IA) » n'est pas appliquée : poste, activité, description et SWOT ne sont alors pas enregistrés. */
  hasProspectExtras(): Promise<boolean>;
  /** Fiches archivées (hors de la liste principale), les plus récemment archivées d'abord. */
  listArchivedProspects(): Promise<Prospect[]>;
  /** Suppression définitive (historique, messages, devis et parcours de ces fiches compris). Irréversible. */
  deleteProspects(ids: string[]): Promise<void>;
  /** Enregistre les étapes du pipeline (création, renommage, couleur, type, ordre) ; renvoie la liste à jour, dans l'ordre. */
  saveStages(stages: Stage[]): Promise<Stage[]>;
  /** Supprime une étape après avoir déplacé ses fiches (archivées comprises) vers `moveToId`. */
  deleteStage(id: string, moveToId: string): Promise<void>;
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
  /** Importe des fiches d'un seul coup (lot annulable). Le score doit déjà figurer dans chaque `input`. */
  importProspects(origin: "csv" | "notion", mapping: Record<string, string>, rows: { input: ProspectInput; tag_ids: string[] }[], skipped: number, authorId: string | null): Promise<{ batch_id: string; prospects: Prospect[] }>;
  /** Annule un import : archive les fiches du lot qui ne sont pas déjà archivées ; renvoie leurs identifiants. */
  undoImport(batchId: string): Promise<string[]>;
  /** Critères du score tels qu'enregistrés (peut être vide : on retombe sur les critères de départ). */
  listScoreRules(): Promise<ScoreRule[]>;
  saveScoreRules(rules: ScoreRule[]): Promise<ScoreRule[]>;
  listOffers(): Promise<Offer[]>;
  saveOffer(o: OfferInput): Promise<Offer>;
  deleteOffer(id: string): Promise<void>;
  listQuotes(): Promise<Quote[]>;
  /** Le numéro est choisi par l'appelant ; un numéro déjà pris fait échouer l'appel (message « duplicate »). */
  createQuote(q: Omit<Quote, "id" | "created_at">): Promise<Quote>;
  updateQuote(id: string, patch: Partial<Pick<Quote, "lines" | "total_cents" | "status" | "valid_until" | "notes" | "deposit_percent">>): Promise<Quote>;
  deleteQuote(id: string): Promise<void>;
  listInvoices(): Promise<Invoice[]>;
  /** Importe des factures d'un coup (lot annulable). Un numéro déjà présent fait échouer l'appel : l'appelant les écarte avant. */
  importInvoices(rows: InvoiceInput[], mapping: Record<string, string>, skipped: number): Promise<{ batch_id: string; invoices: Invoice[] }>;
  /** Annule un import de factures : supprime les factures du lot. */
  undoInvoiceImport(batchId: string): Promise<void>;
  updateInvoice(id: string, patch: Partial<Pick<Invoice, "prospect_id" | "paid_on">>): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;
  getSetting<T>(key: string): Promise<T | null>;
  setSetting<T>(key: string, value: T): Promise<void>;
  signOut(): Promise<void>;
}
