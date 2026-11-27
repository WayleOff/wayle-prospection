import { IS_DEMO } from "../env";
import { supabaseServer } from "./server";

/** Ce dont on a besoin du client Supabase pour vérifier un accès (permet de tester sans réseau). */
export interface AuthLike {
  auth: { getUser: () => Promise<{ data: { user: unknown } }> };
  rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * Réservé aux membres de l'équipe : connecté ET invité (profil créé par le déclencheur d'invitation).
 * Un compte créé hors invitation est « connecté » mais n'est pas membre : il ne doit pas pouvoir
 * utiliser la clé Claude (coût) ni lancer de requêtes sortantes depuis le serveur.
 * Renvoie une réponse d'erreur à retourner telle quelle, ou null si l'accès est accordé.
 */
export async function memberError(supabase: AuthLike): Promise<Response | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return Response.json({ error: "Non connecté." }, { status: 401 });
  const { data: ok, error } = await supabase.rpc("is_member");
  if (error || ok !== true) return Response.json({ error: "Accès réservé à l'équipe." }, { status: 403 });
  return null;
}

/** Version des routes API : sans objet en mode démonstration (aucune connexion). */
export async function requireMember(): Promise<Response | null> {
  if (IS_DEMO) return null;
  return memberError((await supabaseServer()) as unknown as AuthLike);
}
