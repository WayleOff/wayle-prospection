"use client";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { BarList, Columns, Panel, Tile } from "@/components/charts";
import { Button } from "@/components/ui";
import { CHANNEL_LABEL, fmtEuros } from "@/lib/labels";
import { countBy, delays, funnel, headline, replyRates, revenueByMonth, weekly } from "@/lib/insights";
import { downloadText, prospectsExport, weekReport } from "@/lib/export";
import { fmtMoney } from "@/lib/quote";
import type { Activity } from "@/lib/types";

const PERIODS = [{ days: 30, label: "30 jours" }, { days: 90, label: "90 jours" }, { days: 365, label: "12 mois" }] as const;
const pct = (n: number) => `${Math.round(n * 100)} %`;
const days = (n: number | null) => (n == null ? "—" : n < 1 ? "moins d’un jour" : `${String(Math.round(n * 10) / 10).replace(".", ",")} j`);

export default function Page() {
  const { prospects, ref, quotes, invoices, invoicesReady, listActivitiesSince, activityTick } = useApp();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["days"]>(90);
  const [activities, setActivities] = useState<Activity[] | null>(null);

  useEffect(() => {
    let alive = true;
    listActivitiesSince(new Date(Date.now() - 366 * 86400000).toISOString()).then((l) => { if (alive) setActivities(l); }).catch(() => { if (alive) setActivities([]); });
    return () => { alive = false; };
  }, [listActivitiesSince, activityTick]);

  const acts = useMemo(() => activities ?? [], [activities]);
  const [now] = useState(() => Date.now()); // fixé à l'ouverture de la page
  const since = now - period * 86400000;
  const head = useMemo(() => headline(prospects, ref.stages, quotes), [prospects, ref.stages, quotes]);
  const fun = useMemo(() => funnel(prospects, ref.stages), [prospects, ref.stages]);
  const wk = useMemo(() => weekly(acts, 8), [acts]);
  const byChannel = useMemo(() => replyRates(prospects, acts, since, "channel", CHANNEL_LABEL), [prospects, acts, since]);
  const catLabels = useMemo(() => Object.fromEntries(ref.categories.map((c) => [c.id, c.name])), [ref.categories]);
  const byCategory = useMemo(() => replyRates(prospects, acts, since, "category", catLabels), [prospects, acts, since, catLabels]);
  const dl = useMemo(() => delays(prospects, acts), [prospects, acts]);
  const sources = useMemo(() => countBy(prospects, (p) => p.source, 6), [prospects]);
  const lost = useMemo(() => countBy(prospects.filter((p) => ref.stages.find((s) => s.id === p.stage_id)?.kind === "lost"), (p) => p.lost_reason, 6), [prospects, ref.stages]);
  const rev = useMemo(() => revenueByMonth(invoices, 6), [invoices]);
  const total = (b: { value: number }[]) => b.reduce((n, x) => n + x.value, 0);
  const contactsPeriod = acts.filter((a) => (a.kind === "message" || a.kind === "call" || a.kind === "visit") && new Date(a.created_at).getTime() >= since).length;
  const stamp = new Date().toLocaleDateString("sv-SE");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Statistiques</h1>
        <div role="group" aria-label="Période" className="ml-auto flex gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.days} type="button" aria-pressed={period === p.days} onClick={() => setPeriod(p.days)}
              className={`h-8 rounded-lg px-3 text-[13px] ${period === p.days ? "bg-accent font-medium text-accent-fg" : "border border-border bg-surface hover:bg-subtle"}`}>{p.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="kpis">
        <Tile label="Prospects en cours" value={head.active} sub={`${head.won} gagné${head.won > 1 ? "s" : ""}, ${head.lost} perdu${head.lost > 1 ? "s" : ""}`} />
        <Tile label="Taux de conversion" value={head.conversion == null ? "—" : pct(head.conversion)} sub="gagnés sur gagnés + perdus" />
        <Tile label={`Contacts (${PERIODS.find((p) => p.days === period)!.label})`} value={contactsPeriod} sub="messages, appels, visites" />
        <Tile label="Devis envoyés" value={head.quotesPending} sub={head.quotesPending ? `${fmtMoney(head.quotesPendingCents)} en attente de réponse` : "aucun en attente"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel id="st-funnel" title="Où en sont les prospects" hint="Nombre de fiches par étape du pipeline."
          table={{ head: ["Étape", "Fiches"], rows: fun.map((b) => [b.label, b.value]) }}>
          <BarList bars={fun} empty="Aucun prospect pour l’instant." />
        </Panel>
        <Panel id="st-weeks" title="Activité par semaine" hint="Messages, appels et visites, sur 8 semaines."
          table={{ head: ["Semaine du", "Contacts", "Réponses"], rows: wk.map((w) => [w.label, w.contacts, w.replies]) }}>
          <Columns label="Contacts par semaine" points={wk.map((w) => ({ key: w.start, label: w.label, value: w.contacts, note: `Semaine du ${w.label} : ${w.contacts} contact${w.contacts > 1 ? "s" : ""}, ${w.replies} réponse${w.replies > 1 ? "s" : ""}` }))} />
        </Panel>
        <Panel id="st-channel" title="Réponses par canal" hint="Part des prospects contactés qui ont répondu. Entre parenthèses : prospects contactés."
          table={{ head: ["Canal", "Taux", "Contactés"], rows: byChannel.map((b) => [b.label, pct(b.value), b.of ?? 0]) }}>
          <BarList bars={byChannel} max={1} format={(n) => pct(n)} empty="Aucun contact sur la période." />
        </Panel>
        <Panel id="st-category" title="Réponses par catégorie" hint="Quels types de commerces répondent le mieux."
          table={{ head: ["Catégorie", "Taux", "Contactés"], rows: byCategory.map((b) => [b.label, pct(b.value), b.of ?? 0]) }}>
          <BarList bars={byCategory} max={1} format={(n) => pct(n)} empty="Aucun contact sur la période." />
        </Panel>
        <Panel id="st-delays" title="Délais" hint="Médiane, tous prospects confondus.">
          <dl className="grid grid-cols-2 gap-4" data-testid="delays">
            <div><dt className="text-xs text-muted">Fiche créée → premier contact</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums">{days(dl.toFirstContact)}</dd><dd className="text-xs text-muted">sur {dl.samples.contact} prospect{dl.samples.contact > 1 ? "s" : ""}</dd></div>
            <div><dt className="text-xs text-muted">Premier contact → réponse</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums">{days(dl.toReply)}</dd><dd className="text-xs text-muted">sur {dl.samples.reply} réponse{dl.samples.reply > 1 ? "s" : ""}</dd></div>
          </dl>
        </Panel>
        <Panel id="st-revenue" title="Encaissé par mois" hint={invoicesReady ? "Factures payées (importées de Shine), avoirs déduits." : "Disponible après la mise à jour de la base (onglet Factures)."}
          table={{ head: ["Mois", "Encaissé"], rows: rev.map((r) => [r.label, fmtEuros(r.cents)]) }}>
          {invoicesReady && invoices.length > 0
            ? <Columns label="Encaissé par mois" format={(n) => fmtEuros(n * 100)} points={rev.map((r) => ({ key: r.month, label: r.label, value: Math.max(0, r.cents / 100), note: `${r.label} : ${fmtEuros(r.cents)}` }))} />
            : <p className="text-sm text-muted">Importe tes factures Shine (Offres → Factures) pour voir ce que tu encaisses chaque mois.</p>}
        </Panel>
        <Panel id="st-sources" title="D’où viennent les prospects" hint={`${total(sources)} fiche${total(sources) > 1 ? "s" : ""} avec une source renseignée.`}
          table={{ head: ["Source", "Fiches"], rows: sources.map((b) => [b.label, b.value]) }}>
          <BarList bars={sources} empty="Renseigne la source sur les fiches pour la voir ici." />
        </Panel>
        <Panel id="st-lost" title="Pourquoi on perd" hint="Motifs de perte renseignés sur les fiches perdues."
          table={{ head: ["Motif", "Fiches"], rows: lost.map((b) => [b.label, b.value]) }}>
          <BarList bars={lost} empty="Aucune fiche perdue avec un motif." />
        </Panel>
      </div>

      <section aria-labelledby="st-export" className="rounded-2xl border border-border bg-surface p-5">
        <h2 id="st-export" className="text-sm font-semibold">Exports CSV</h2>
        <p className="mt-0.5 text-xs text-muted">Des fichiers qui s’ouvrent dans Excel. Rien n’est envoyé : ils sont créés dans ton navigateur.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={activities == null} onClick={() => downloadText(`bilan-semaine-${stamp}.csv`, weekReport(acts, prospects, ref.categories, 7))}><Download size={15} aria-hidden /> Bilan des 7 derniers jours</Button>
          <Button onClick={() => downloadText(`prospects-${stamp}.csv`, prospectsExport(prospects, ref.stages, ref.categories, ref.tags))}><Download size={15} aria-hidden /> Tous les prospects</Button>
        </div>
      </section>
    </div>
  );
}
