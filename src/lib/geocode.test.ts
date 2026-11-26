import { describe, expect, it } from "vitest";
import { geocodeUrl, parseGeocode } from "./geocode";

describe("géocodage", () => {
  it("construit l'URL avec un biais vers Rouen", () => {
    const u = new URL(geocodeUrl("12 rue du Gros-Horloge, Rouen"));
    expect(u.host).toBe("api-adresse.data.gouv.fr");
    expect(u.searchParams.get("q")).toBe("12 rue du Gros-Horloge, Rouen");
    expect(u.searchParams.get("limit")).toBe("1"); expect(u.searchParams.get("lat")).toBe("49.4432");
  });
  it("lit longitude puis latitude (GeoJSON)", () => {
    expect(parseGeocode({ features: [{ geometry: { coordinates: [1.0943, 49.4414] }, properties: { label: "12 Rue du Gros Horloge 76000 Rouen", score: 0.93 } }] }))
      .toEqual({ lat: 49.4414, lng: 1.0943, label: "12 Rue du Gros Horloge 76000 Rouen", score: 0.93 });
  });
  it("refuse un résultat douteux ou une réponse vide", () => {
    expect(parseGeocode({ features: [{ geometry: { coordinates: [1, 49] }, properties: { score: 0.3 } }] })).toBeNull();
    expect(parseGeocode({ features: [] })).toBeNull();
    expect(parseGeocode(null)).toBeNull();
    expect(parseGeocode({ features: [{ geometry: { coordinates: ["x", 49] }, properties: { score: 0.9 } }] })).toBeNull();
  });
});
