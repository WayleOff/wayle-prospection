import type { Activity, Goal, Invoice, Stage, Offer, Prospect, Quote, ScoreRule, SentMessage, Sequence, SequenceRun, Template } from "../types";
import type { Repo } from "./types";
import { DEMO_ACTIVITIES, DEMO_REFERENCE, activityDate, demoProspects } from "./demo-data";
import { starterTemplates } from "../message";
import { normalizeSteps } from "../sequence";

const KEY = "wayle-prospection-demo-v1";
interface Store { prospects: Prospect[]; activities: Activity[]; goals?: Goal[]; templates?: Template[]; messages?: SentMessage[]; sequences?: Sequence[]; runs?: SequenceRun[]; scoreRules?: ScoreRule[]; batches?: Record<string, string[]>; offers?: Offer[]; quotes?: Quote[]; settings?: Record<string, unknown>; invoices?: Invoice[]; invoiceBatches?: Record<string, string[]>; stages?: Stage[] }

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function seed(): Store {
  const prospects = demoProspects().map((p) => ({ ...p, id: uid() }));
  const activities = DEMO_ACTIVITIES.map(([name, kind, channel, body, d]) => ({
    id: uid(), prospect_id: prospects.find((p) => p.name === name)!.id, kind, channel, body, author_id: null, created_at: activityDate(d),
  }));
  return { prospects, activities };
}

