import { IS_DEMO } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

/** Dit si la clé Claude est configurée (sans jamais la révéler). */
export async function GET() {
  if (!IS_DEMO) {
    const { data } = await (await supabaseServer()).auth.getUser();
    if (!data.user) return Response.json({ error: "Non connecté." }, { status: 401 });
  }
  return Response.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY), model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5" });
}
