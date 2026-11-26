"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, FileUp, Plus, Search, SearchX, Users, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Dot, Empty, inputCls } from "@/components/ui";
import { ImportDialog } from "@/components/import-dialog";
import { MenuButton, useProspectMenu } from "@/components/prospect-menu";
import { DISTRICT_LABEL, HEAT_COLOR, HEAT_LABEL, fmtDue } from "@/lib/labels";
import { normHandle, normText } from "@/lib/normalize";
import type { Prospect } from "@/lib/types";

type SortKey = "name" | "stage" | "heat" | "score" | "next" | "updated";
const HEAT_RANK = { hot: 3, warm: 2, cold: 1 } as const;
const FILTERS = { cat: "category_id", stage: "stage_id", owner: "owner_id", district: "district" } as const;

export default function Page() {
  const { prospects, ref, setQuickAddOpen } = useApp();
  const { onContextMenu } = useProspectMenu();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ cat: "", stage: "", owner: "", district: "", tag: "" });
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "updated", dir: -1 });

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

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Prospects</h1>
        <span className="text-sm text-muted" aria-live="polite">{rows.length}{active ? ` sur ${prospects.length}` : ""}</span>
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
                <tr>{th("name", "Nom")}<th scope="col" className="px-3 py-2 text-left font-medium">Catégorie</th>{th("stage", "Étape")}{th("heat", "Température")}{th("score", "Score", "text-right")}{th("next", "Prochaine action")}<th scope="col" className="px-3 py-2 text-left font-medium">Resp.</th><th scope="col" className="w-10"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const st = stageOf(p.stage_id); const due = fmtDue(p.next_action_at); const ow = ownerOf(p.owner_id);
                  return (
                    <tr key={p.id} tabIndex={0} onClick={() => open(p.id)} onContextMenu={onContextMenu(p.id)} onKeyDown={(e) => { if (e.key === "Enter") open(p.id); }}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-subtle/70 focus-visible:bg-subtle/70">
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
            {rows.map((p) => {
              const st = stageOf(p.stage_id); const due = fmtDue(p.next_action_at);
              return (
                <li key={p.id} className="relative" onContextMenu={onContextMenu(p.id)}>
                  <button type="button" onClick={() => open(p.id)} className="w-full rounded-xl border border-border bg-surface p-3.5 text-left active:bg-subtle">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><div className="truncate font-medium">{p.name}</div><div className="truncate text-xs text-muted">{[catName(p.category_id), p.instagram].filter(Boolean).join(" · ")}</div></div>
                      <span className="mr-8 inline-flex shrink-0 items-center gap-1.5 text-xs"><Dot color={HEAT_COLOR[p.heat]} />{HEAT_LABEL[p.heat]}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-muted">{st ? <Dot color={st.color} /> : null}{st?.name}</span>
                      {due ? <span className={due.late ? "font-medium text-danger" : "text-muted"}>{due.text}</span> : null}
                    </div>
                  </button>
                  <MenuButton id={p.id} name={p.name} className="absolute right-1.5 top-1.5" />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
