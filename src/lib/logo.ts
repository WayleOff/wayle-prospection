import type { Logo } from "./types";

const MAX_W = 480, MAX_H = 240, MAX_INPUT = 6 * 1024 * 1024, MAX_DATA_URL = 400 * 1024;

/** Lit une image (PNG, JPEG, WebP, SVG), la réduit si besoin et la renvoie en PNG (la transparence est conservée). */
export async function loadLogo(file: File): Promise<Logo> {
  if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp|svg)$/i.test(file.name)) throw new Error("Choisis une image (PNG, JPEG, WebP ou SVG).");
  if (file.size > MAX_INPUT) throw new Error("Image trop lourde (6 Mo maximum).");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode().catch(() => { throw new Error("Cette image n’a pas pu être lue."); });
    const w0 = img.naturalWidth || 300, h0 = img.naturalHeight || 150;
    let scale = Math.min(1, MAX_W / w0, MAX_H / h0);
    for (let attempt = 0; attempt < 4; attempt++) {
      const width = Math.max(1, Math.round(w0 * scale)), height = Math.max(1, Math.round(h0 * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossible de traiter l’image dans ce navigateur.");
      ctx.drawImage(img, 0, 0, width, height);
      const data_url = canvas.toDataURL("image/png");
      if (data_url.length <= MAX_DATA_URL) return { data_url, width, height };
      scale *= 0.7;
    }
    throw new Error("Image trop détaillée : choisis un logo plus simple ou plus petit.");
  } finally { URL.revokeObjectURL(url); }
}

/** Octets d'un logo enregistré (data URL PNG), ou null s'il est absent ou abîmé. */
export function logoBytes(logo: Logo | null | undefined): Uint8Array | null {
  const m = logo?.data_url?.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  try { const bin = atob(m[1]); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); } catch { return null; }
}
