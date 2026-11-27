import { AiError } from "@/lib/ai/generate";
import { analyzeProspect, parseAnalysisInput } from "@/lib/ai/analyze";
import { fetchSiteInfo } from "@/lib/ai/site-text";
import { requireMember } from "@/lib/supabase/member";

export const maxDuration = 60;

/** Description d'activité + SWOT de la communication vidéo, rédigés par Claude. Réservé aux comptes connectés ; la clé reste côté serveur. */
export async function POST(request: Request) {
  const denied = await requireMember();
  if (denied) return denied;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "no_key", message: "La clé Claude n'est pas configurée (ANTHROPIC_API_KEY)." }, { status: 503 });

  const text = await request.text();
  if (text.length > 20000) return Response.json({ error: "Requête trop grosse." }, { status: 413 });
  let raw: unknown = null;
  try { raw = JSON.parse(text); } catch { /* traité ci-dessous */ }
  const input = parseAnalysisInput(raw);
  if (!input) return Response.json({ error: "Requête incomplète." }, { status: 400 });

  const site = input.website ? await fetchSiteInfo(input.website) : null;
  try {
    const out = await analyzeProspect(input, site, { apiKey, model: process.env.ANTHROPIC_MODEL || undefined, baseUrl: process.env.ANTHROPIC_BASE_URL, timeoutMs: 55000 });
    return Response.json({ ...out, sources: { site: !!site, siteUrl: site?.url ?? null, websiteGiven: !!input.website } });
  } catch (e) {
    if (e instanceof AiError) return Response.json({ error: e.code, message: e.message }, { status: e.status });
    return Response.json({ error: "unknown", message: "Erreur inattendue." }, { status: 500 });
  }
}
