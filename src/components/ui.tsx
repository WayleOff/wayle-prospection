"use client";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" };
export function Button({ variant = "secondary", size = "md", className = "", ...p }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none";
  const sz = size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm";
  const v = {
    primary: "bg-accent text-accent-fg hover:opacity-90",
    secondary: "border border-border bg-surface hover:bg-subtle",
    ghost: "hover:bg-subtle",
    danger: "border border-border bg-surface text-danger hover:bg-subtle",
  }[variant];
  return <button type="button" className={`${base} ${sz} ${v} ${className}`} {...p} />;
}

export const inputCls = "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm placeholder:text-muted/70 hover:border-muted/50";

/** Boîte de dialogue native (focus piégé, Échap pour fermer). `drawer` = panneau latéral. */
export function Dialog({ open, onClose, variant, label, children }: { open: boolean; onClose: () => void; variant: "drawer" | "modal"; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Sur téléphone, on évite d'ouvrir le clavier : le panneau ne met pas le focus sur son premier champ.
      if (variant === "drawer") (document.activeElement as HTMLElement | null)?.blur();
    }
    if (!open && d.open) d.close();
  }, [open, variant]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={variant}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {open ? children : null}
    </dialog>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return <Button variant="ghost" size="sm" aria-label="Fermer" onClick={onClick} className="!px-2"><X size={16} /></Button>;
}

export function Empty({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-subtle text-muted">{icon}</div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1.5 text-sm text-muted">{text}</p>
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ background: color, width: size, height: size }} />;
}
