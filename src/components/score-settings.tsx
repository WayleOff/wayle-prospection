"use client";
import { useState } from "react";
import { useApp } from "./app-provider";
import { Button, inputCls } from "./ui";
import { DEFAULT_SCORE_RULES, RULE_HINT, clampWeight } from "@/lib/score";
import type { ScoreRule } from "@/lib/types";

/** Réglage du score automatique : activer un critère, changer son poids. Le score reste ramené à 100. */
export function ScoreSettings() {
  const { scoreRules, saveScoreRules, toast } = useApp();
  const [draft, setDraft] = useState<ScoreRule[] | null>(null); // null = pas de modification en cours
  const [busy, setBusy] = useState(false);
  const rules = draft ?? scoreRules;
  const setRules = setDraft;

  const patch = (key: string, p: Partial<ScoreRule>) => setDraft(rules.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const dirty = JSON.stringify(rules) !== JSON.stringify(scoreRules);
  const total = rules.filter((r) => r.is_active).reduce((s, r) => s + r.weight, 0);

  const save = async () => {
    setBusy(true);
    const n = await saveScoreRules(rules);
    setBusy(false);
    if (n != null) setDraft(null);
    if (n != null) toast(n === 0 ? "Critères enregistrés, aucun score ne change" : `Critères enregistrés, ${n} score${n > 1 ? "s" : ""} recalculé${n > 1 ? "s" : ""}`);
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="p-score">
      <h2 id="p-score" className="text-sm font-semibold">Score des prospects</h2>
      <p className="mt-2 text-xs text-muted">Le score (0 à 100) mesure à quel point un prospect mérite d’être contacté en premier. Chaque critère rapporte des points selon son poids ; le total est ramené à 100, donc seul le poids relatif compte.</p>
      <ul className="mt-4 divide-y divide-border">
        {rules.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <label className="flex min-w-[14rem] flex-1 items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={r.is_active} onChange={(e) => patch(r.key, { is_active: e.target.checked })} />
              <span><span className="font-medium">{r.label}</span><span className="mt-0.5 block text-xs text-muted">{RULE_HINT[r.key]}</span></span>
            </label>
            {r.key === "recent_opening" ? (
              <label className="flex items-center gap-1.5 text-xs text-muted">N =
                <input type="number" min={1} max={60} className={`${inputCls} !w-16`} value={r.params.months ?? 12} aria-label="Nombre de mois pour l’ouverture récente"
                  onChange={(e) => patch(r.key, { params: { ...r.params, months: Math.min(60, Math.max(1, Math.round(Number(e.target.value) || 12))) } })} /> mois
              </label>
            ) : null}
            <label className="flex items-center gap-1.5 text-xs text-muted">Poids
              <input type="number" min={0} max={100} className={`${inputCls} !w-16`} value={r.weight} disabled={!r.is_active} aria-label={`Poids : ${r.label}`}
                onChange={(e) => patch(r.key, { weight: clampWeight(Number(e.target.value)) })} />
            </label>
          </li>
        ))}
      </ul>
      {total === 0 ? <p className="mt-2 text-xs text-danger" role="alert">Aucun critère actif : tous les scores seront à 0.</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Recalcul…" : "Enregistrer et recalculer"}</Button>
        <Button disabled={busy || JSON.stringify(rules) === JSON.stringify(DEFAULT_SCORE_RULES)} onClick={() => setRules(DEFAULT_SCORE_RULES)}>Remettre les critères de départ</Button>
      </div>
    </section>
  );
}
