"use client";
import { LogOut } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui";

export default function Page() {
  const { ref, mode, signOut, prospects } = useApp();
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
      <p className="text-sm text-muted">Les réglages des modèles de messages, des séquences, des offres et de la clé Claude s’ajouteront avec les étapes correspondantes.</p>
    </div>
  );
}
