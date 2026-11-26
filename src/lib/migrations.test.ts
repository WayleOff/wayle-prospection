import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INVOICES_SQL, PROSPECT_AI_SQL } from "./migrations";

describe("SQL affiché dans l'application", () => {
  it("est identique à la migration du dépôt", () => {
    expect(INVOICES_SQL).toBe(readFileSync("supabase/migrations/20261129000000_invoices_deposits.sql", "utf8"));
  });
  it("fiche prospect (IA) : identique à la migration", () => {
    expect(PROSPECT_AI_SQL).toBe(readFileSync("supabase/migrations/20261130000000_prospect_ai.sql", "utf8"));
  });
});
