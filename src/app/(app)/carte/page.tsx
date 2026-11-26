"use client";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Dot, inputCls } from "@/components/ui";
import { geocode } from "@/lib/geocode";
import { addDays, today } from "@/lib/labels";
import type { MapPoint } from "@/components/prospect-map";

const ProspectMap = dynamic(() => import("@/components/prospect-map"), { ssr: false, loading: () => <div className="grid h-full min-h-80 place-items-center rounded-2xl border border-border text-sm text-muted">Chargement de la carte…</div> });

export default function Page() {
  const { prospects, ref, update, toast } = useApp();
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const [category, setCategory] = useState("");
  const [stage, setStage] = useState("");
  const [planned, setPlanned] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const stageById = useMemo(() => new Map(ref.stages.map((s) => [s.id, s])), [ref.stages]);
  const catName = useMemo(() => new Map(ref.categories.map((c) => [c.id, c.name])), [ref.categories]);
  const live = useMemo(() => prospects.filter((p) => !p.archived_at), [prospects]);
  const weekAhead = addDays(7);
  const shown = useMemo(() => live.filter((p) => (!category || p.category_id === category) && (!stage || p.stage_id === stage) && (!planned || (p.next_action_at != null && p.next_action_at <= weekAhead && stageById.get(p.stage_id)?.kind === "open"))), [live, category, stage, planned, weekAhead, stageById]);
  const points = useMemo<MapPoint[]>(() => shown.filter((p) => p.lat != null && p.lng != null).map((p) => ({
    id: p.id, name: p.name, lat: p.lat!, lng: p.lng!, color: stageById.get(p.stage_id)?.color ?? "#64748b",
    detail: [stageById.get(p.stage_id)?.name, p.category_id ? catName.get(p.category_id) : null, p.next_action_at && p.next_action_at <= today() ? "action due" : null].filter(Boolean).join(" · "),
  })), [shown, stageById, catName]);
  const toLocate = useMemo(() => live.filter((p) => p.lat == null && p.address?.trim()), [live]);
  const noAddress = live.filter((p) => p.lat == null && !p.address?.trim()).length;

  const open = useCallback((id: string) => { const qs = new URLSearchParams(sp.toString()); qs.set("fiche", id); router.push(`${pathname}?${qs.toString()}`, { scroll: false }); }, [router, pathname, sp]);

  const locate = async () => {
    if (progress) return;
    const ctl = new AbortController(); abort.current = ctl;
    setProgress({ done: 0, total: toLocate.length });
    let found = 0, missed = 0, failed: string | null = null;
    for (let i = 0; i < toLocate.length && !ctl.signal.aborted; i++) {
      const p = toLocate[i];
      try {
        const hit = await geocode(p.address!, ctl.signal);
        if (hit) { await update(p.id, { lat: hit.lat, lng: hit.lng }); found++; } else missed++;
      } catch (e) { if (ctl.signal.aborted) break; failed = e instanceof Error ? e.message : "erreur réseau"; break; }
      setProgress({ done: i + 1, total: toLocate.length });
    }
    setProgress(null); abort.current = null;
    toast(failed ? `Localisation interrompue : ${failed}` : `${found} adresse${found > 1 ? "s" : ""} localisée${found > 1 ? "s" : ""}${missed ? `, ${missed} introuvable${missed > 1 ? "s" : ""}` : ""}`, { kind: failed ? "error" : "info" });
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-6xl flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold">Carte</h1>
        <select aria-label="Catégorie" className={`${inputCls} !w-auto`} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {ref.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Étape" className={`${inputCls} !w-auto`} value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">Toutes les étapes</option>
          {[...ref.stages].sort((a, b) => a.position - b.position).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={planned} onChange={(e) => setPlanned(e.target.checked)} /> Action prévue cette semaine</label>
        <p className="ml-auto text-sm text-muted" role="status" data-testid="map-count">{points.length} sur la carte</p>
      </div>
      {toLocate.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm" data-testid="locate-bar">
          <MapPin size={15} aria-hidden className="shrink-0 text-muted" />
          <span>{toLocate.length} fiche{toLocate.length > 1 ? "s ont" : " a"} une adresse mais pas de position.</span>
          {progress ? <><span className="tabular-nums text-muted">{progress.done}/{progress.total}</span><Button size="sm" onClick={() => abort.current?.abort()}>Arrêter</Button></>
            : <Button size="sm" onClick={() => void locate()}>Localiser les adresses</Button>}
          <span className="text-xs text-muted">Les adresses sont envoyées à api-adresse.data.gouv.fr (service public).</span>
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_16rem]">
        <ProspectMap points={points} onOpen={open} />
        <aside className="hidden min-h-0 overflow-y-auto rounded-2xl border border-border bg-surface p-3 lg:block" aria-label="Légende et liste">
          <h2 className="text-xs font-medium text-muted">Étapes</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {[...ref.stages].sort((a, b) => a.position - b.position).map((s) => <li key={s.id} className="flex items-center gap-2"><Dot color={s.color} size={10} /><span className="min-w-0 flex-1 truncate">{s.name}</span><span className="text-xs tabular-nums text-muted">{shown.filter((p) => p.stage_id === s.id && p.lat != null).length}</span></li>)}
          </ul>
          {noAddress > 0 ? <p className="mt-4 text-xs text-muted">{noAddress} fiche{noAddress > 1 ? "s" : ""} sans adresse : renseigne l’adresse sur la fiche pour la placer.</p> : null}
        </aside>
      </div>
    </div>
  );
}
