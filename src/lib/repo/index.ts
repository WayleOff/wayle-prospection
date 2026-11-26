import { IS_DEMO } from "../env";
import { supabaseBrowser } from "../supabase/browser";
import { createDemoRepo } from "./demo";
import { createSupabaseRepo } from "./supabase";
import type { Repo } from "./types";

let repo: Repo | null = null;
/** Démonstration ou Supabase selon NEXT_PUBLIC_DEMO. */
export function getRepo(): Repo {
  repo ??= IS_DEMO ? createDemoRepo() : createSupabaseRepo(supabaseBrowser());
  return repo;
}
export type { Repo } from "./types";
