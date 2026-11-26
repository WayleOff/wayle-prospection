"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CornerDownLeft, Plus, Search, User } from "lucide-react";
import { useApp } from "./app-provider";
import { Dialog } from "./ui";
import { NAV } from "./shell";
import { normHandle, normText } from "@/lib/normalize";

interface Item { id: string; label: string; hint?: string; icon: ReactNode; run: () => void }

/** Barre de commande (Ctrl ou Cmd + K) : chercher un prospect ou lancer une action. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useApp();
  return (
    <Dialog open={paletteOpen} onClose={() => setPaletteOpen(false)} variant="modal" label="Barre de commande">
      <Palette />
    </Dialog>
  );
}

function Palette() {
  const { setPaletteOpen, setQuickAddOpen, prospects } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const items = useMemo<Item[]>(() => {
    const close = () => setPaletteOpen(false);
    const needle = normText(q) ?? "";
    const handle = normHandle(q) ?? "";
    const actions: Item[] = [
      { id: "new", label: "Nouveau prospect", hint: "N", icon: <Plus size={16} aria-hidden />, run: () => { close(); setQuickAddOpen(true); } },
      ...NAV.map((n) => ({ id: n.href, label: `Aller à ${n.label}`, icon: <n.icon size={16} aria-hidden />, run: () => { close(); router.push(n.href); } })),
    ].filter((a) => !needle || (normText(a.label) ?? "").includes(needle));
    const found: Item[] = needle
      ? prospects.filter((p) => (normText(p.name) ?? "").includes(needle) || (handle && (normHandle(p.instagram) ?? "").includes(handle)) || (normText(p.email ?? "") ?? "").includes(needle))
          .slice(0, 8)
          .map((p) => ({ id: p.id, label: p.name, hint: p.instagram ?? undefined, icon: <User size={16} aria-hidden />, run: () => { close(); router.push(`/prospects?fiche=${p.id}`); } }))
      : [];
    return [...found, ...actions];
  }, [q, prospects, router, setPaletteOpen, setQuickAddOpen]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); items[idx]?.run(); }
  };

  return (
      <div onKeyDown={onKey}>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search size={16} className="text-muted" aria-hidden />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
            placeholder="Chercher un prospect ou une action…" role="combobox" aria-expanded aria-controls="cp-list" aria-activedescendant={items[idx] ? `cp-${items[idx].id}` : undefined} />
        </div>
        <ul id="cp-list" role="listbox" className="max-h-80 overflow-auto p-1.5">
          {items.length === 0 ? <li className="px-3 py-6 text-center text-sm text-muted">Aucun résultat</li> : null}
          {items.map((it, i) => (
            <li key={it.id} id={`cp-${it.id}`} role="option" aria-selected={i === idx}>
              <button type="button" onClick={it.run} onMouseMove={() => setIdx(i)}
                className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm ${i === idx ? "bg-subtle" : ""}`}>
                <span className="text-muted">{it.icon}</span>
                <span className="flex-1 truncate">{it.label}</span>
                {it.hint ? <span className="text-xs text-muted">{it.hint}</span> : null}
                {i === idx ? <CornerDownLeft size={13} className="text-muted" aria-hidden /> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
  );
}
