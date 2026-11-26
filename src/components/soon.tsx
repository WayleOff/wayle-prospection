import type { ReactNode } from "react";
import { Empty } from "./ui";

/** Page pas encore construite : on le dit clairement plutôt que d'afficher un écran vide. */
export function Soon({ title, icon, text }: { title: string; icon: ReactNode; text: string }) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-border"><Empty icon={icon} title="Pas encore construit" text={text} /></div>
    </div>
  );
}
