import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IS_DEMO, SUPABASE_CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from "./lib/env";

/**
 * Rafraîchit la session Supabase et renvoie vers /login les visiteurs non connectés.
 * Désactivé en mode démonstration. La vraie protection des données reste les droits par ligne (RLS) de la base.
 */
export async function proxy(request: NextRequest) {
  if (IS_DEMO) return NextResponse.next();
  const { pathname } = request.nextUrl;
  const open = pathname === "/login" || pathname.startsWith("/auth/");
  if (!SUPABASE_CONFIGURED) {
    return open ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && !open) return NextResponse.redirect(new URL("/login", request.url));
  if (data.user && pathname === "/login") return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
