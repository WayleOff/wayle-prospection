"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BarChart3, CalendarCheck, Columns3, Command, Map, MessageSquare, Moon, MoreHorizontal, Package, Plus, Search, Settings, Sun, Users } from "lucide-react";
import { AppProvider, useApp } from "./app-provider";
import { Button } from "./ui";
import { QuickAdd } from "./quick-add";
import { CommandPalette } from "./command-palette";
import { ProspectSheet } from "./prospect-sheet";

export const NAV = [
  { href: "/aujourdhui", label: "Aujourd'hui", icon: CalendarCheck },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/prospects", label: "Prospects", icon: Users },
  { href: "/carte", label: "Carte", icon: Map },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/offres", label: "Offres", icon: Package },
  { href: "/statistiques", label: "Statistiques", icon: BarChart3 },
  { href: "/parametres", label: "Paramètres", icon: Settings },
] as const;

function Screen({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center bg-bg p-6 text-center">{children}</div>;
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <AppProvider
      fallback={(s) =>
        s.status === "loading" ? (
          <Screen><p className="text-sm text-muted" role="status">Chargement…</p></Screen>
        ) : s.status === "error" ? (
          <Screen>
            <div className="max-w-sm">
              <h1 className="text-base font-semibold">Chargement impossible</h1>
              <p className="mt-2 text-sm text-muted">{s.message}</p>
              <Button className="mt-4" onClick={() => location.reload()}>Réessayer</Button>
            </div>
          </Screen>
        ) : (
          <Screen>
            <div className="max-w-sm">
              <h1 className="text-base font-semibold">Accès non autorisé</h1>
              <p className="mt-2 text-sm text-muted">Votre adresse e-mail n’est pas sur la liste d’invitation de l’équipe. Demandez à Jonas de l’ajouter, puis reconnectez-vous.</p>
              <Button className="mt-4" onClick={() => void s.signOut()}>Se déconnecter</Button>
            </div>
          </Screen>
        )
      }
    >
      <Frame>{children}</Frame>
    </AppProvider>
  );
}

function isTyping(el: EventTarget | null) {
  const e = el as HTMLElement | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable);
}

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}

function Frame({ children }: { children: ReactNode }) {
  const app = useApp();
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.classList.contains("dark"), () => false);
  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("wayle-theme", next ? "dark" : "light"); } catch { /* ignoré */ }
  };

  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) { setSeenPath(pathname); setMore(false); } // le menu « Plus » se ferme à chaque changement de page

  const { setQuickAddOpen, setPaletteOpen, undoLast, toast } = app;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); return; }
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey && !isTyping(e.target)) { e.preventDefault(); undoLast(); return; }
      if (mod || e.altKey || isTyping(e.target) || document.querySelector("dialog[open].modal")) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setQuickAddOpen(true); }
      else if (e.key === "/") {
        e.preventDefault();
        const box = document.querySelector<HTMLInputElement>("[data-search]");
        if (box) box.focus(); else setPaletteOpen(true);
      }
      else if (e.key === "m" || e.key === "M") toast("Le générateur de messages arrive à l'étape d.");
      else if (e.key === "r" || e.key === "R") window.dispatchEvent(new Event("wayle:relance"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setQuickAddOpen, setPaletteOpen, undoLast, toast]);

  const mainNav = NAV.slice(0, 4);
  const moreNav = NAV.slice(4);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-dvh md:pl-56">
      {/* Barre latérale (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 px-4">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-fg">W</span>
          <span className="text-sm font-semibold">Wayle · Prospection</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-2" aria-label="Navigation principale">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}
              className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm ${isActive(href) ? "bg-subtle font-medium" : "text-muted hover:bg-subtle hover:text-fg"}`}>
              <Icon size={17} aria-hidden /> {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 text-[13px]">
              <div className="truncate font-medium">{app.ref.me?.name ?? "Mode démonstration"}</div>
              {app.mode === "demo" ? <div className="text-xs text-muted">Données fictives, dans ce navigateur</div> : null}
            </div>
            <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"} className="!px-2">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          </div>
        </div>
      </aside>

      {/* Barre du haut */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-bg/85 px-3 backdrop-blur md:px-6">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-fg md:hidden">W</span>
        <button type="button" onClick={() => setPaletteOpen(true)}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left text-sm text-muted hover:border-muted/50 md:max-w-md md:flex-none md:w-80">
          <Search size={15} aria-hidden /> <span className="flex-1 truncate">Rechercher un prospect ou une action…</span>
          <kbd className="hidden items-center gap-0.5 rounded border border-border px-1.5 text-[11px] md:flex"><Command size={10} aria-hidden />K</kbd>
        </button>
        <div className="ml-auto hidden md:block">
          <Button variant="primary" onClick={() => setQuickAddOpen(true)}><Plus size={16} aria-hidden /> Nouveau prospect <kbd className="ml-1 rounded bg-white/20 px-1 text-[11px]">N</kbd></Button>
        </div>
        <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"} className="!px-2 md:hidden">
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </Button>
      </header>

      <main className="px-3 pb-28 pt-5 md:px-6 md:pb-10">{children}</main>

      {/* Navigation téléphone */}
      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {mainNav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}
            className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${isActive(href) ? "font-medium text-accent" : "text-muted"}`}>
            <Icon size={20} aria-hidden /> {label}
          </Link>
        ))}
        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more}
          className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${moreNav.some((n) => isActive(n.href)) ? "font-medium text-accent" : "text-muted"}`}>
          <MoreHorizontal size={20} aria-hidden /> Plus
        </button>
        {more ? (
          <div className="absolute bottom-full right-2 mb-2 w-48 rounded-xl border border-border bg-surface p-1 shadow-lg">
            {moreNav.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex h-11 items-center gap-2.5 rounded-lg px-3 text-sm hover:bg-subtle"><Icon size={17} aria-hidden /> {label}</Link>
            ))}
          </div>
        ) : null}
      </nav>
      <button type="button" aria-label="Nouveau prospect" onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-20 right-4 z-30 grid size-12 place-items-center rounded-full bg-accent text-accent-fg shadow-lg md:hidden">
        <Plus size={22} aria-hidden />
      </button>

      <QuickAdd />
      <CommandPalette />
      <ProspectSheet />
      <Toasts />
    </div>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useApp();
  const box = useRef<HTMLDivElement>(null);
  // Un « popover » vit dans la couche supérieure du navigateur : il reste visible au-dessus d'une fiche ouverte.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof el.showPopover !== "function") return;
    if (el.matches(":popover-open")) el.hidePopover();
    if (toasts.length > 0) el.showPopover();
  }, [toasts]);
  return (
    <div ref={box} popover="manual" className="toasts pointer-events-none flex flex-col items-center gap-2 px-3" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-lg ${t.kind === "error" ? "border-danger/40 bg-surface text-danger" : "border-border bg-fg text-bg"}`}>
          <span>{t.message}</span>
          {t.undo ? (
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => { const u = t.undo; dismissToast(t.id); void u?.(); }}>Annuler</button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
