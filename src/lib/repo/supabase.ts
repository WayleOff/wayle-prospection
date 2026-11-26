import type { SupabaseClient } from "@supabase/supabase-js";
import type { Activity, Category, Goal, Invoice, Profile, Prospect, Offer, Quote, Reference, ScoreRule, SentMessage, Sequence, SequenceRun, SequenceStep, Stage, Tag, Template } from "../types";
import { normalizeSteps } from "../sequence";
import type { Repo } from "./types";

type Row = Record<string, unknown> & { id: string; prospect_tags?: { tag_id: string }[] };

const MESSAGE_COLS = "id, prospect_id, template_id, channel, variant, body, written_by_ai, sent_at, author_id, created_at";
const STEP_COLS = "id, step_no, day_offset, action, channel, template_id, label";
const RUN_COLS = "id, prospect_id, sequence_id, current_step, status, started_at";
type SeqRow = { id: string; name: string; is_active: boolean; sequence_steps: (Omit<SequenceStep, "label"> & { label: string | null })[] };
const toSequence = (r: SeqRow): Sequence => ({
  id: r.id, name: r.name, is_active: r.is_active,
  steps: [...(r.sequence_steps ?? [])].sort((a, b) => a.step_no - b.step_no).map((s) => ({ ...s, label: s.label ?? "" })),
});
const QUOTE_COLS_BASE = "id, number, prospect_id, lines, total_cents, status, created_at, valid_until, notes";
const QUOTE_COLS = `${QUOTE_COLS_BASE}, deposit_percent`;
const INVOICE_COLS = "id, number, prospect_id, client_name, issued_on, paid_on, total_ht_cents, vat_cents, total_cents, kind, source, created_at";
const OFFER_COLS = "id, name, description, price_cents, is_recurring, is_active";
const PAGE = 1000; // limite de lignes par requête de l'API Supabase

/** Colonnes techniques de la base qui n'existent pas côté application. */
const HIDDEN = ["name_norm", "instagram_norm", "phone_norm", "import_batch_id", "created_by", "prospect_tags"];

