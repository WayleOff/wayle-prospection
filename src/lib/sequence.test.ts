import { describe, expect, it } from "vitest";
import { DEMO_STAGES, DEMO_CATEGORIES } from "./repo/demo-data";
import { pickTemplate, starterTemplates } from "./message";
import { normalizeSteps, planAfter, planStart, progressOf, starterSequence, stageStopsSequence, stepDueOn, stepText } from "./sequence";
import type { Sequence, Template } from "./types";

const seq = (): Sequence => ({ id: "s1", ...starterSequence() });

describe("séquences de relance", () => {
  it("la séquence de départ suit J0 → J+3 → J+7 → J+14", () => {
    expect(seq().steps.map(stepText)).toEqual(["J0 · Premier message", "J+3 · Relance courte", "J+7 · Visite ou appel", "J+14 · Dernier message"]);
  });
  it("lancée aujourd'hui, la première étape est due aujourd'hui", () => {
    expect(planStart(seq(), "2026-11-26")).toMatchObject({ dueOn: "2026-11-26", step: { step_no: 1 } });
    expect(planStart({ id: "x", name: "vide", is_active: true, steps: [] }, "2026-11-26")).toBeNull();
  });
  it("l'étape suivante est datée depuis le début de la séquence", () => {
    const p = planAfter(seq(), "2026-11-26T10:00:00Z", 1, "2026-11-26");
    expect(p).toMatchObject({ finished: false, dueOn: "2026-11-29", step: { step_no: 2 } });
    const q = planAfter(seq(), "2026-11-26T10:00:00Z", 2, "2026-11-29");
    expect(q).toMatchObject({ dueOn: "2026-12-03", step: { step_no: 3 } });
  });
  it("une étape faite en retard n'est jamais programmée dans le passé", () => {
    // J+3 faite le 10 décembre : J+7 (3 décembre) est déjà passé, on la programme demain
    expect(planAfter(seq(), "2026-11-26T10:00:00Z", 2, "2026-12-10")).toMatchObject({ dueOn: "2026-12-11" });
    expect(stepDueOn("2026-11-26", seq().steps[1], "2026-11-27")).toBe("2026-11-29");
  });
  it("la dernière étape termine la séquence", () => {
    expect(planAfter(seq(), "2026-11-26T10:00:00Z", 4, "2026-12-10")).toEqual({ finished: true });
  });
  it("une réponse arrête la séquence : Répondu et au-delà, gagné, perdu", () => {
    const id = (n: string) => DEMO_STAGES.find((s) => s.name === n)!.id;
    expect(stageStopsSequence(DEMO_STAGES, id("À contacter"))).toBe(false);
    expect(stageStopsSequence(DEMO_STAGES, id("Contacté"))).toBe(false);
    expect(stageStopsSequence(DEMO_STAGES, id("Répondu"))).toBe(true);
    expect(stageStopsSequence(DEMO_STAGES, id("Reel livré"))).toBe(true);
    expect(stageStopsSequence(DEMO_STAGES, id("Gagné"))).toBe(true);
    expect(stageStopsSequence(DEMO_STAGES, id("Perdu"))).toBe(true);
    expect(stageStopsSequence(DEMO_STAGES, "inconnue")).toBe(false);
  });
  it("progression et normalisation des étapes", () => {
    expect(progressOf(seq(), 3)).toEqual({ index: 3, total: 4 });
    const n = normalizeSteps([
      { step_no: 9, day_offset: 7, action: "visit", channel: null, label: "  ", template_id: null },
      { step_no: 5, day_offset: 0, action: "first_contact", channel: "instagram", label: "Hop", template_id: null },
    ]);
    expect(n.map((s) => [s.step_no, s.day_offset, s.label])).toEqual([[1, 0, "Hop"], [2, 7, "Visite"]]);
  });
  it("le libellé d'une étape retrouve le bon modèle de message", () => {
    const tpls: Template[] = starterTemplates(DEMO_CATEGORIES).map((t, i) => ({ ...t, id: `t${i}` }));
    const pick = (label: string) => pickTemplate(tpls, { channel: "instagram", tone: "tu", categoryId: null, contacted: true, label })?.name;
    expect(pick("Relance courte")).toBe("Instagram · relance courte (tu)");
    expect(pick("Dernier message")).toBe("Instagram · dernier message (tu)");
    expect(pickTemplate(tpls, { channel: "instagram", tone: "tu", categoryId: null, contacted: false, label: "Premier message" })?.name).toBe("Instagram · premier message (tu)");
  });
  it("la séquence de départ reprend les modèles existants", () => {
    const tpls: Template[] = starterTemplates(DEMO_CATEGORIES).map((t, i) => ({ ...t, id: `t${i}` }));
    const s = starterSequence(tpls);
    expect(s.steps[0].template_id).toBe(tpls.find((t) => t.name === "Instagram · premier message (tu)")!.id);
    expect(s.steps[1].template_id).toBe(tpls.find((t) => t.name === "Instagram · relance courte (tu)")!.id);
    expect(s.steps[2].template_id).toBeNull();
  });
});
