import { describe, expect, it } from "vitest";
import { buildAnalysisPrompt, parseAnalysis, parseAnalysisInput } from "./analyze";
import { extractSiteInfo, fetchSiteInfo, isPrivateAddress } from "./site-text";

describe("adresses privées", () => {
  it.each(["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.0.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "100.64.0.1"])("%s refusée", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(["8.8.8.8", "93.184.216.34", "2606:4700::1111"])("%s acceptée", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe("lecture d'un site", () => {
  const html = `<html><head><title>Café Sous les Toits</title><meta name="description" content="Café &amp; brunch à Rouen"><script>var x=1</script></head>
  <body><nav>Menu</nav><h1>Bienvenue</h1><p>Torréfaction maison, rue Eau-de-Robec.</p><video src="a.mp4"></video>
  <iframe src="https://www.youtube.com/embed/xyz"></iframe><a href="https://www.instagram.com/cafe">insta</a><footer>mentions</footer></body></html>`;
  it("extrait texte et indices", () => {
    const s = extractSiteInfo(html, "https://x.fr/");
    expect(s.title).toBe("Café Sous les Toits");
    expect(s.description).toBe("Café & brunch à Rouen");
    expect(s.text).toContain("Torréfaction maison");
    expect(s.text).not.toContain("var x");
    expect(s.text).not.toContain("Menu");
    expect(s.signals).toEqual({ videoTags: 1, embeds: ["youtube.com"], socials: ["instagram.com"] });
  });
  it("refuse localhost, adresses privées et redirections vers le réseau interne", async () => {
    const never = (async () => { throw new Error("ne doit pas être appelé"); }) as unknown as typeof fetch;
    expect(await fetchSiteInfo("http://localhost/admin", { fetchImpl: never })).toBeNull();
    expect(await fetchSiteInfo("http://169.254.169.254/latest", { fetchImpl: never })).toBeNull();
    expect(await fetchSiteInfo("intranet.exemple.fr", { fetchImpl: never, resolve: async () => ["10.0.0.4"] })).toBeNull();
    const redirect = (async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1:8080/" } })) as unknown as typeof fetch;
    expect(await fetchSiteInfo("https://ok.exemple.fr", { fetchImpl: redirect, resolve: async () => ["93.184.216.34"] })).toBeNull();
  });
  it("lit une page publique", async () => {
    const f = (async () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })) as unknown as typeof fetch;
    const s = await fetchSiteInfo("cafe.fr", { fetchImpl: f, resolve: async () => ["93.184.216.34"] });
    expect(s?.title).toBe("Café Sous les Toits");
  });
});

describe("analyse", () => {
  const good = { description: "Un café de quartier.", swot: { strengths: ["Site avec vidéo"], weaknesses: ["Peu de reels"], opportunities: ["Brunch du week-end"], threats: ["Concurrence locale"], unknowns: ["Fréquence Instagram"] } };
  it("lit le JSON, même entouré de ```", () => {
    expect(parseAnalysis("```json\n" + JSON.stringify(good) + "\n```")).toEqual(good);
    expect(parseAnalysis("Voici : " + JSON.stringify(good))?.description).toBe("Un café de quartier.");
  });
  it("rejette l'inutilisable", () => {
    expect(parseAnalysis("bof")).toBeNull();
    expect(parseAnalysis(JSON.stringify({ description: "x", swot: {} }))).toBeNull();
    expect(parseAnalysis(JSON.stringify({ swot: good.swot }))).toBeNull();
  });
  it("le prompt marque l'absence de site et n'invente rien", () => {
    const i = parseAnalysisInput({ name: "Café", website: null })!;
    const p = buildAnalysisPrompt(i, null);
    expect(p).toContain("n'en déduis rien");
    expect(p).toContain("Site web : aucun renseigné");
  });
  it("valide l'entrée", () => {
    expect(parseAnalysisInput({})).toBeNull();
    expect(parseAnalysisInput({ name: "A", independent: false })?.independent).toBe(false);
  });
});
