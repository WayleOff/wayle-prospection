"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Button, inputCls } from "@/components/ui";
import { IS_DEMO, SUPABASE_CONFIGURED } from "@/lib/env";
import { supabaseBrowser } from "@/lib/supabase/browser";

function Form() {
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setState("error");
      setMessage(/signups? not allowed|not found/i.test(error.message)
        ? "Cette adresse n’est pas invitée. Demandez à Jonas de l’ajouter à l’équipe."
        : "L’envoi a échoué. Vérifiez l’adresse et réessayez dans une minute.");
    } else setState("sent");
  };

  if (IS_DEMO) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted">Mode démonstration : pas de connexion, les données sont fictives et restent dans ce navigateur.</p>
        <a href="/aujourdhui" className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg">Ouvrir la démonstration</a>
      </div>
    );
  }
  if (!SUPABASE_CONFIGURED) {
    return <p className="rounded-xl border border-border bg-subtle p-4 text-sm text-muted">La base de données n’est pas encore reliée (variables <code>NEXT_PUBLIC_SUPABASE_URL</code> et <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> absentes). Suivez le fichier README pour la configurer.</p>;
  }
  if (state === "sent") {
    return (
      <div className="text-center" role="status">
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-subtle"><Mail size={20} aria-hidden /></div>
        <h2 className="text-base font-semibold">Vérifiez votre boîte mail</h2>
        <p className="mt-1.5 text-sm text-muted">Un lien de connexion vient d’être envoyé à <strong className="text-fg">{email}</strong>. Il est valable une heure.</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {sp.get("erreur") === "lien" ? <p role="alert" className="rounded-lg border border-danger/40 p-3 text-sm text-danger">Ce lien n’est plus valable. Demandez-en un nouveau ci-dessous.</p> : null}
      <label htmlFor="email" className="block text-sm font-medium">Adresse e-mail</label>
      <input id="email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="vous@exemple.fr" />
      {state === "error" ? <p role="alert" className="text-sm text-danger">{message}</p> : null}
      <Button variant="primary" type="submit" disabled={state === "sending" || !email.trim()} className="w-full">{state === "sending" ? "Envoi…" : "Recevoir un lien de connexion"}</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-lg font-bold text-accent-fg">W</span>
          <h1 className="text-lg font-semibold">Wayle · Prospection</h1>
          <p className="text-sm text-muted">Accès réservé à l’équipe, sans mot de passe.</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5"><Suspense fallback={null}><Form /></Suspense></div>
      </div>
    </main>
  );
}