/** Mode démonstration : tout reste dans le navigateur (localStorage). */
export function createDemoRepo(): Repo {
  let store: Store | null = null;
  const load = (): Store => {
    if (store) return store;
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
      if (raw) { store = JSON.parse(raw) as Store; return store; }
    } catch { /* stockage indisponible : on repart du jeu de départ */ }
    store = seed();
    return store;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignoré */ } };

  return {
    mode: "demo",
    async reference() { return { ...DEMO_REFERENCE, stages: structuredClone(load().stages ?? DEMO_REFERENCE.stages) }; },
    async saveStages(stages) { const s = load(); s.stages = structuredClone(stages).sort((a, b) => a.position - b.position); save(); return structuredClone(s.stages); },
    async deleteStage(id, moveToId) {
      const s = load();
      for (const p of s.prospects) if (p.stage_id === id) p.stage_id = moveToId;
      s.stages = (s.stages ?? DEMO_REFERENCE.stages).filter((x) => x.id !== id); save();
    },
    async hasProspectExtras() { return true; },
    async listProspects() { return structuredClone(load().prospects.filter((p) => !p.archived_at)); },
    async listArchivedProspects() {
      return structuredClone(load().prospects.filter((p) => p.archived_at).sort((a, b) => (b.archived_at ?? "").localeCompare(a.archived_at ?? "")));
    },
    async deleteProspects(ids) {
      const s = load(); const gone = new Set(ids);
      s.prospects = s.prospects.filter((p) => !gone.has(p.id));
      s.activities = s.activities.filter((a) => !gone.has(a.prospect_id));
      s.messages = (s.messages ?? []).filter((m) => !gone.has(m.prospect_id));
      s.runs = (s.runs ?? []).filter((r) => !gone.has(r.prospect_id));
      s.quotes = (s.quotes ?? []).filter((q) => !gone.has(q.prospect_id));
      for (const i of s.invoices ?? []) if (i.prospect_id && gone.has(i.prospect_id)) i.prospect_id = null;
      save();
    },
    async createProspect(input, authorId) {
      const now = new Date().toISOString();
      const p: Prospect = {
        category_id: null, owner_id: authorId, heat: "cold", preferred_channel: null, address: null, district: null, lat: null, lng: null,
        website: null, instagram: null, tiktok: null, linkedin: null, email: null, phone: null, contact_first_name: null,
        contact_last_name: null, contact_role: null, activity: null, ai_description: null, ai_swot: null, ai_analyzed_at: null, opened_on: null, source: null, score: 0, est_amount_cents: null, highlights: null, ig_activity: null,
        is_independent: true, next_action_label: null, next_action_at: null, do_not_contact: false, lost_reason: null, archived_at: null,
        ...input, id: uid(), created_at: now, updated_at: now, tag_ids: [],
      };
      load().prospects.unshift(p); save();
      return structuredClone(p);
    },
    async updateProspect(id, patch) {
      const p = load().prospects.find((x) => x.id === id);
      if (!p) throw new Error("Fiche introuvable");
      Object.assign(p, patch, { updated_at: new Date().toISOString() }); save();
      return structuredClone(p);
    },
    async setTags(id, tagIds) {
      const p = load().prospects.find((x) => x.id === id);
      if (p) { p.tag_ids = [...tagIds]; save(); }
    },
    async listActivities(prospectId) {
      return load().activities.filter((a) => a.prospect_id === prospectId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async addActivity(prospectId, a, authorId) {
      const act: Activity = { id: uid(), prospect_id: prospectId, kind: a.kind, channel: a.channel ?? null, body: a.body, author_id: authorId, created_at: new Date().toISOString() };
      load().activities.push(act); save();
      return structuredClone(act);
    },
    async deleteActivity(id) {
      const s = load(); s.activities = s.activities.filter((a) => a.id !== id); save();
    },
    async listActivitiesSince(iso) {
      return structuredClone(load().activities.filter((a) => a.created_at >= iso));
    },
    async getGoal(month) { return structuredClone(load().goals?.find((g) => g.month === month) ?? null); },
    async setGoal(goal) {
      const s = load();
      s.goals = [...(s.goals ?? []).filter((g) => g.month !== goal.month), goal]; save();
      return structuredClone(goal);
    },
    async listTemplates() {
      const s = load();
      s.templates ??= starterTemplates(DEMO_REFERENCE.categories).map((t) => ({ ...t, id: uid() }));
      save();
      return structuredClone(s.templates);
    },
    async saveTemplate(t) {
      const s = load();
      s.templates ??= [];
      const saved: Template = { ...t, id: t.id ?? uid() };
      s.templates = t.id ? s.templates.map((x) => (x.id === t.id ? saved : x)) : [...s.templates, saved];
      save();
      return structuredClone(saved);
    },
    async deleteTemplate(id) { const s = load(); s.templates = (s.templates ?? []).filter((t) => t.id !== id); save(); },
    async addMessage(m, authorId) {
      const s = load();
      const msg: SentMessage = { ...m, id: uid(), sent_at: new Date().toISOString(), author_id: authorId, created_at: new Date().toISOString() };
      s.messages = [msg, ...(s.messages ?? [])]; save();
      return structuredClone(msg);
    },
    async deleteMessage(id) { const s = load(); s.messages = (s.messages ?? []).filter((m) => m.id !== id); save(); },
    async listMessages(limit) { return structuredClone((load().messages ?? []).slice(0, limit)); },
    async listSequences() { return structuredClone(load().sequences ?? []); },
    async saveSequence(input) {
      const s = load();
      s.sequences ??= [];
      const saved: Sequence = { id: input.id ?? uid(), name: input.name, is_active: input.is_active, steps: normalizeSteps(input.steps).map((st) => ({ ...st, id: st.id ?? uid() })) };
      s.sequences = input.id ? s.sequences.map((x) => (x.id === input.id ? saved : x)) : [...s.sequences, saved];
      save();
      return structuredClone(saved);
    },
    async deleteSequence(id) {
      const s = load();
      s.sequences = (s.sequences ?? []).filter((x) => x.id !== id);
      s.runs = (s.runs ?? []).filter((r) => r.sequence_id !== id);
      save();
    },
    async listRuns() { return structuredClone((load().runs ?? []).filter((r) => r.status === "running")); },
    async createRun(r) {
      const s = load();
      s.runs ??= [];
      if (s.runs.some((x) => x.prospect_id === r.prospect_id && x.status === "running")) throw new Error("Une séquence est déjà en cours pour ce prospect");
      const run: SequenceRun = { ...r, id: uid(), status: "running", started_at: new Date().toISOString() };
      s.runs.push(run); save();
      return structuredClone(run);
    },
    async updateRun(id, patch) {
      const run = (load().runs ?? []).find((x) => x.id === id);
      if (!run) throw new Error("Séquence introuvable");
      Object.assign(run, patch); save();
      return structuredClone(run);
    },
    async deleteRun(id) { const s = load(); s.runs = (s.runs ?? []).filter((x) => x.id !== id); save(); },
    async importProspects(origin, mapping, rows, skipped, authorId) {
      void origin; void mapping; void skipped;
      const s = load();
      const now = new Date().toISOString();
      const batchId = uid();
      const prospects = rows.map((r): Prospect => ({
        category_id: null, owner_id: authorId, heat: "cold", preferred_channel: null, address: null, district: null, lat: null, lng: null,
        website: null, instagram: null, tiktok: null, linkedin: null, email: null, phone: null, contact_first_name: null,
        contact_last_name: null, contact_role: null, activity: null, ai_description: null, ai_swot: null, ai_analyzed_at: null, opened_on: null, source: null, score: 0, est_amount_cents: null, highlights: null, ig_activity: null,
        is_independent: true, next_action_label: null, next_action_at: null, do_not_contact: false, lost_reason: null, archived_at: null,
        ...r.input, id: uid(), created_at: now, updated_at: now, tag_ids: [...r.tag_ids],
      }));
      s.prospects.unshift(...prospects);
      (s.batches ??= {})[batchId] = prospects.map((p) => p.id);
      save();
      return { batch_id: batchId, prospects: structuredClone(prospects) };
    },
    async undoImport(batchId) {
      const s = load();
      const ids = s.batches?.[batchId] ?? [];
      const at = new Date().toISOString();
      const done: string[] = [];
      for (const p of s.prospects) if (ids.includes(p.id) && !p.archived_at) { p.archived_at = at; done.push(p.id); }
      save();
      return done;
    },
    async listScoreRules() { return structuredClone(load().scoreRules ?? []); },
    async saveScoreRules(rules) { load().scoreRules = structuredClone(rules); save(); return structuredClone(rules); },
    async listOffers() { return structuredClone(load().offers ?? []).sort((a, b) => a.name.localeCompare(b.name, "fr")); },
    async saveOffer(o) {
      const s = load(); const list = (s.offers ??= []);
      const row: Offer = { id: o.id ?? uid(), name: o.name, description: o.description, price_cents: o.price_cents, is_recurring: o.is_recurring, is_active: o.is_active };
      const i = list.findIndex((x) => x.id === row.id);
      if (i >= 0) list[i] = row; else list.push(row);
      save(); return structuredClone(row);
    },
    async deleteOffer(id) { const s = load(); s.offers = (s.offers ?? []).filter((o) => o.id !== id); save(); },
    async listQuotes() { return structuredClone(load().quotes ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async createQuote(q) {
      const s = load(); const list = (s.quotes ??= []);
      if (list.some((x) => x.number === q.number)) throw new Error('duplicate key value violates unique constraint "quotes_number_key"');
      const row: Quote = { ...q, deposit_percent: q.deposit_percent ?? 0, id: uid(), created_at: new Date().toISOString() };
      list.push(row); save(); return structuredClone(row);
    },
    async updateQuote(id, patch) {
      const row = (load().quotes ?? []).find((x) => x.id === id);
      if (!row) throw new Error("Devis introuvable");
      Object.assign(row, patch); save(); return structuredClone(row);
    },
    async deleteQuote(id) { const s = load(); s.quotes = (s.quotes ?? []).filter((q) => q.id !== id); save(); },
    async listInvoices() { return structuredClone(load().invoices ?? []).sort((a, b) => (b.issued_on ?? "").localeCompare(a.issued_on ?? "") || a.number.localeCompare(b.number)); },
    async importInvoices(rows, mapping, skipped) {
      void mapping; void skipped;
      const s = load(); const list = (s.invoices ??= []);
      const dup = rows.find((r) => list.some((x) => x.number === r.number));
      if (dup) throw new Error(`duplicate key value violates unique constraint "invoices_number_key" (${dup.number})`);
      const now = new Date().toISOString();
      const created: Invoice[] = rows.map((r) => ({ ...r, id: uid(), created_at: now }));
      list.push(...created);
      const batchId = uid();
      (s.invoiceBatches ??= {})[batchId] = created.map((i) => i.id);
      save();
      return { batch_id: batchId, invoices: structuredClone(created) };
    },
    async undoInvoiceImport(batchId) {
      const s = load(); const ids = s.invoiceBatches?.[batchId] ?? [];
      s.invoices = (s.invoices ?? []).filter((i) => !ids.includes(i.id)); save();
    },
    async updateInvoice(id, patch) {
      const row = (load().invoices ?? []).find((i) => i.id === id);
      if (!row) throw new Error("Facture introuvable");
      Object.assign(row, patch); save(); return structuredClone(row);
    },
    async deleteInvoice(id) { const s = load(); s.invoices = (s.invoices ?? []).filter((i) => i.id !== id); save(); },
    async getSetting<T>(key: string) { return (structuredClone(load().settings?.[key]) ?? null) as T | null; },
    async setSetting(key, value) { const s = load(); (s.settings ??= {})[key] = structuredClone(value); save(); },
    async signOut() { /* pas de compte en démonstration */ },
  };
}

/** Efface les modifications faites en démonstration. */
export function resetDemo() { try { localStorage.removeItem(KEY); } catch { /* ignoré */ } }
