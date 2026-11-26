import type { SupabaseClient } from "@supabase/supabase-js";
import type { Activity, Category, Goal, Profile, Prospect, Reference, Stage, Tag } from "../types";
import type { Repo } from "./types";

type Row = Record<string, unknown> & { id: string; prospect_tags?: { tag_id: string }[] };

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

    async signOut() { await sb.auth.signOut(); },
  };
}
