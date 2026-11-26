"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Archive, Ban, Check, CalendarClock, ChevronDown, ChevronRight, Columns3, ExternalLink, FileText, Flame, MessageSquare, Phone } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "./app-provider";
import { MessageComposer } from "./message-composer";
import { Dot } from "./ui";
import { HEAT_COLOR, HEAT_LABEL, addDays } from "@/lib/labels";
import { instagramUrl, telHref } from "@/lib/normalize";
import type { Heat } from "@/lib/types";

interface MenuApi {
  /** À brancher sur `onContextMenu` d'une ligne ou d'une carte : ouvre le menu du prospect au pointeur. */
  onContextMenu: (id: string) => (e: ReactMouseEvent) => void;
  /** Ouvre le menu à partir d'un bouton « ⋯ » (clavier, téléphone). */
  openFrom: (id: string, el: HTMLElement) => void;
}
const Ctx = createContext<MenuApi | null>(null);
export const useProspectMenu = (): MenuApi => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useProspectMenu hors ProspectMenuProvider");
  return c;
};

const HEATS: Heat[] = ["cold", "warm", "hot"];
const WIDTH = 272;

export function ProspectMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [composeFor, setComposeFor] = useState<string | null>(null);
  const close = useCallback(() => setMenu(null), []);
  const api = useMemo<MenuApi>(() => ({
    onContextMenu: (id) => (e) => { e.preventDefault(); e.stopPropagation(); setMenu({ id, x: e.clientX, y: e.clientY }); },
    openFrom: (id, el) => { const r = el.getBoundingClientRect(); setMenu({ id, x: r.right, y: r.bottom }); },
  }), []);
  return (
    <Ctx.Provider value={api}>
      {children}
      {menu ? <MenuPopup key={`${menu.id}-${menu.x}-${menu.y}`} {...menu} onClose={close} onCompose={(id) => { setMenu(null); setComposeFor(id); }} /> : null}
      {composeFor ? <MessageComposer prospectId={composeFor} onClose={() => setComposeFor(null)} /> : null}
    </Ctx.Provider>
  );
}