function toProspect(r: Row): Prospect {
  const copy: Record<string, unknown> = { ...r };
  for (const k of HIDDEN) delete copy[k];
  return { ...(copy as unknown as Omit<Prospect, "tag_ids">), tag_ids: (r.prospect_tags ?? []).map((t) => t.tag_id) };
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

/** Implémentation Supabase : les droits par ligne (RLS) de la base décident de ce que chaque compte voit. */
export function createSupabaseRepo(sb: SupabaseClient): Repo {
  let depositColumn = true; // devient faux si la migration « acompte » n'est pas appliquée
  return {
    mode: "supabase",

    async reference(): Promise<Reference> {
      const [stages, categories, tags, profiles, user] = await Promise.all([
        sb.from("stages").select("*").order("position"),
        sb.from("categories").select("*").order("position"),
        sb.from("tags").select("*").order("name"),
        sb.from("profiles").select("*").order("name"),
        sb.auth.getUser(),
      ]);
      fail(stages.error); fail(categories.error); fail(tags.error); fail(profiles.error);
      const list = profiles.data as Profile[];
      return {
        stages: stages.data as Stage[],
        categories: categories.data as Category[],
        tags: tags.data as Tag[],
        profiles: list,
        me: list.find((p) => p.id === user.data.user?.id) ?? null,
      };
    },

    async saveStages(stages) {
      const { data, error } = await sb.from("stages").upsert(stages.map(({ id, name, position, kind, color }) => ({ id, name, position, kind, color })), { onConflict: "id" }).select("*");
      fail(error);
      return (data as Stage[]).sort((a, b) => a.position - b.position);
    },

    async deleteStage(id, moveToId) {
      const moved = await sb.from("prospects").update({ stage_id: moveToId }).eq("stage_id", id);
      fail(moved.error);
      const { error } = await sb.from("stages").delete().eq("id", id);
      fail(error);
    },

    async listProspects() {
      const out: Prospect[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await sb.from("prospects").select("*, prospect_tags(tag_id)")
          .is("archived_at", null).order("created_at", { ascending: false }).order("id").range(from, from + PAGE - 1);
        fail(error);
        out.push(...(data as Row[]).map(toProspect));
        if (data.length < PAGE) break;
      }
      return out;
    },

    async createProspect(input, authorId) {
      const { data, error } = await sb.from("prospects")
        .insert({ owner_id: authorId, ...input, created_by: authorId })
        .select("*, prospect_tags(tag_id)").single();
      fail(error);
      return toProspect(data as Row);
    },

    async updateProspect(id, patch) {
      const { data, error } = await sb.from("prospects").update(patch).eq("id", id).select("*, prospect_tags(tag_id)").single();
      fail(error);
      return toProspect(data as Row);
    },

    async setTags(id, tagIds) {
      const current = await sb.from("prospect_tags").select("tag_id").eq("prospect_id", id);
      fail(current.error);
      const have = new Set((current.data as { tag_id: string }[]).map((t) => t.tag_id));
      const want = new Set(tagIds);
      const remove = [...have].filter((t) => !want.has(t));
      const add = [...want].filter((t) => !have.has(t));
      if (remove.length) { const r = await sb.from("prospect_tags").delete().eq("prospect_id", id).in("tag_id", remove); fail(r.error); }
      if (add.length) { const r = await sb.from("prospect_tags").insert(add.map((tag_id) => ({ prospect_id: id, tag_id }))); fail(r.error); }
    },

    async listActivities(prospectId) {
      const { data, error } = await sb.from("activities").select("id, prospect_id, kind, channel, body, author_id, created_at")
        .eq("prospect_id", prospectId).order("created_at", { ascending: false });
      fail(error);
      return data as Activity[];
    },

    async addActivity(prospectId, a, authorId) {
      const { data, error } = await sb.from("activities")
        .insert({ prospect_id: prospectId, kind: a.kind, channel: a.channel ?? null, body: a.body, author_id: authorId })
        .select("id, prospect_id, kind, channel, body, author_id, created_at").single();
      fail(error);
      return data as Activity;
    },

    async deleteActivity(id) {
      const { error } = await sb.from("activities").delete().eq("id", id);
      fail(error);
    },

    async listActivitiesSince(iso) {
      const { data, error } = await sb.from("activities").select("id, prospect_id, kind, channel, body, author_id, created_at")
        .gte("created_at", iso).order("created_at", { ascending: false }).limit(5000);
      fail(error);
      return data as Activity[];
    },

    async getGoal(month) {
      const { data, error } = await sb.from("goals").select("month, revenue_cents, contacts").eq("month", month).maybeSingle();
      fail(error);
      return (data as Goal | null) ?? null;
    },

    async setGoal(goal) {
      const { data, error } = await sb.from("goals").upsert(goal, { onConflict: "month" }).select("month, revenue_cents, contacts").single();
      fail(error);
      return data as Goal;
    },

    async listTemplates() {
      const { data, error } = await sb.from("templates").select("id, name, channel, category_id, tone, body").order("name");
      fail(error);
      return data as Template[];
    },

    async saveTemplate(t) {
      const row = { name: t.name, channel: t.channel, category_id: t.category_id, tone: t.tone, body: t.body };
      const q = t.id ? sb.from("templates").update(row).eq("id", t.id) : sb.from("templates").insert(row);
      const { data, error } = await q.select("id, name, channel, category_id, tone, body").single();
      fail(error);
      return data as Template;
    },

    async deleteTemplate(id) {
      const { error } = await sb.from("templates").delete().eq("id", id);
      fail(error);
    },

    async addMessage(m, authorId) {
      const { data, error } = await sb.from("messages")
        .insert({ ...m, sent_at: new Date().toISOString(), author_id: authorId }).select(MESSAGE_COLS).single();
      fail(error);
      return data as SentMessage;
    },

    async deleteMessage(id) {
      const { error } = await sb.from("messages").delete().eq("id", id);
      fail(error);
    },

    async listMessages(limit) {
      const { data, error } = await sb.from("messages").select(MESSAGE_COLS).order("created_at", { ascending: false }).limit(limit);
      fail(error);
      return data as SentMessage[];
    },

    async listSequences() {
      const { data, error } = await sb.from("sequences").select(`id, name, is_active, sequence_steps(${STEP_COLS})`).order("name");
      fail(error);
      return (data as unknown as SeqRow[]).map(toSequence);
    },

    async saveSequence(input) {
      const row = { name: input.name, is_active: input.is_active };
      const q = input.id ? sb.from("sequences").update(row).eq("id", input.id) : sb.from("sequences").insert(row);
      const { data, error } = await q.select("id, name, is_active").single();
      fail(error);
      const seq = data as { id: string; name: string; is_active: boolean };
      const steps = normalizeSteps(input.steps);
      const del = await sb.from("sequence_steps").delete().eq("sequence_id", seq.id);
      fail(del.error);
      if (steps.length) {
        const ins = await sb.from("sequence_steps").insert(steps.map((s) => ({
          sequence_id: seq.id, step_no: s.step_no, day_offset: s.day_offset, action: s.action, channel: s.channel, template_id: s.template_id, label: s.label,
        }))).select(STEP_COLS);
        fail(ins.error);
        return toSequence({ ...seq, sequence_steps: ins.data as SeqRow["sequence_steps"] });
      }
      return { ...seq, steps: [] };
    },

    async deleteSequence(id) {
      const { error } = await sb.from("sequences").delete().eq("id", id);
      fail(error);
    },

    async listRuns() {
      const { data, error } = await sb.from("sequence_runs").select(RUN_COLS).eq("status", "running");
      fail(error);
      return data as SequenceRun[];
    },

    async createRun(r) {
      const { data, error } = await sb.from("sequence_runs").insert({ ...r, status: "running" }).select(RUN_COLS).single();
      fail(error);
      return data as SequenceRun;
    },

    async updateRun(id, patch) {
      const { data, error } = await sb.from("sequence_runs").update(patch).eq("id", id).select(RUN_COLS).single();
      fail(error);
      return data as SequenceRun;
    },

    async deleteRun(id) {
      const { error } = await sb.from("sequence_runs").delete().eq("id", id);
      fail(error);
    },

    async importProspects(origin, mapping, rows, skipped, authorId) {
      const batch = await sb.from("import_batches").insert({ origin, column_mapping: mapping, created_count: rows.length, skipped_count: skipped }).select("id").single();
      fail(batch.error);
      const batchId = (batch.data as { id: string }).id;
      const prospects: Prospect[] = [];
      try {
        for (let i = 0; i < rows.length; i += 200) {
          // Identifiants fixés ici : les étiquettes se rattachent sans dépendre de l'ordre des lignes renvoyées.
          const chunk = rows.slice(i, i + 200).map((r) => ({ ...r, id: crypto.randomUUID() }));
          const { data, error } = await sb.from("prospects")
            .insert(chunk.map((r) => ({ id: r.id, owner_id: authorId, ...r.input, created_by: authorId, import_batch_id: batchId })))
            .select("*, prospect_tags(tag_id)");
          fail(error);
          const tagRows = chunk.flatMap((r) => r.tag_ids.map((tag_id) => ({ prospect_id: r.id, tag_id })));
          if (tagRows.length) { const t = await sb.from("prospect_tags").insert(tagRows); fail(t.error); }
          const byId = new Map(chunk.map((r) => [r.id, r.tag_ids]));
          prospects.push(...(data as Row[]).map(toProspect).map((p) => ({ ...p, tag_ids: byId.get(p.id) ?? [] })));
        }
      } catch (e) {
        // Import interrompu : on retire ce qui a déjà été créé pour ne pas laisser un lot à moitié.
        await sb.from("prospects").update({ archived_at: new Date().toISOString() }).eq("import_batch_id", batchId);
        await sb.from("import_batches").update({ undone_at: new Date().toISOString() }).eq("id", batchId);
        throw e;
      }
      return { batch_id: batchId, prospects };
    },

    async undoImport(batchId) {
      const at = new Date().toISOString();
      const { data, error } = await sb.from("prospects").update({ archived_at: at }).eq("import_batch_id", batchId).is("archived_at", null).select("id");
      fail(error);
      const done = await sb.from("import_batches").update({ undone_at: at }).eq("id", batchId);
      fail(done.error);
      return (data as { id: string }[]).map((r) => r.id);
    },

    async listScoreRules() {
      const { data, error } = await sb.from("score_rules").select("key, label, weight, is_active, params");
      fail(error);
      return data as ScoreRule[];
    },

    async saveScoreRules(rules) {
      const { data, error } = await sb.from("score_rules").upsert(
        rules.map((r) => ({ key: r.key, label: r.label, weight: r.weight, is_active: r.is_active, params: r.params })), { onConflict: "key" },
      ).select("key, label, weight, is_active, params");
      fail(error);
      return data as ScoreRule[];
    },

    async listOffers() {
      const { data, error } = await sb.from("offers").select(OFFER_COLS).order("name");
      fail(error);
      return data as Offer[];
    },

    async saveOffer(o) {
      const row = { name: o.name, description: o.description, price_cents: o.price_cents, is_recurring: o.is_recurring, is_active: o.is_active };
      const q = o.id ? sb.from("offers").update(row).eq("id", o.id) : sb.from("offers").insert(row);
      const { data, error } = await q.select(OFFER_COLS).single();
      fail(error);
      return data as Offer;
    },

    async deleteOffer(id) {
      const { error } = await sb.from("offers").delete().eq("id", id);
      fail(error);
    },

    async listQuotes() {
      // Base pas encore mise à jour pour l'acompte ? On lit sans cette colonne : les devis restent utilisables en attendant la migration.
      const read = (cols: string) => sb.from("quotes").select(cols).order("created_at", { ascending: false }).limit(2000);
      let res = await read(QUOTE_COLS);
      if (res.error && /deposit_percent/.test(res.error.message)) {
        depositColumn = false;
        res = await read(QUOTE_COLS_BASE);
      }
      fail(res.error);
      return (res.data as unknown as Quote[]).map((q) => ({ ...q, deposit_percent: q.deposit_percent ?? 0 }));
    },

    async createQuote(q) {
      const { deposit_percent: _dp, ...rest } = q; void _dp;
      const cols: string = depositColumn ? QUOTE_COLS : QUOTE_COLS_BASE;
      const { data, error } = await sb.from("quotes").insert(depositColumn ? q : rest).select(cols).single();
      fail(error);
      const row = data as unknown as Quote;
      return { ...row, deposit_percent: row.deposit_percent ?? 0 };
    },

    async updateQuote(id, patch) {
      const { deposit_percent: _dp, ...rest } = patch; void _dp;
      const cols: string = depositColumn ? QUOTE_COLS : QUOTE_COLS_BASE;
      const { data, error } = await sb.from("quotes").update(depositColumn ? patch : rest).eq("id", id).select(cols).single();
      fail(error);
      const row = data as unknown as Quote;
      return { ...row, deposit_percent: row.deposit_percent ?? 0 };
    },

    async deleteQuote(id) {
      const { error } = await sb.from("quotes").delete().eq("id", id);
      fail(error);
    },

    async listInvoices() {
      const out: Invoice[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await sb.from("invoices").select(INVOICE_COLS).order("issued_on", { ascending: false, nullsFirst: false }).order("number").range(from, from + PAGE - 1);
        fail(error);
        out.push(...(data as Invoice[]));
        if (data.length < PAGE) break;
      }
      return out;
    },

    async importInvoices(rows, mapping, skipped) {
      const batch = await sb.from("import_batches").insert({ origin: "csv", column_mapping: mapping, created_count: rows.length, skipped_count: skipped }).select("id").single();
      fail(batch.error);
      const batchId = (batch.data as { id: string }).id;
      const invoices: Invoice[] = [];
      try {
        for (let i = 0; i < rows.length; i += 200) {
          const { data, error } = await sb.from("invoices").insert(rows.slice(i, i + 200).map((r) => ({ ...r, import_batch_id: batchId }))).select(INVOICE_COLS);
          fail(error);
          invoices.push(...(data as Invoice[]));
        }
      } catch (e) {
        await sb.from("invoices").delete().eq("import_batch_id", batchId);
        await sb.from("import_batches").update({ undone_at: new Date().toISOString() }).eq("id", batchId);
        throw e;
      }
      return { batch_id: batchId, invoices };
    },

    async undoInvoiceImport(batchId) {
      const { error } = await sb.from("invoices").delete().eq("import_batch_id", batchId);
      fail(error);
      const done = await sb.from("import_batches").update({ undone_at: new Date().toISOString() }).eq("id", batchId);
      fail(done.error);
    },

    async updateInvoice(id, patch) {
      const { data, error } = await sb.from("invoices").update(patch).eq("id", id).select(INVOICE_COLS).single();
      fail(error);
      return data as Invoice;
    },

    async deleteInvoice(id) {
      const { error } = await sb.from("invoices").delete().eq("id", id);
      fail(error);
    },

    async getSetting<T>(key: string) {
      const { data, error } = await sb.from("settings").select("value").eq("key", key).maybeSingle();
      fail(error);
      return ((data as { value: T } | null)?.value ?? null) as T | null;
    },

    async setSetting(key, value) {
      const { error } = await sb.from("settings").upsert({ key, value }, { onConflict: "key" });
      fail(error);
    },

    async signOut() { await sb.auth.signOut(); },
  };
}
