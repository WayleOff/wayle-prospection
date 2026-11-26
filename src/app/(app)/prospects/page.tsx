"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileUp, Plus, Search, SearchX, Trash2, Users, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Dot, Empty, inputCls } from "@/components/ui";
import { ImportDialog } from "@/components/import-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MenuButton, useProspectMenu } from "@/components/prospect-menu";
import { DISTRICT_LABEL, HEAT_COLOR, HEAT_LABEL, fmtDue } from "@/lib/labels";
import { normHandle, normText } from "@/lib/normalize";
import type { Prospect } from "@/lib/types";

type SortKey = "name" | "stage" | "heat" | "score" | "next" | "updated";
const HEAT_RANK = { hot: 3, warm: 2, cold: 1 } as const;
const PAGE_SIZES = [25, 50, 100, 0] as const; // 0 = tout afficher
const PAGE_KEY = "wayle-prospects-page-size";
const readPageSize = (): number => {
  try { const n = Number(localStorage.getItem(PAGE_KEY)); return (PAGE_SIZES as readonly number[]).includes(n) ? n : 25; } catch { return 25; }
};
const FILTERS = { cat: "category_id", stage: "stage_id", owner: "owner_id", district: "district" } as const;

export default function Page() {
  const { prospects, ref, setQuickAddOpen, archiveMany, deleteForever } = useApp();
  const { onContextMenu } = useProspectMenu();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ cat: "", stage: "", owner: "", district: "", tag: "" });
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "updated", dir: -1 });
  const [view, setView] = useState<"actifs" | "archives">("actifs");
  const [pageSize, setPageSizeState] = useState<number>(readPageSize);
  const [pg, setPg] = useState({ key: "", n: 0 });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastClicked = useRef<number | null>(null);
  const setPageSize = (n: number) => { setPageSizeState(n); try { localStorage.setItem(PAGE_KEY, String(n)); } catch { /* ignoré */ } };

  const stageOf = (id: string) => ref.stages.find((s) => s.id === id);
  const catName = (id: string | null) => ref.categories.find((c) => c.id === id)?.name ?? "";
  const ownerOf = (id: string | null) => ref.profiles.find((p) => p.id === id);

  const rows = useMemo(() => {
    const needle = normText(q) ?? "";
    const handle = normHandle(q) ?? "";
    const list = prospects.filter((p) => {
      if (f.cat && p.category_id !== f.cat) return false;
      if (f.stage && p.stage_id !== f.stage) return false;
      if (f.owner && (f.owner === "none" ? p.owner_id : p.owner_id !== f.owner)) return false;
      if (f.district && p.district !== f.district) return false;
      if (f.tag && !p.tag_ids.includes(f.tag)) return false;
      if (!needle) return true;
      return (normText(p.name) ?? "").includes(needle) || (!!handle && (normHandle(p.instagram) ?? "").includes(handle))
        || (normText(p.address ?? "") ?? "").includes(needle) || (normText(p.email ?? "") ?? "").includes(needle)
        || (normText(`${p.contact_first_name ?? ""} ${p.contact_last_name ?? ""}`) ?? "").includes(needle);
    });
    const val = (p: Prospect): string | number => {
      switch (sort.key) {
        case "name": return p.name.toLocaleLowerCase("fr");
        case "stage": return stageOf(p.stage_id)?.position ?? 0;
        case "heat": return HEAT_RANK[p.heat];
        case "score": return p.score;
        case "next": return p.next_action_at ?? "9999";
        case "updated": return p.updated_at;
      }
    };
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name, "fr")) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospects, q, f, sort, ref]);

  const filterKey = `${q}|${Object.values(f).join(",")}|${sort.key}${sort.dir}|${pageSize}`;
  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(rows.length / pageSize));
  const pageNo = Math.min(pg.key === filterKey ? pg.n : 0, pageCount - 1);
  const shown = pageSize === 0 ? rows : rows.slice(pageNo * pageSize, (pageNo + 1) * pageSize);
  const goTo = (n: number) => { setPg({ key: filterKey, n: Math.max(0, Math.min(pageCount - 1, n)) }); lastClicked.current = null; };
  // La sélection ne porte que sur les fiches visibles avec les filtres actuels : on n'agit jamais sur une fiche masquée.
  const rowIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const selIds = useMemo(() => [...selected].filter((id) => rowIds.has(id)), [selected, rowIds]);
  const pageAllSelected = shown.length > 0 && shown.every((r) => selected.has(r.id));
  const toggleOne = (id: string, index: number, shift: boolean) => {
    setSelected((cur) => {
      const next = new Set(cur);
      const on = !cur.has(id);
      if (shift && lastClicked.current !== null) {
        const [a, b] = [Math.min(lastClicked.current, index), Math.max(lastClicked.current, index)];
        for (const r of shown.slice(a, b + 1)) { if (on) next.add(r.id); else next.delete(r.id); }
      } else if (on) next.add(id); else next.delete(id);
      return next;
    });
    lastClicked.current = index;
  };
  const togglePage = () => setSelected((cur) => { const next = new Set(cur); for (const r of shown) { if (pageAllSelected) next.delete(r.id); else next.add(r.id); } return next; });
  const selectAllResults = () => setSelected(new Set(rows.map((r) => r.id)));
  const clearSel = () => { setSelected(new Set()); lastClicked.current = null; };

  const active = q !== "" || Object.values(f).some(Boolean);
  const reset = () => { setQ(""); setF({ cat: "", stage: "", owner: "", district: "", tag: "" }); };
  const open = (id: string) => { const qs = new URLSearchParams(sp.toString()); qs.set("fiche", id); router.push(`${pathname}?${qs.toString()}`, { scroll: false }); };
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (-s.dir as 1 | -1) } : { key, dir: key === "name" || key === "stage" || key === "next" ? 1 : -1 }));

  const th = (k: SortKey, children: string, className = "") => (
    <th key={k} scope="col" aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`px-3 py-2 text-left font-medium ${className}`}>
      <button type="button" onClick={() => toggle(k)} className="inline-flex items-center gap-1 hover:text-fg">
        {children} {sort.key === k ? (sort.dir === 1 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />) : null}
      </button>
    </th>
  );

  const sel = (key: keyof typeof f, label: string, options: { value: string; label: string }[], extra?: { value: string; label: string }[]) => (
    <select aria-label={label} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className={`${inputCls} !w-auto min-w-0 max-w-44 shrink-0 ${f[key] ? "border-accent/60" : ""}`}>
      <option value="">{label}</option>
      {extra?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  void FILTERS;

  if (prospects.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold">Prospects</h1>
        <div className="mt-6 rounded-2xl border border-dashed border-border">
          <Empty icon={<Users size={22} />} title="Aucun prospect pour l’instant" text="Ajoutez le premier en collant un nom ou un lien Instagram, ou importez un fichier CSV ou un export Notion.">
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => setQuickAddOpen(true)}><Plus size={15} aria-hidden /> Nouveau prospect</Button>
              <Button onClick={() => setImportOpen(true)}><FileUp size={15} aria-hidden /> Importer un fichier</Button>
            </div>
          </Empty>
        </div>
        <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      </div>
    );
  }

  if (view === "archives") return <ArchivedView onBack={() => setView("actifs")} />;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Prospects</h1>
        <span className="text-sm text-muted" aria-live="polite">{rows.length}{active ? ` sur ${prospects.length}` : ""}</span>
        <div role="group" aria-label="Fiches actives ou archivées" className="ml-2 inline-flex overflow-hidden rounded-lg border border-border text-[13px]">
          <button type="button" aria-pressed="true" className="bg-subtle px-2.5 py-1 font-medium">Actifs</button>
          <button type="button" aria-pressed="false" onClick={() => { clearSel(); setView("archives"); }} className="px-2.5 py-1 text-muted hover:bg-subtle hover:text-fg">Archivés</button>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => setImportOpen(true)}><FileUp size={14} aria-hidden /> Importer</Button>
      </div>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        <div className="relative min-w-44 shrink-0 md:max-w-xs md:flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input data-search type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" placeholder="Rechercher (touche /)" className={`${inputCls} !pl-9`} />
        </div>
        {sel("cat", "Catégorie", ref.categories.map((c) => ({ value: c.id, label: c.name })))}
        {sel("stage", "Étape", ref.stages.map((s) => ({ value: s.id, label: s.name })))}
        {sel("owner", "Responsable", ref.profiles.map((p) => ({ value: p.id, label: p.name })), [{ value: "none", label: "Sans responsable" }])}
        {sel("district", "Quartier", Object.entries(DISTRICT_LABEL).map(([value, label]) => ({ value, label })))}
        {sel("tag", "Étiquette", ref.tags.map((t) => ({ value: t.id, label: t.name })))}
        {active ? <Button variant="ghost" size="sm" onClick={reset}><X size={14} aria-hidden /> Effacer</Button> : null}
      </div>

      {selIds.length > 0 ? (
        <div role="region" aria-label="Actions sur la sélection" className="sticky top-16 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-surface px-3 py-2 shadow-md">
          <span className="text-sm font-medium" aria-live="polite">{selIds.length} sélectionné{selIds.length > 1 ? "s" : ""}</span>
          {selIds.length < rows.length ? <button type="button" onClick={selectAllResults} className="text-[13px] text-accent underline underline-offset-2">Tout sélectionner ({rows.length})</button> : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => { void archiveMany(selIds); clearSel(); }}><Archive size={14} aria-hidden /> Archiver</Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={14} aria-hidden /> Supprimer définitivement</Button>
            <Button size="sm" variant="ghost" onClick={clearSel}>Désélectionner</Button>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border">
          <Empty icon={<SearchX size={22} />} title="Aucun résultat" text="Aucun prospect ne correspond à cette recherche ou à ces filtres."><Button onClick={reset}>Tout effacer</Button></Empty>
        </div>
      ) : (
        <>
          {/* Ordinateur : tableau */}
          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-subtle/60 text-xs text-muted">
                <tr><th scope="col" className="w-9 py-2 pl-3"><input type="checkbox" aria-label="Sélectionner la page" checked={pageAllSelected} onChange={togglePage} className="size-4 accent-[var(--accent)]" /></th>{th("name", "Nom")}<th scope="col" className="px-3 py-2 text-left font-medium">Catégorie</th>{th("stage", "Étape")}{th("heat", "Température")}{th("score", "Score", "text-right")}{th("next", "Prochaine action")}<th scope="col" className="px-3 py-2 text-left font-medium">Resp.</th><th scope="col" className="w-10"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {shown.map((p, i) => {
                  const st = stageOf(p.stage_id); const due = fmtDue(p.next_action_at); const ow = ownerOf(p.owner_id);
                  return (
                    <tr key={p.id} tabIndex={0} onClick={() => open(p.id)} onContextMenu={onContextMenu(p.id)} onKeyDown={(e) => { if (e.key === "Enter") open(p.id); }}
                      className={`cursor-pointer border-b border-border last:border-0 hover:bg-subtle/70 focus-visible:bg-subtle/70 ${selected.has(p.id) ? "bg-accent/5" : ""}`}>
                      <td className="w-9 py-2.5 pl-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Sélectionner ${p.name}`} checked={selected.has(p.id)} onChange={() => undefined} onClick={(e) => toggleOne(p.id, i, e.shiftKey)} className="size-4 accent-[var(--accent)]" />
                      </td>
                      <td className="px-3 py-2.5"><div className="font-medium">{p.name}</div>{p.instagram ? <div className="text-xs text-muted">{p.instagram}</div> : null}</td>
                      <td className="px-3 py-2.5 text-muted">{catName(p.category_id)}</td>
                      <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5">{st ? <Dot color={st.color} /> : null}{st?.name}</span></td>
                      <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><Dot color={HEAT_COLOR[p.heat]} />{HEAT_LABEL[p.heat]}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.score}</td>
                      <td className="px-3 py-2.5">{due ? <span className={due.late ? "font-medium text-danger" : ""}>{p.next_action_label ? `${p.next_action_label} · ` : ""}{due.text}</span> : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2.5">{ow ? <span className="inline-flex items-center gap-1.5"><Dot color={ow.color} />{ow.name}</span> : <span className="text-muted">—</span>}</td>
                      <td className="px-1 py-1"><MenuButton id={p.id} name={p.name} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Téléphone : cartes */}
          <ul className="mt-4 space-y-2 md:hidden">
            {shown.map((p, i) => {
              const st = stageOf(p.stage_id); const due = fmtDue(p.next_action_at);
              return (
                <li key={p.id} className="relative" onContextMenu={onContextMenu(p.id)}>
                  <button type="button" onClick={() => open(p.id)} className={`w-full rounded-xl border bg-surface p-3.5 pl-11 text-left active:bg-subtle ${selected.has(p.id) ? "border-accent/60" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><div className="truncate font-medium">{p.name}</div><div className="truncate text-xs text-muted">{[catName(p.category_id), p.instagram].filter(Boolean).join(" · ")}</div></div>
                      <span className="mr-8 inline-flex shrink-0 items-center gap-1.5 text-xs"><Dot color={HEAT_COLOR[p.heat]} />{HEAT_LABEL[p.heat]}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-muted">{st ? <Dot color={st.color} /> : null}{st?.name}</span>
                      {due ? <span className={due.late ? "font-medium text-danger" : "text-muted"}>{due.text}</span> : null}
                    </div>
                  </button>
                  <input type="checkbox" aria-label={`Sélectionner ${p.name}`} checked={selected.has(p.id)} onChange={() => undefined} onClick={(e) => toggleOne(p.id, i, e.shiftKey)} className="absolute left-3.5 top-4 size-5 accent-[var(--accent)]" />
                  <MenuButton id={p.id} name={p.name} className="absolute right-1.5 top-1.5" />
                </li>
              );
            })}
          </ul>

          <nav aria-label="Pagination" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <label className="inline-flex items-center gap-2">Afficher
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className={`${inputCls} !h-8 !w-auto`}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n === 0 ? "Tous" : `${n} par page`}</option>)}
              </select>
            </label>
            {pageSize !== 0 && pageCount > 1 ? (
              <div className="inline-flex items-center gap-2">
                <span aria-live="polite">{pageNo * pageSize + 1}–{Math.min(rows.length, (pageNo + 1) * pageSize)} sur {rows.length}</span>
                <Button size="sm" variant="ghost" aria-label="Page précédente" disabled={pageNo === 0} onClick={() => goTo(pageNo - 1)} className="!px-2"><ChevronLeft size={16} aria-hidden /></Button>
                <span>Page {pageNo + 1} / {pageCount}</span>
                <Button size="sm" variant="ghost" aria-label="Page suivante" disabled={pageNo >= pageCount - 1} onClick={() => goTo(pageNo + 1)} className="!px-2"><ChevronRight size={16} aria-hidden /></Button>
              </div>
            ) : <span>{rows.length} prospect{rows.length > 1 ? "s" : ""}</span>}
          </nav>
        </>
      )}

      <ConfirmDialog open={confirmDelete} title={`Supprimer ${selIds.length} prospect${selIds.length > 1 ? "s" : ""} définitivement ?`} confirmLabel="Supprimer définitivement" onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { const ok = await deleteForever(selIds); if (ok) clearSel(); }}>
        <p>{selIds.length > 1 ? "Ces fiches seront effacées" : "Cette fiche sera effacée"} pour de bon, avec leur historique, leurs messages et leurs devis. Cette action ne peut pas être annulée.</p>
        <p className="mt-2">Pour pouvoir revenir en arrière, utilisez plutôt « Archiver ».</p>
      </ConfirmDialog>
    </div>
  );
}

/** Fiches archivées : on peut les restaurer ou les supprimer définitivement. */
function ArchivedView({ onBack }: { onBack: () => void }) {
  const { listArchived, restoreMany, deleteForever, ref } = useApp();
  const [items, setItems] = useState<Prospect[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    let alive = true;
    listArchived().then((l) => { if (alive) setItems(l); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [listArchived]);

  const rows = useMemo(() => {
    const needle = normText(q) ?? "";
    return (items ?? []).filter((p) => !needle || (normText(p.name) ?? "").includes(needle));
  }, [items, q]);
  const ids = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const catName = (id: string | null) => ref.categories.find((c) => c.id === id)?.name ?? "";
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "");
  const drop = (gone: string[]) => { const g = new Set(gone); setItems((l) => (l ?? []).filter((p) => !g.has(p.id))); setSelected((c) => new Set([...c].filter((x) => !g.has(x)))); };
  const restore = async (list: string[]) => { const back = await restoreMany(list); drop(back.map((p) => p.id)); };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Prospects</h1>
        <span className="text-sm text-muted" aria-live="polite">{items ? `${rows.length} archivé${rows.length > 1 ? "s" : ""}` : "Chargement…"}</span>
        <div role="group" aria-label="Fiches actives ou archivées" className="ml-2 inline-flex overflow-hidden rounded-lg border border-border text-[13px]">
          <button type="button" aria-pressed="false" onClick={onBack} className="px-2.5 py-1 text-muted hover:bg-subtle hover:text-fg">Actifs</button>
          <button type="button" aria-pressed="true" className="bg-subtle px-2.5 py-1 font-medium">Archivés</button>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">Ces fiches n’apparaissent plus nulle part. Restaurez-les, ou supprimez-les définitivement.</p>

      <div className="relative mt-4 max-w-xs">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher dans les archives" placeholder="Rechercher" className={`${inputCls} !pl-9`} />
      </div>

      {ids.length > 0 ? (
        <div role="region" aria-label="Actions sur la sélection" className="sticky top-16 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-surface px-3 py-2 shadow-md">
          <span className="text-sm font-medium">{ids.length} sélectionné{ids.length > 1 ? "s" : ""}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void restore(ids)}><ArchiveRestore size={14} aria-hidden /> Restaurer</Button>
            <Button size="sm" variant="danger" onClick={() => setConfirm(ids)}><Trash2 size={14} aria-hidden /> Supprimer définitivement</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Désélectionner</Button>
          </div>
        </div>
      ) : null}

      {items && rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border">
          <Empty icon={<Archive size={22} />} title="Aucune fiche archivée" text={q ? "Aucune archive ne correspond à cette recherche." : "Les fiches que vous archivez apparaîtront ici."} />
        </div>
      ) : items ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-subtle/60 text-xs text-muted">
              <tr>
                <th scope="col" className="w-9 py-2 pl-3"><input type="checkbox" aria-label="Tout sélectionner" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)))} className="size-4 accent-[var(--accent)]" /></th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Nom</th>
                <th scope="col" className="hidden px-3 py-2 text-left font-medium sm:table-cell">Catégorie</th>
                <th scope="col" className="hidden px-3 py-2 text-left font-medium sm:table-cell">Archivée le</th>
                <th scope="col" className="px-3 py-2 text-right font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={`border-b border-border last:border-0 ${selected.has(p.id) ? "bg-accent/5" : ""}`}>
                  <td className="w-9 py-2.5 pl-3"><input type="checkbox" aria-label={`Sélectionner ${p.name}`} checked={selected.has(p.id)} onChange={() => setSelected((c) => { const n = new Set(c); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} className="size-4 accent-[var(--accent)]" /></td>
                  <td className="px-3 py-2.5"><div className="font-medium">{p.name}</div>{p.instagram ? <div className="text-xs text-muted">{p.instagram}</div> : null}</td>
                  <td className="hidden px-3 py-2.5 text-muted sm:table-cell">{catName(p.category_id)}</td>
                  <td className="hidden px-3 py-2.5 text-muted sm:table-cell">{fmt(p.archived_at)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <Button size="sm" variant="ghost" aria-label={`Restaurer ${p.name}`} onClick={() => void restore([p.id])}><ArchiveRestore size={14} aria-hidden /> <span className="hidden sm:inline">Restaurer</span></Button>
                    <Button size="sm" variant="ghost" aria-label={`Supprimer définitivement ${p.name}`} onClick={() => setConfirm([p.id])} className="!text-danger"><Trash2 size={14} aria-hidden /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ConfirmDialog open={!!confirm} title={`Supprimer ${confirm?.length ?? 0} prospect${(confirm?.length ?? 0) > 1 ? "s" : ""} définitivement ?`} confirmLabel="Supprimer définitivement" onClose={() => setConfirm(null)}
        onConfirm={async () => { if (confirm && (await deleteForever(confirm))) drop(confirm); }}>
        <p>{(confirm?.length ?? 0) > 1 ? "Ces fiches seront effacées" : "Cette fiche sera effacée"} pour de bon, avec leur historique, leurs messages et leurs devis. Cette action ne peut pas être annulée.</p>
      </ConfirmDialog>
    </div>
  );
}
