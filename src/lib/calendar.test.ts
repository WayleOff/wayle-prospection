import { describe, expect, it } from "vitest";
import { calendarEvents, groupByDay, monthGrid } from "./calendar";
import type { Prospect, Stage } from "./types";

describe("grille du mois", () => {
  it("novembre 2026 : du lundi 26/10 au dimanche 6/12, 6 semaines", () => {
    const g = monthGrid(2026, 10);
    expect(g).toHaveLength(6);
    expect(g[0][0]).toEqual({ day: "2026-10-26", inMonth: false });
    expect(g[0][6].day).toBe("2026-11-01"); expect(g[0][6].inMonth).toBe(true);
    expect(g[5][6].day).toBe("2026-12-06");
    expect(g.flat().filter((d) => d.inMonth)).toHaveLength(30);
  });
  it("février 2027 tient sur 4 semaines (lundi 1er → dimanche 28)", () => {
    const g = monthGrid(2027, 1);
    expect(g).toHaveLength(4); expect(g[0][0].day).toBe("2027-02-01"); expect(g[3][6].day).toBe("2027-02-28");
  });
  it("chaque semaine commence un lundi et compte 7 jours", () => {
    for (const [y, m] of [[2026, 0], [2026, 5], [2026, 11], [2028, 1]]) for (const w of monthGrid(y, m)) { expect(w).toHaveLength(7); expect(new Date(w[0].day + "T12:00:00").getDay()).toBe(1); }
  });
});

describe("événements", () => {
  const stages: Stage[] = [{ id: "o", name: "Contacté", position: 1, kind: "open", color: "#000" }, { id: "w", name: "Gagné", position: 2, kind: "won", color: "#000" }];
  const p = (id: string, over: Partial<Prospect>): Prospect => ({ id, name: id, stage_id: "o", next_action_at: null, next_action_label: null, do_not_contact: false, archived_at: null, ...over } as Prospect);
  it("garde les actions des fiches en cours, signale le retard, ajoute les devis envoyés", () => {
    const ps = [p("A", { next_action_at: "2026-11-25", next_action_label: "Relance courte" }), p("B", { next_action_at: "2026-11-30" }), p("C", { next_action_at: "2026-11-30", stage_id: "w" }),
      p("D", { next_action_at: "2026-11-30", do_not_contact: true }), p("E", { next_action_at: "2026-11-30", archived_at: "x" }), p("F", {})];
    const ev = calendarEvents(ps, stages, [{ id: "q1", number: "D-2026-001", prospect_id: "B", status: "sent", valid_until: "2026-11-30", total_cents: 1 }, { id: "q2", number: "D-2", prospect_id: "B", status: "draft", valid_until: "2026-11-30", total_cents: 1 }], "2026-11-26");
    expect(ev.map((e) => e.id)).toEqual(["a-A", "a-B", "q-q1"]);
    expect(ev[0]).toMatchObject({ late: true, detail: "Relance courte" }); expect(ev[1]).toMatchObject({ late: false, detail: "Relance" });
    expect([...groupByDay(ev).get("2026-11-30")!].map((e) => e.kind)).toEqual(["action", "quote"]);
  });
});
