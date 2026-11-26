"use client";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui";
import { ScoreSettings } from "@/components/score-settings";

export default function Page() {
  const { ref, mode, signOut, prospects } = useApp();
  const [claude, setClaude] = useState<{ configured: boolean; model: string } | null | "error">(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/messages/status").then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => { if (alive) setClaude(j); }).catch(() => { if (alive) setClaude("error"); });
    return () => { alive = false; };
  }, []);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Paramètres</h1>
      <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="p-compte">
        <h2 id="p-compte" className="text-sm font-semibold">Compte</h2>
        <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Connecté en tant que</dt><dd>{ref.me?.name ?? "—"}</dd>
          <dt className="text-muted">Équipe</dt><dd>{ref.profiles.map((p) => p.name).join(", ") || "—"}</dd>
          <dt className="text-muted">Prospects</dt><dd>{prospects.length}</dd>
          <dt className="text-muted">Mode</dt><dd>{mode === "demo" ? "Démonstration (données fictives dans ce navigateur)" : "Base de données Supabase"}</dd>
        </dl>
        {mode === "supabase" ? <Button className="mt-4" onClick={() => void signOut()}><LogOut size={15} aria-hidden /> Se déconnecter</Button> : null}
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="p-claude">
        <h2 id="p-claude" className="text-sm font-semibold">Claude (rédaction des messages)</h2>
        <p className="mt-3 text-sm" role="status">
          {claude === null ? "Vérification…" : claude === "error" ? "État indisponible pour le moment." : claude.configured ? `Clé configurée. Modèle utilisé : ${claude.model}.` : "Clé non configurée : sans frais, utilise « Brief pour Claude » avec ton abonnement Claude (copie la fiche, colle-la dans Claude, puis recolle sa réponse). Les modèles restent utilisables."}
        </p>
        <p className="mt-2 text-xs text-muted">La clé reste côté serveur : elle se règle dans Vercel (Settings → Environment Variables → <code>ANTHROPIC_API_KEY</code>), puis un redéploiement. Le détail est dans le README.</p>
      </section>
      <ScoreSettings />
      <p className="text-sm text-muted">Les réglages des séquences, des offres et des colonnes du pipeline s’ajouteront avec les étapes correspondantes.</p>
    </div>
  );
}
