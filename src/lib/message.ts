import { normText } from "./normalize";
import type { Category, Channel, Prospect, Template, Tone } from "./types";

/** Variables que l'on peut écrire dans un modèle. */
export const VARIABLES = ["{prénom}", "{nom_commerce}", "{détail_remarqué}", "{offre}", "{quartier}"] as const;

/** Une relance « Pas de réponse » ou un premier message envoyé programme la suite à J+3. */
export const RELANCE_DAYS = 3;

export const OFFERS = [
  { id: "reel", label: "un reel d'essai", hint: "Reel d'essai" },
  { id: "portfolio", label: "mon portfolio", hint: "Portfolio" },
  { id: "echange", label: "un échange de 10 minutes", hint: "Échange de 10 min" },
] as const;
export type OfferId = (typeof OFFERS)[number]["id"];

const MISSING_DETAIL = "[détail à compléter]";

export interface FillVars { prospect: Prospect; offer: string; detail?: string | null }

/** Première ligne non vide des « Éléments à mettre en avant », sans point final. */
export function detailFrom(highlights: string | null | undefined): string | null {
  const line = (highlights ?? "").split(/\r?\n/).map((l) => l.replace(/^[-•*\s]+/, "").trim()).find(Boolean);
  return line ? line.replace(/[.\s]+$/, "") : null;
}

/** Remplace les variables d'un modèle. Un détail manquant devient « [détail à compléter] » pour que ça se voie. */
export function fillTemplate(body: string, v: FillVars): { text: string; missing: string[] } {
  const missing: string[] = [];
  const detail = (v.detail ?? "").trim();
  const district = v.prospect.district === "rive_gauche" ? "rive gauche" : v.prospect.district === "rive_droite" ? "rive droite" : "";
  const map: Record<string, string> = {
    "{prénom}": (v.prospect.contact_first_name ?? "").trim(),
    "{nom_commerce}": v.prospect.name.trim(),
    "{détail_remarqué}": detail || MISSING_DETAIL,
    "{offre}": v.offer,
    "{quartier}": district ? `Rouen ${district}` : "Rouen",
  };
  if (!detail && body.includes("{détail_remarqué}")) missing.push("détail remarqué");
  let text = body;
  for (const [k, val] of Object.entries(map)) text = text.split(k).join(val);
  // « Bonjour , » → « Bonjour, » quand il n'y a pas de prénom
  text = text.replace(/[ \t]+([,.])/g, "$1").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text, missing };
}

const isRelance = (t: Template) => /relance|dernier/i.test(t.name);

/** Modèle proposé par défaut : bon canal, bon ton, relance si le prospect a déjà été contacté. */
export function pickTemplate(templates: Template[], o: { channel: Channel; tone: Tone; categoryId: string | null; contacted: boolean; label?: string | null }): Template | null {
  const list = templates.filter((t) => t.channel === o.channel);
  const want = normText(o.label);
  // Une étape de séquence (« Relance courte », « Dernier message »…) retrouve le modèle qui porte ce nom.
  const named = (t: Template) => (want && (normText(t.name) ?? "").includes(want) ? 16 : 0);
  const score = (t: Template) => named(t) + (t.tone === o.tone ? 4 : 0) + (o.categoryId && t.category_id === o.categoryId ? 2 : t.category_id == null ? 1 : 0) + (isRelance(t) === o.contacted ? 8 : 0);
  return [...list].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0] ?? null;
}

type Starter = Omit<Template, "id">;

