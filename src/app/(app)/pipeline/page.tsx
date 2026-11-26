"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragStartEvent, type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { Plus, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Dot, inputCls } from "@/components/ui";
import { CHANNEL_LABEL, DISTRICT_LABEL, HEAT_COLOR, HEAT_LABEL, fmtDue, fmtEuros } from "@/lib/labels";
import type { Channel, District, Prospect, Stage } from "@/lib/types";

/** Au clavier, les flèches gauche/droite font passer la carte à la colonne voisine (et non de 25 pixels en 25 pixels). */
const columnKeyboard: KeyboardCoordinateGetter = (event, { context: { droppableRects, droppableContainers, collisionRect } }) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return undefined;
  event.preventDefault();
  if (!collisionRect) return undefined;
  const cols = droppableContainers.getEnabled()
    .map((c) => ({ rect: droppableRects.get(c.id) }))
    .filter((c): c is { rect: NonNullable<typeof c.rect> } => !!c.rect)
    .sort((a, b) => a.rect.left - b.rect.left);
  const cx = collisionRect.left + collisionRect.width / 2;
  const here = Math.max(0, cols.findIndex((c) => cx >= c.rect.left && cx <= c.rect.left + c.rect.width));
  const target = cols[Math.min(cols.length - 1, Math.max(0, here + (event.code === "ArrowRight" ? 1 : -1)))];
  return target ? { x: target.rect.left + (target.rect.width - collisionRect.width) / 2, y: target.rect.top + 48 } : undefined;
};

const NO_FILTER = { cat: "", district: "", channel: "", owner: "", tag: "" };

