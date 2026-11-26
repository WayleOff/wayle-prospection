"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useApp } from "./app-provider";
import { dialogStore } from "./dialog-store";

/**
 * Messages éphémères (avec « Annuler »). Un « popover » vit dans la couche supérieure du navigateur ; mais une boîte
 * de dialogue modale rend inertes tous les éléments situés hors d'elle. Les messages sont donc affichés dans la boîte
 * de dialogue la plus haute quand il y en a une (scope « dialog »), sinon dans la page (scope « page »).
 */
export function Toasts({ scope, owner }: { scope: "page" | "dialog"; owner?: object }) {
  const { toasts, dismissToast } = useApp();
  const box = useRef<HTMLDivElement>(null);
  const top = useSyncExternalStore(dialogStore.subscribe, () => dialogStore.top(), () => null);
  const active = scope === "page" ? top === null : top === owner;
  useEffect(() => {
    const el = box.current;
    if (!el || typeof el.showPopover !== "function") return;
    if (el.matches(":popover-open")) el.hidePopover();
    if (active && toasts.length > 0) el.showPopover();
  }, [toasts, active]);
  return (
    <div ref={box} popover="manual" className="toasts pointer-events-none flex flex-col items-center gap-2 px-3" role="status" aria-live="polite">
      {active ? toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-lg ${t.kind === "error" ? "border-danger/40 bg-surface text-danger" : "border-border bg-fg text-bg"}`}>
          <span>{t.message}</span>
          {t.undo ? (
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => { const u = t.undo; dismissToast(t.id); void u?.(); }}>Annuler</button>
          ) : null}
        </div>
      )) : null}
    </div>
  );
}
