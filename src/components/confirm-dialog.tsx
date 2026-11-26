"use client";
import { useState } from "react";
import { Dialog, Button } from "./ui";

/** Confirmation d'une action irréversible. Le bouton reste inactif pendant l'opération. */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onClose }: {
  open: boolean; title: string; children: React.ReactNode; confirmLabel: string;
  onConfirm: () => Promise<unknown> | void; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); onClose(); } };
  return (
    <Dialog open={open} onClose={onClose} variant="modal" label={title}>
      <div className="p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy} autoFocus>Annuler</Button>
          <Button variant="danger" onClick={() => void go()} disabled={busy} className="!border-danger/50 !text-danger">{busy ? "Suppression…" : confirmLabel}</Button>
        </div>
      </div>
    </Dialog>
  );
}
