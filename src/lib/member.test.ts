import { describe, expect, it } from "vitest";
import { memberError, type AuthLike } from "./supabase/member";

const client = (user: unknown, rpc: { data: unknown; error: unknown }): AuthLike => ({
  auth: { getUser: async () => ({ data: { user } }) },
  rpc: async () => rpc,
});

describe("memberError", () => {
  it("refuse (401) quand personne n'est connecté", async () => {
    const r = await memberError(client(null, { data: true, error: null }));
    expect(r?.status).toBe(401);
  });
  it("refuse (403) un compte connecté mais non invité", async () => {
    const r = await memberError(client({ id: "u" }, { data: false, error: null }));
    expect(r?.status).toBe(403);
  });
  it("refuse (403) si la vérification échoue", async () => {
    const r = await memberError(client({ id: "u" }, { data: null, error: { message: "boom" } }));
    expect(r?.status).toBe(403);
  });
  it("accepte un membre de l'équipe", async () => {
    expect(await memberError(client({ id: "u" }, { data: true, error: null }))).toBeNull();
  });
});
