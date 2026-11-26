"use client";
import type { ReactNode } from "react";
import type { Bar } from "@/lib/insights";

/** Carte de chiffre clé : un nombre, son libellé, une précision. */
export function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

/** Carte de graphique : titre, consigne de lecture, contenu, et la même donnée en tableau pour qui ne lit pas les barres. */
export function Panel({ id, title, hint, children, table }: { id: string; title: string; hint?: string; children: ReactNode; table?: { head: string[]; rows: (string | number)[][] } }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border bg-surface p-5">
      <h2 id={id} className="text-sm font-semibold">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
      {table ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted">Voir en tableau</summary>
          <table className="mt-2 w-full text-left">
            <thead><tr className="text-muted">{table.head.map((h, i) => <th key={i} className={`py-1 font-medium ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className={`py-1 ${j ? "text-right tabular-nums" : ""}`}>{c}</td>)}</tr>)}</tbody>
          </table>
        </details>
      ) : null}
    </section>
  );
}

/** Barres horizontales classées, une teinte : le nom, la barre, la valeur. `format` met en forme la valeur (nombre par défaut). */
export function BarList({ bars, format = (n) => String(n), max, emphasize, empty = "Pas encore de données." }: { bars: Bar[]; format?: (n: number, b: Bar) => string; max?: number; emphasize?: string; empty?: string }) {
  if (bars.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const top = max ?? Math.max(...bars.map((b) => b.value), 1);
  return (
    <ul className="space-y-2.5">
      {bars.map((b) => (
        <li key={b.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" title={b.note ?? undefined}>
          <span className="truncate" title={b.label}>{b.label}</span>
          <span className="h-2.5 rounded-full bg-subtle" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${Math.max(b.value > 0 ? 2 : 0, Math.min(100, (b.value / top) * 100))}%`, background: emphasize && b.key !== emphasize ? "var(--muted)" : "var(--accent)", opacity: emphasize && b.key !== emphasize ? 0.45 : 1 }} />
          </span>
          <span className="w-20 text-right tabular-nums">{format(b.value, b)}{b.of != null ? <span className="ml-1.5 text-xs text-muted">({b.of})</span> : null}</span>
        </li>
      ))}
    </ul>
  );
}

/** Colonnes verticales (une par période). Les libellés d'axe sont espacés quand il y en a beaucoup. */
export function Columns({ points, format = (n) => String(n), label }: { points: { key: string; label: string; value: number; note?: string }[]; format?: (n: number) => string; label: string }) {
  const top = Math.max(...points.map((p) => p.value), 1);
  const every = points.length > 8 ? 2 : 1;
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-36 items-end gap-1.5 border-b border-border">
        {points.map((p) => (
          <div key={p.key} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={p.note ?? `${p.label} : ${format(p.value)}`}>
            <span className="mb-1 text-[11px] tabular-nums text-muted">{p.value ? format(p.value) : ""}</span>
            <span className="w-full max-w-9 rounded-t-md" style={{ height: `${p.value ? Math.max(3, (p.value / top) * 100 * 0.82) : 0}%`, background: "var(--accent)" }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {points.map((p, i) => <span key={p.key} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted">{i % every === 0 ? p.label : ""}</span>)}
      </div>
    </div>
  );
}
