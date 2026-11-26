"use client";
import { Copy } from "lucide-react";
import { useApp } from "./app-provider";
import { Button } from "./ui";
import { PROSPECT_AI_SQL } from "@/lib/migrations";

/** À afficher quand la base n'a pas encore les colonnes « fiche prospect (IA) » : le SQL à coller dans Supabase. */
export function ProspectSqlNotice({ what }: { what: string }) {
  const { toast } = useApp();
  return (
    <div role="note" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p className="font-medium">{what} : une mise à jour de la base est nécessaire.</p>
      <p className="mt-1 text-xs text-muted">Dans Supabase → SQL Editor, collez et lancez ceci (une seule fois, sans risque pour vos données), puis rechargez la page.</p>
      <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-surface p-2 text-xs">{PROSPECT_AI_SQL}</pre>
      <Button size="sm" className="mt-2" onClick={() => { void navigator.clipboard?.writeText(PROSPECT_AI_SQL).then(() => toast("SQL copié")); }}><Copy size={13} aria-hidden /> Copier le SQL</Button>
    </div>
  );
}
