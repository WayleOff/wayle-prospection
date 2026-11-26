import type { ActivityKind, Channel, District, Heat, IgActivity } from "./types";

export const HEAT_LABEL: Record<Heat, string> = { cold: "Froid", warm: "Tiède", hot: "Chaud" };
export const HEAT_COLOR: Record<Heat, string> = { cold: "#64748b", warm: "#f59e0b", hot: "#dc2626" };
export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: "Instagram", email: "E-mail", phone: "Téléphone", visit: "Visite", linkedin: "LinkedIn", tiktok: "TikTok",
};
export const DISTRICT_LABEL: Record<District, string> = { rive_droite: "Rive droite", rive_gauche: "Rive gauche" };
export const IG_LABEL: Record<IgActivity, string> = { active: "Active", low: "Faible", inactive: "Inactive" };
export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  note: "Note", message: "Message envoyé", call: "Appel", visit: "Visite", reply: "Réponse", stage_change: "Changement d'étape",
};

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const fmtEuros = (cents: number | null | undefined) => (cents == null ? "" : eur.format(cents / 100));

const MS_DAY = 86400000;
const todayStr = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-JJ en heure locale
export const today = todayStr;
export const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
};

/** « Aujourd'hui », « Demain », « En retard de 2 j », « 28 nov. ». */
export function fmtDue(date: string | null): { text: string; late: boolean } | null {
  if (!date) return null;
  const diff = Math.round((new Date(date + "T00:00:00").getTime() - new Date(todayStr() + "T00:00:00").getTime()) / MS_DAY);
  if (diff === 0) return { text: "Aujourd'hui", late: false };
  if (diff === 1) return { text: "Demain", late: false };
  if (diff < 0) return { text: `En retard de ${-diff} j`, late: true };
  return { text: new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), late: false };
}

export function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / MS_DAY);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (days <= 0) return `Aujourd'hui, ${time}`;
  if (days === 1) return `Hier, ${time}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: days > 300 ? "numeric" : undefined });
}