export default function Page() {
  const { prospects, ref, moveStage, byId, setQuickAddOpen } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [f, setF] = useState(NO_FILTER);
  const [dragging, setDragging] = useState<string | null>(null);
  const justDragged = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }), // appui long : le défilement reste possible
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] }, coordinateGetter: columnKeyboard }),
  );

  const filtered = useMemo(() => prospects.filter((p) =>
    (!f.cat || p.category_id === f.cat) && (!f.district || p.district === f.district) && (!f.channel || p.preferred_channel === f.channel)
    && (!f.owner || (f.owner === "none" ? !p.owner_id : p.owner_id === f.owner)) && (!f.tag || p.tag_ids.includes(f.tag))), [prospects, f]);
  const active = Object.values(f).some(Boolean);

  const byStage = useMemo(() => {
    const m = new Map<string, Prospect[]>(ref.stages.map((s) => [s.id, []]));
    for (const p of filtered) m.get(p.stage_id)?.push(p);
    for (const l of m.values()) l.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "fr"));
    return m;
  }, [filtered, ref.stages]);

  const open = (id: string) => {
    if (justDragged.current) return;
    const qs = new URLSearchParams(sp.toString()); qs.set("fiche", id);
    router.push(`${pathname}?${qs.toString()}`, { scroll: false });
  };

  const onStart = (e: DragStartEvent) => { justDragged.current = true; setDragging(String(e.active.id)); };
  const onEnd = (e: DragEndEvent) => {
    setDragging(null);
    window.setTimeout(() => { justDragged.current = false; }, 80);
    if (e.over) void moveStage(String(e.active.id), String(e.over.id));
  };
  const onCancel = () => { setDragging(null); window.setTimeout(() => { justDragged.current = false; }, 80); };

  const stageName = (id: unknown) => ref.stages.find((s) => s.id === id)?.name ?? "";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Carte « ${byId(String(active.id))?.name} » prise.`,
    onDragOver: ({ over }) => (over ? `Au-dessus de la colonne « ${stageName(over.id)} ».` : "Hors d'une colonne."),
    onDragEnd: ({ active, over }) => (over ? `Carte « ${byId(String(active.id))?.name} » déposée dans « ${stageName(over.id)} ».` : "Carte remise à sa place."),
    onDragCancel: () => "Déplacement annulé.",
  };

  const sel = (key: keyof typeof f, label: string, options: { value: string; label: string }[], extra?: { value: string; label: string }[]) => (
    <select aria-label={label} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className={`${inputCls} !w-auto min-w-0 max-w-44 shrink-0 ${f[key] ? "border-accent/60" : ""}`}>
      <option value="">{label}</option>
      {extra?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const dragged = dragging ? byId(dragging) : undefined;

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <span className="text-sm text-muted" aria-live="polite">{filtered.length}{active ? ` sur ${prospects.length}` : ""} prospect{(active ? prospects.length : filtered.length) > 1 ? "s" : ""}</span>
        <span className="text-xs text-muted">Glissez une carte pour changer d’étape (appui long sur téléphone).</span>
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {sel("cat", "Catégorie", ref.categories.map((c) => ({ value: c.id, label: c.name })))}
        {sel("district", "Quartier", Object.entries(DISTRICT_LABEL).map(([value, label]) => ({ value, label })))}
        {sel("channel", "Canal", Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label })))}
        {sel("owner", "Responsable", ref.profiles.map((p) => ({ value: p.id, label: p.name })), [{ value: "none", label: "Sans responsable" }])}
        {sel("tag", "Étiquette", ref.tags.map((t) => ({ value: t.id, label: t.name })))}
        {active ? <Button variant="ghost" size="sm" onClick={() => setF(NO_FILTER)} className="shrink-0"><X size={14} aria-hidden /> Effacer</Button> : null}
      </div>

      {prospects.length === 0 ? (
        <div className="mt-8 text-center text-sm text-muted">Aucun prospect pour l’instant. <Button size="sm" className="ml-2" onClick={() => setQuickAddOpen(true)}><Plus size={14} aria-hidden /> Nouveau prospect</Button></div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={onCancel}
          accessibility={{ announcements, screenReaderInstructions: { draggable: "Appuyez sur Espace pour prendre la carte, les flèches pour changer de colonne, Espace pour la déposer, Échap pour annuler. Entrée ouvre la fiche." } }}>
          <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-4" role="list" aria-label="Étapes du pipeline">
            {ref.stages.map((s) => <Column key={s.id} stage={s} items={byStage.get(s.id) ?? []} onOpen={open} dragging={dragging} />)}
          </div>
          <DragOverlay dropAnimation={null}>{dragged ? <CardBody p={dragged} overlay /> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function Column({ stage, items, onOpen, dragging }: { stage: Stage; items: Prospect[]; onOpen: (id: string) => void; dragging: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = items.reduce((n, p) => n + (p.est_amount_cents ?? 0), 0);
  return (
    <section ref={setNodeRef} role="listitem" aria-label={`${stage.name}, ${items.length} prospect${items.length > 1 ? "s" : ""}`}
      className={`flex w-[17.5rem] shrink-0 snap-start flex-col rounded-2xl border bg-subtle/50 transition-colors ${isOver ? "border-accent bg-accent/10" : "border-border"}`}>
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <Dot color={stage.color} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{stage.name}</h2>
        <span className="text-xs text-muted tabular-nums">{items.length}</span>
      </header>
      {total > 0 ? <div className="px-3 pb-1 text-xs text-muted">{fmtEuros(total)} estimés</div> : null}
      <ul className="flex min-h-24 flex-1 flex-col gap-2 p-2 pt-1">
        {items.map((p) => <li key={p.id}><Card p={p} onOpen={onOpen} hidden={dragging === p.id} /></li>)}
        {items.length === 0 ? <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-border py-6 text-xs text-muted">{dragging ? "Déposer ici" : "Aucun prospect"}</li> : null}
      </ul>
    </section>
  );
}

function Card({ p, onOpen, hidden }: { p: Prospect; onOpen: (id: string) => void; hidden: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: p.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={() => onOpen(p.id)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(p.id); else listeners?.onKeyDown?.(e); }}
      className={`cursor-grab touch-manipulation rounded-xl outline-offset-2 active:cursor-grabbing ${hidden ? "opacity-30" : ""}`}>
      <CardBody p={p} />
    </div>
  );
}

function CardBody({ p, overlay }: { p: Prospect; overlay?: boolean }) {
  const { ref } = useApp();
  const cat = ref.categories.find((c) => c.id === p.category_id)?.name;
  const owner = ref.profiles.find((x) => x.id === p.owner_id);
  const due = fmtDue(p.next_action_at);
  const meta = [cat, p.preferred_channel ? CHANNEL_LABEL[p.preferred_channel as Channel] : null, p.district ? DISTRICT_LABEL[p.district as District] : null].filter(Boolean).join(" · ");
  return (
    <div className={`rounded-xl border border-border bg-surface p-3 text-left ${overlay ? "rotate-1 shadow-xl" : "hover:border-muted/60"}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 text-sm font-medium leading-snug">{p.name}</div>
        <span title={`Chaleur : ${HEAT_LABEL[p.heat]}`} className="mt-1 inline-flex" aria-label={`Chaleur : ${HEAT_LABEL[p.heat]}`}><Dot color={HEAT_COLOR[p.heat]} size={9} /></span>
      </div>
      {meta ? <div className="mt-0.5 truncate text-xs text-muted">{meta}</div> : null}
      <div className="mt-2 flex items-center gap-2 text-xs">
        {p.est_amount_cents ? <span className="rounded-md bg-subtle px-1.5 py-0.5 font-medium tabular-nums">{fmtEuros(p.est_amount_cents)}</span> : null}
        {due ? <span className={`min-w-0 flex-1 truncate ${due.late ? "font-medium text-danger" : "text-muted"}`}>{p.next_action_label ? `${p.next_action_label} · ` : ""}{due.text}</span> : <span className="flex-1" />}
        {owner ? <span title={owner.name} className="ml-auto"><Dot color={owner.color} size={9} /></span> : null}
      </div>
    </div>
  );
}