function MenuPopup({ id, x, y, onClose, onCompose }: { id: string; x: number; y: number; onClose: () => void; onCompose: (id: string) => void }) {
  const { byId, ref, update, moveStage, archive, toast } = useApp();
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const [stagesOpen, setStagesOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const p = byId(id);

  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[role^=menuitem]")?.focus({ preventScroll: true });
    const startY = window.scrollY;
    // Un léger défilement résiduel (ouverture depuis un bouton hors de l'écran) ne doit pas refermer le menu.
    const scrolled = (e: Event) => { if (!box.current?.contains(e.target as Node) && (e.target !== document || Math.abs(window.scrollY - startY) > 40)) onClose(); };
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (e.key === "Tab") { onClose(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = Array.from(box.current?.querySelectorAll<HTMLElement>("[role^=menuitem]:not([disabled])") ?? []);
      if (items.length === 0) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus({ preventScroll: true });
    };
    document.addEventListener("mousedown", away, true);
    document.addEventListener("contextmenu", away, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("scroll", scrolled, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", away, true);
      document.removeEventListener("contextmenu", away, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("scroll", scrolled, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  if (!p) return null;
  const left = Math.max(8, Math.min(x, window.innerWidth - WIDTH - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - 500));
  const stages = [...ref.stages].sort((a, b) => a.position - b.position);
  const run = (f: () => void | Promise<void>) => () => { onClose(); void f(); };
  const openFiche = () => { const qs = new URLSearchParams(sp.toString()); qs.set("fiche", id); router.push(`${pathname}?${qs.toString()}`, { scroll: false }); };
  const plan = (days: number) => {
    const before = { next_action_at: p.next_action_at, next_action_label: p.next_action_label };
    void update(id, { next_action_at: addDays(days), next_action_label: p.next_action_label ?? "Relancer" });
    toast(`Relance prévue ${days === 1 ? "demain" : `dans ${days} jours`}`, { undo: () => update(id, before) });
  };
  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none";
  const tel = telHref(p.phone), ig = instagramUrl(p.instagram);

  return createPortal(
    <div ref={box} role="menu" aria-label={`Actions pour ${p.name}`} style={{ left, top, width: WIDTH }} onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[100] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-xl" data-testid="prospect-menu">
      <p className="truncate px-2.5 pb-1.5 pt-1 text-xs font-medium text-muted">{p.name}</p>
      <button role="menuitem" type="button" className={item} onClick={run(openFiche)}><FileText size={15} aria-hidden /> Ouvrir / modifier la fiche</button>
      <button role="menuitem" type="button" className={item} onClick={() => onCompose(id)}><MessageSquare size={15} aria-hidden /> Écrire un message</button>
      {tel ? <a role="menuitem" href={tel} className={item} onClick={onClose}><Phone size={15} aria-hidden /> Appeler</a> : null}
      {ig ? <a role="menuitem" href={ig} target="_blank" rel="noopener noreferrer" className={item} onClick={onClose}><ExternalLink size={15} aria-hidden /> Ouvrir son Instagram</a> : null}

      <div className="my-1 border-t border-border" />
      <button role="menuitem" type="button" aria-expanded={stagesOpen} className={item} onClick={() => setStagesOpen((v) => !v)}>
        <Columns3 size={15} aria-hidden /> Étape <span className="ml-auto text-xs text-muted">{stages.find((s) => s.id === p.stage_id)?.name}</span>
        {stagesOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
      </button>
      {stagesOpen ? (
        <div className="mb-1 ml-3 border-l border-border pl-1.5">
          {stages.map((s) => (
            <button key={s.id} role="menuitem" type="button" className={item} onClick={run(() => (s.id === p.stage_id ? undefined : moveStage(id, s.id)))}>
              <Dot color={s.color} /> <span className="min-w-0 flex-1 truncate">{s.name}</span>{s.id === p.stage_id ? <Check size={14} aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="px-2.5 pb-1 pt-2 text-xs text-muted"><Flame size={12} className="mr-1 inline" aria-hidden />Température</div>
      <div className="flex gap-1 px-1 pb-1" role="group" aria-label="Température">
        {HEATS.map((h) => (
          <button key={h} role="menuitemradio" type="button" aria-checked={p.heat === h} onClick={run(() => (p.heat === h ? undefined : update(id, { heat: h })))}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[13px] ${p.heat === h ? "border-accent bg-accent/10 font-medium" : "border-border hover:bg-subtle"}`}>
            <Dot color={HEAT_COLOR[h]} size={8} /> {HEAT_LABEL[h]}
          </button>
        ))}
      </div>

      <div className="px-2.5 pb-1 pt-2 text-xs text-muted"><CalendarClock size={12} className="mr-1 inline" aria-hidden />Relancer</div>
      <div className="flex gap-1 px-1 pb-1">
        {[[1, "Demain"], [3, "+3 j"], [7, "+7 j"]].map(([d, label]) => (
          <button key={d} role="menuitem" type="button" onClick={run(() => plan(d as number))} className="flex-1 rounded-lg border border-border py-1.5 text-[13px] hover:bg-subtle">{label}</button>
        ))}
      </div>
      {p.next_action_at ? (
        <button role="menuitem" type="button" className={item} onClick={run(() => {
          const before = { next_action_at: p.next_action_at, next_action_label: p.next_action_label };
          void update(id, { next_action_at: null, next_action_label: null });
          toast("Relance retirée", { undo: () => update(id, before) });
        })}>Retirer la relance prévue</button>
      ) : null}

      <div className="my-1 border-t border-border" />
      <button role="menuitem" type="button" className={item} onClick={run(() => {
        const next = !p.do_not_contact;
        void update(id, { do_not_contact: next });
        toast(next ? `« ${p.name} » : ne plus contacter` : `« ${p.name} » : de nouveau contactable`, { undo: () => update(id, { do_not_contact: !next }) });
      })}><Ban size={15} aria-hidden /> {p.do_not_contact ? "Autoriser à nouveau le contact" : "Ne pas contacter"}</button>
      <button role="menuitem" type="button" className={`${item} text-danger`} onClick={run(() => archive(id))}><Archive size={15} aria-hidden /> Archiver (annulable)</button>
    </div>,
    document.body,
  );
}

/** Petit bouton « ⋯ » : le même menu, pour le clavier et le téléphone. */
export function MenuButton({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  const { openFrom } = useProspectMenu();
  return (
    <button type="button" aria-label={`Actions pour ${name}`} aria-haspopup="menu" className={`grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-fg ${className}`}
      onClick={(e) => { e.stopPropagation(); openFrom(id, e.currentTarget); }} onKeyDown={(e) => e.stopPropagation()}>
      <span aria-hidden className="text-lg leading-none">⋯</span>
    </button>
  );
}
