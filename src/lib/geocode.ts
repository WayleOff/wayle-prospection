/** Adresse → coordonnées avec la Base Adresse Nationale (api-adresse.data.gouv.fr), service public gratuit, sans clé. */
export interface GeoHit { lat: number; lng: number; label: string; score: number }

const ROUEN = { lat: 49.4432, lon: 1.0993 };

export function geocodeUrl(address: string): string {
  const q = new URLSearchParams({ q: address.trim(), limit: "1", lat: String(ROUEN.lat), lon: String(ROUEN.lon) });
  return `https://api-adresse.data.gouv.fr/search/?${q.toString()}`;
}

/** Lit la réponse de l'API ; null si aucune adresse assez sûre (score < 0,5) ou réponse inattendue. */
export function parseGeocode(json: unknown): GeoHit | null {
  const f = (json as { features?: { geometry?: { coordinates?: number[] }; properties?: { label?: string; score?: number } }[] })?.features?.[0];
  const c = f?.geometry?.coordinates;
  if (!f || !c || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
  const score = f.properties?.score ?? 0;
  if (score < 0.5 || Math.abs(c[1]) > 90 || Math.abs(c[0]) > 180) return null;
  return { lat: c[1], lng: c[0], label: f.properties?.label ?? "", score };
}

export async function geocode(address: string, signal?: AbortSignal): Promise<GeoHit | null> {
  const r = await fetch(geocodeUrl(address), { signal });
  if (!r.ok) throw new Error(`Service d’adresses indisponible (${r.status})`);
  return parseGeocode(await r.json());
}
