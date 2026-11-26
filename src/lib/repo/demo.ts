import type { Activity, Goal, Prospect, SentMessage, Template } from "../types";
import type { Repo } from "./types";
import { DEMO_ACTIVITIES, DEMO_REFERENCE, activityDate, demoProspects } from "./demo-data";
import { starterTemplates } from "../message";

const KEY = "wayle-prospection-demo-v1";
interface Store { prospects: Prospect[]; activities: Activity[]; goals?: Goal[]; templates?: Template[]; messages?: SentMessage[] }

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
    async reference() { return DEMO_REFERENCE; },
    async listProspects() { return structuredClone(load().prospects); },
    async createProspect(input, authorId) {
      const now = new Date().toISOString();
      const p: Prospect = {
        category_id: null, owner_id: authorId, heat: "cold", preferred_channel: null, address: null, district: null, lat: null, lng: null,
        website: null, instagram: null, tiktok: null, linkedin: null, email: null, phone: null, contact_first_name: null,
        contact_last_name: null, opened_on: null, source: null, score: 0, est_amount_cents: null, highlights: null, ig_activity: null,
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
    async signOut() { /* pas de compte en démonstration */ },
  };
}

/** Efface les modifications faites en démonstration. */
export function resetDemo() { try { localStorage.removeItem(KEY); } catch { /* ignoré */ } }
