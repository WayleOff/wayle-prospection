import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Retour du lien magique (flux PKCE) : échange le code contre une session puis ouvre l'application. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  let detail = params.get("error_description") ?? (code ? "" : "aucun code reçu dans le lien");
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
    detail = error.message;
  }
  const to = new URL("/login", request.url);
  to.searchParams.set("erreur", "lien");
  if (detail) to.searchParams.set("detail", detail.slice(0, 200));
  return NextResponse.redirect(to);
}
