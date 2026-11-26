import { IS_DEMO } from "@/lib/env";
import { AiError, generateVariants, parseInput } from "@/lib/ai/generate";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Réécrit un modèle de message avec Claude. Réservé aux comptes connectés ; la clé reste côté serveur. */
export async function POST(request: Request) {
  if (!IS_DEMO) {
    const { data } = await (await supabaseServer()).auth.getUser();
    if (!data.user) return Response.json({ error: "Non connecté." }, { status: 401 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "no_key", message: "La clé Claude n'est pas configurée (ANTHROPIC_API_KEY)." }, { status: 503 });

  const text = await request.text();
  if (text.length > 20000) return Response.json({ error: "Requête trop grosse." }, { status: 413 });
  let raw: unknown = null;
  try { raw = JSON.parse(text); } catch { /* traité ci-dessous */ }
  const input = parseInput(raw);
  if (!input) return Response.json({ error: "Requête incomplète." }, { status: 400 });

  try {
    const variants = await generateVariants(input, { apiKey, model: process.env.ANTHROPIC_MODEL || undefined, baseUrl: process.env.ANTHROPIC_BASE_URL });
    return Response.json({ variants });
  } catch (e) {
    if (e instanceof AiError) return Response.json({ error: e.code, message: e.message }, { status: e.status });
    return Response.json({ error: "unknown", message: "Erreur inattendue." }, { status: 500 });
  }
}
