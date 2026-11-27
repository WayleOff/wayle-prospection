export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_CONFIGURED = SUPABASE_URL !== "" && SUPABASE_KEY !== "";
/**
 * Mode démonstration : aucune connexion, données dans le navigateur (NEXT_PUBLIC_DEMO=1).
 * Garde-fou : il ne s'active jamais quand Supabase est configuré. Un NEXT_PUBLIC_DEMO=1 oublié sur le projet de
 * production ne peut donc pas désactiver la connexion.
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1" && !SUPABASE_CONFIGURED;
