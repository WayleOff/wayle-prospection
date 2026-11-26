"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, inputCls } from "@/components/ui";
import { calendarEvents, groupByDay, monthGrid } from "@/lib/calendar";
import { today } from "@/lib/labels";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

export default function Page() {
  const { prospects, ref, quotes, update } = useApp();
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const todayStr = today();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState(todayStr);

  const events = useMemo(() => calendarEvents(prospects, ref.stages, quotes, todayStr), [prospects, ref.stages, quotes, todayStr]);
  const byDay = useMemo(() => groupByDay(events), [events]);
  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const title = cap(new Date(cursor.y, cursor.m, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
  const step = (n: number) => setCursor((c) => { const d = new Date(c.y, c.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const goToday = () => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); setSelected(todayStr); };
  const open = (id: string) => { const qs = new URLSearchParams(sp.toString()); qs.set("fiche", id); router.push(`${pathname}?${qs.toString()}`, { scroll: false }); };
  const dayEvents = byDay.get(selected) ?? [];
  const late = events.filter((e) => e.late && e.kind === "action").length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold">Calendrier</h1>
        <Button size="sm" onClick={() => step(-1)} aria-label="Mois précédent"><ChevronLeft size={15} aria-hidden /></Button>
        <h2 className="min-w-36 text-center text-sm font-medium" aria-live="polite" data-testid="cal-title">{title}</h2>
        <Button size="sm" onClick={() => step(1)} aria-label="Mois suivant"><ChevronRight size={15} aria-hidden /></Button>
        <Button size="sm" onClick={goToday}>Aujourd’hui</Button>
        {late > 0 ? <span className="ml-auto text-sm text-danger">{late} relance{late > 1 ? "s" : ""} en retard</span> : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div role="grid" aria-label={`Calendrier de ${title}`} className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div role="row" className="grid grid-cols-7 border-b border-border text-center text-xs text-muted">
            {DAYS.map((d) => <div key={d} role="columnheader" className="py-2">{d}</div>)}
          </div>
          {grid.map((week, wi) => (
            <div key={wi} role="row" className="grid grid-cols-7 border-b border-border last:border-b-0">
              {week.map((d) => {
                const evs = byDay.get(d.day) ?? [];
                const n = evs.length, hasLate = evs.some((e) => e.late);
                const sel = d.day === selected;
                return (
                  <button key={d.day} role="gridcell" type="button" onClick={() => setSelected(d.day)} aria-selected={sel} aria-label={`${new Date(d.day + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}${n ? `, ${n} élément${n > 1 ? "s" : ""}` : ""}`}
                    className={`flex min-h-16 flex-col items-start gap-1 border-r border-border p-1.5 text-left last:border-r-0 hover:bg-subtle sm:min-h-20 ${d.inMonth ? "" : "bg-subtle/50 text-muted"} ${sel ? "outline outline-2 -outline-offset-2 outline-[var(--accent)]" : ""}`}>
                    <span className={`grid size-6 place-items-center rounded-full text-xs tabular-nums ${d.day === todayStr ? "bg-accent font-semibold text-accent-fg" : ""}`}>{Number(d.day.slice(8))}</span>
                    {n > 0 ? (
                      <span className="hidden w-full min-w-0 space-y-0.5 sm:block">
                        {evs.slice(0, 2).map((e) => <span key={e.id} className={`block truncate rounded px-1 text-[11px] ${e.late ? "bg-red-500/15 text-red-700 dark:text-red-300" : e.kind === "quote" ? "bg-blue-500/15 text-blue-700 dark:text-blue-300" : "bg-accent/15"}`}>{e.title}</span>)}
                        {n > 2 ? <span className="block px-1 text-[11px] text-muted">+ {n - 2}</span> : null}
                      </span>
                    ) : null}
                    {n > 0 ? <span className={`mt-auto rounded-full px-1.5 text-[11px] sm:hidden ${hasLate ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-accent/15"}`}>{n}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <aside aria-labelledby="cal-day" className="rounded-2xl border border-border bg-surface p-4 lg:self-start">
          <h2 id="cal-day" className="text-sm font-semibold" data-testid="cal-day">{cap(new Date(selected + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}</h2>
          {dayEvents.length === 0 ? <p className="mt-3 text-sm text-muted">Rien de prévu ce jour-là.</p> : (
            <ul className="mt-3 space-y-3">
              {dayEvents.map((e) => (
                <li key={e.id} className="text-sm" data-testid="cal-item">
                  <button type="button" onClick={() => open(e.prospectId)} className="flex w-full items-start gap-2 text-left hover:underline">
                    {e.kind === "quote" ? <FileText size={14} aria-hidden className="mt-0.5 shrink-0 text-muted" /> : null}
                    <span className="min-w-0"><span className="block truncate font-medium">{e.title}</span><span className={`block text-xs ${e.late ? "text-danger" : "text-muted"}`}>{e.detail}{e.late ? " · en retard" : ""}</span></span>
                  </button>
                  {e.kind === "action" ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <label htmlFor={`mv-${e.id}`} className="text-xs text-muted">Reporter au</label>
                      <input id={`mv-${e.id}`} type="date" className={`${inputCls} !h-8 !w-auto`} value={e.day} onChange={(ev) => { if (ev.target.value) { void update(e.prospectId, { next_action_at: ev.target.value }); setSelected(ev.target.value); } }} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
