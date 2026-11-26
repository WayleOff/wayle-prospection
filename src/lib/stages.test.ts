import { describe, expect, it } from "vitest";
import { moveStage, nameWarnings, renumber, stageProblems } from "./stages";
import type { Stage } from "./types";

const st = (id: string, name: string, kind: Stage["kind"] = "open", position = 0): Stage => ({ id, name, kind, position, color: "#2563eb" });
const base = renumber([st("a", "À contacter"), st("b", "Contacté"), st("c", "Gagné", "won"), st("d", "Perdu", "lost")]);

describe("étapes", () => {
  it("déplace d'un cran et renumérote", () => {
    const m = moveStage(base, "b", -1);
    expect(m.map((s) => s.id)).toEqual(["b", "a", "c", "d"]);
    expect(m.map((s) => s.position)).toEqual([1, 2, 3, 4]);
    expect(moveStage(base, "a", -1).map((s) => s.id)).toEqual(["a", "b", "c", "d"]); // déjà en tête
    expect(moveStage(base, "d", 1).map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("valide la liste", () => {
    expect(stageProblems(base)).toEqual([]);
    expect(stageProblems([...base, st("e", " contacté ")])).toContain("Deux étapes portent le même nom.");
    expect(stageProblems([...base, st("e", "")])).toContain("Chaque étape doit avoir un nom.");
    expect(stageProblems(base.filter((s) => s.kind !== "won"))).toContain("Il faut une étape « Gagné ».");
    expect(stageProblems(base.filter((s) => s.kind !== "lost"))).toContain("Il faut une étape « Perdu ».");
    expect(stageProblems(base.filter((s) => s.kind !== "open"))).toContain("Il faut au moins une étape « En cours ».");
    expect(stageProblems([{ ...base[0], color: "rouge" }, ...base.slice(1)])).toContain("Une couleur est invalide.");
  });
  it("prévient quand les mots-clés des statistiques disparaissent", () => {
    expect(nameWarnings(base)).toHaveLength(2);
    expect(nameWarnings([...base, st("e", "RDV fixé"), st("f", "Reel livré")])).toEqual([]);
  });
});
