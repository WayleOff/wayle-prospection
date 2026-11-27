import { requireMember } from "@/lib/supabase/member";

/** Dit si la clé Claude est configurée (sans jamais la révéler). */
export async function GET() {
  const denied = await requireMember();
  if (denied) return denied;
  return Response.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY), model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5" });
}