/** Modèles de départ (à adapter) : courts, directs, chaleureux, avec une proposition concrète. */
export function starterTemplates(categories: Category[]): Starter[] {
  const cat = (n: string) => categories.find((c) => c.name === n)?.id ?? null;
  const t = (name: string, channel: Channel, tone: Tone, body: string, category: string | null = null): Starter => ({ name, channel, tone, category_id: category ? cat(category) : null, body });
  return [
    t("Instagram · premier message (tu)", "instagram", "tu",
      "Bonjour {prénom},\n\nJe suis Jonas, vidéaste à Rouen (Wayle Production). Ce qui m'a tapé dans l'œil chez {nom_commerce} : {détail_remarqué}.\n\nJe te propose {offre} pour te montrer ce que ça pourrait donner chez toi, sans engagement. Ça te dit ?\n\nJonas"),
    t("Instagram · premier message (vous)", "instagram", "vous",
      "Bonjour {prénom},\n\nJe suis Jonas, vidéaste à Rouen (Wayle Production). Ce qui m'a plu chez {nom_commerce} : {détail_remarqué}.\n\nJe vous propose {offre} pour vous montrer ce que cela pourrait donner pour vous, sans engagement. Seriez-vous partant ?\n\nJonas"),
    t("Instagram · relance courte (tu)", "instagram", "tu",
      "Bonjour {prénom}, je reviens vers toi au sujet de {offre} pour {nom_commerce}. Si ce n'est pas le bon moment, aucun souci, dis-le-moi simplement.\n\nJonas"),
    t("Instagram · relance courte (vous)", "instagram", "vous",
      "Bonjour {prénom}, je me permets de revenir vers vous au sujet de {offre} pour {nom_commerce}. Si ce n'est pas le bon moment, aucun souci, dites-le-moi simplement.\n\nJonas"),
    t("Instagram · dernier message (tu)", "instagram", "tu",
      "Bonjour {prénom}, dernier message de ma part : l'idée d'{offre} pour {nom_commerce} reste ouverte si ça t'intéresse un jour. Belle continuation !\n\nJonas"),
    t("E-mail · premier message (vous)", "email", "vous",
      "Objet : Une courte vidéo pour {nom_commerce} ?\n\nBonjour {prénom},\n\nJe suis Jonas Deschamps, vidéaste à Rouen (Wayle Production). Ce qui m'a plu chez {nom_commerce} : {détail_remarqué}.\n\nJe vous propose {offre} pour vous montrer ce que je pourrais faire pour vous, sans engagement. Seriez-vous disponible pour en parler ?\n\nBien cordialement,\nJonas Deschamps\nWayle Production · Rouen · wayle.fr"),
    t("E-mail · premier message (tu)", "email", "tu",
      "Objet : Une courte vidéo pour {nom_commerce} ?\n\nBonjour {prénom},\n\nJe suis Jonas, vidéaste à Rouen (Wayle Production). Ce qui m'a tapé dans l'œil chez {nom_commerce} : {détail_remarqué}.\n\nJe te propose {offre} pour te montrer ce que ça pourrait donner, sans engagement. Ça te dit d'en discuter ?\n\nJonas\nWayle Production · Rouen · wayle.fr"),
    t("LinkedIn · premier message (vous)", "linkedin", "vous",
      "Bonjour {prénom},\n\nJe suis Jonas, vidéaste à Rouen (Wayle Production). Je vous contacte car {détail_remarqué}.\n\nJe vous propose {offre} pour voir si une vidéo courte peut servir {nom_commerce}. Seriez-vous ouvert à un échange ?\n\nJonas", "Cabinet de recrutement"),
    t("Téléphone · trame d'appel (tu)", "phone", "tu",
      "Bonjour {prénom}, c'est Jonas, vidéaste à Rouen. Je ne vous retiens pas longtemps.\n\n• Pourquoi j'appelle : {détail_remarqué}\n• Ma proposition : {offre}, sans engagement\n• Question : est-ce que je peux passer ou vous envoyer un exemple cette semaine ?"),
    t("Visite · trame sur place (tu)", "visit", "tu",
      "Bonjour, je suis Jonas, vidéaste à Rouen. Je passe parce que {détail_remarqué}.\n\nJe peux vous laisser mon portfolio ? Et si ça vous tente, je vous propose {offre} pour {nom_commerce}."),
  ];
}
