/**
 * Données du mode démonstration : le même jeu que supabase/seed.sql (15 prospects rouennais FICTIFS).
 * Un test vérifie que les noms restent identiques entre les deux.
 */
import type { Activity, Category, Heat, Prospect, Reference, Stage, Tag } from "../types";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

export const DEMO_STAGES: Stage[] = [
  { id: "st-1", name: "À contacter", position: 1, kind: "open", color: "#71717a" },
  { id: "st-2", name: "Contacté", position: 2, kind: "open", color: "#3b82f6" },
  { id: "st-3", name: "Répondu", position: 3, kind: "open", color: "#8b5cf6" },
  { id: "st-4", name: "RDV / Tournage prévu", position: 4, kind: "open", color: "#f59e0b" },
  { id: "st-5", name: "Reel livré", position: 5, kind: "open", color: "#06b6d4" },
  { id: "st-6", name: "Gagné", position: 6, kind: "won", color: "#16a34a" },
  { id: "st-7", name: "Perdu", position: 7, kind: "lost", color: "#dc2626" },
];

export const DEMO_CATEGORIES: Category[] = [
  ["Restaurant", "tu", true], ["Café / bar", "tu", true], ["Hôtel / gîte", "vous", false], ["Commerce", "tu", true],
  ["PME", "vous", false], ["Cabinet de recrutement", "vous", false], ["Agence de communication", "vous", false],
  ["Créateur de contenu", "tu", false], ["Artiste / musicien", "tu", false],
].map(([name, tone, prio], i) => ({ id: `cat-${i + 1}`, name: name as string, default_tone: tone as "tu" | "vous", is_priority: prio as boolean, position: i + 1 }));

export const DEMO_TAGS: Tag[] = [
  { id: "tag-demo", name: "démo", color: "#a1a1aa" },
  { id: "tag-new", name: "ouverture récente", color: "#f59e0b" },
  { id: "tag-visit", name: "à visiter", color: "#3b82f6" },
];

export const DEMO_REFERENCE: Reference = {
  stages: DEMO_STAGES,
  categories: DEMO_CATEGORIES,
  tags: DEMO_TAGS,
  profiles: [
    { id: "u-jonas", name: "Jonas", color: "#cf3f17" },
    { id: "u-yannick", name: "Yannick", color: "#2563eb" },
  ],
  me: { id: "u-jonas", name: "Jonas", color: "#cf3f17" },
};

type Row = [name: string, cat: string, stage: string, heat: Heat, channel: Prospect["preferred_channel"], address: string | null,
  district: Prospect["district"], lat: number | null, lng: number | null, instagram: string | null, phone: string | null, email: string | null,
  first: string, last: string, opened: string | null, source: string, amount: number, highlights: string, ig: Prospect["ig_activity"],
  nextLabel: string | null, nextIn: number | null, score: number, tags: string[]];

const ROWS: Row[] = [
  ["Le Comptoir des Marées", "Restaurant", "À contacter", "cold", "instagram", "12 rue Eau-de-Robec, 76000 Rouen", "rive_droite", 49.4438, 1.1046, "@demo.comptoir.marees", "02 61 91 00 01", "contact@comptoir-marees.example.org", "Camille", "Roux", "2026-09-15", "Balade rue Eau-de-Robec", 9000, "Ouverture récente, carte courte de poissons, jolie vaisselle bleue", "low", "Premier DM Instagram", 0, 78, ["tag-demo", "tag-new"]],
  ["Atelier Pomme & Cannelle", "Café / bar", "À contacter", "cold", "visit", "5 rue Martainville, 76000 Rouen", "rive_droite", 49.4425, 1.1081, "@demo.pomme.cannelle", "02 61 91 00 02", null, "Inès", "Lambert", "2026-06-02", "Recommandation", 9000, "Salon de thé, pâtisseries maison, déco bois clair", "inactive", "Passer en boutique", 1, 71, ["tag-demo", "tag-visit"]],
  ["Hôtel du Vieux Port (démo)", "Hôtel / gîte", "À contacter", "cold", "email", "8 quai de la Bourse, 76000 Rouen", "rive_droite", 49.4389, 1.0924, null, "02 61 91 00 03", "direction@hotel-vieux-port.example.org", "Monsieur", "Fournier", null, "Google Maps", 45000, "Façade du quai, vue sur la Seine, petit-déjeuner servi dans la cour", null, "Envoyer un e-mail", 0, 55, ["tag-demo", "tag-visit"]],
  ["Boutique Fil & Aiguille", "Commerce", "Contacté", "warm", "instagram", "21 rue Cauchoise, 76000 Rouen", "rive_droite", 49.4452, 1.0871, "@demo.fil.aiguille", "06 39 98 00 04", null, "Margaux", "Petit", "2026-03-10", "Instagram", 9000, "Créatrice de vêtements, ateliers couture le samedi", "low", "Relance courte", 2, 66, ["tag-demo"]],
  ["Bar à Vins Les Trois Clés", "Café / bar", "Contacté", "warm", "instagram", "3 place du Vieux-Marché, 76000 Rouen", "rive_droite", 49.4433, 1.0885, "@demo.trois.cles", "02 61 91 00 05", null, "Théo", "Morel", "2026-10-01", "Instagram", 9000, "Soirées dégustation du jeudi, cave voûtée", "active", "Relance courte", 3, 62, ["tag-demo", "tag-new"]],
  ["Studio Yoga Respire", "Commerce", "Contacté", "cold", "phone", "14 rue Jeanne d'Arc, 76000 Rouen", "rive_droite", 49.4461, 1.0937, "@demo.yoga.respire", "06 39 98 00 06", null, "Laura", "Garnier", "2026-08-20", "Recommandation", 9000, "Cours en petit groupe, lumière naturelle", "low", "Appeler", 1, 58, ["tag-demo"]],
  ["Maison Delaunay Traiteur", "Restaurant", "Répondu", "hot", "email", "9 rue Saint-Romain, 76000 Rouen", "rive_droite", 49.4408, 1.0956, "@demo.delaunay.traiteur", "02 61 91 00 07", "bonjour@delaunay-traiteur.example.org", "Julien", "Delaunay", "2025-11-12", "Google Maps", 9000, "Buffets de mariage, livraison en vélo cargo", "low", "Proposer le reel d'essai", 0, 84, ["tag-demo"]],
  ["Cabinet Horizon RH", "Cabinet de recrutement", "Répondu", "warm", "linkedin", "2 rue de la République, 76000 Rouen", "rive_droite", 49.4379, 1.0951, null, "02 61 91 00 08", "contact@horizon-rh.example.org", "Sophie", "Marchand", null, "LinkedIn", 120000, "Vidéos de présentation des équipes à créer", null, "Échange de 10 minutes", 2, 49, ["tag-demo"]],
  ["Café Sous les Toits", "Café / bar", "RDV / Tournage prévu", "hot", "visit", "17 rue Damiette, 76000 Rouen", "rive_droite", 49.4396, 1.1029, "@demo.sous.les.toits", "06 39 98 00 09", null, "Anaïs", "Girard", "2026-05-04", "Visite", 9000, "Terrasse sur les toits, brunch du dimanche", "low", "Tournage du reel d'essai", 4, 82, ["tag-demo"]],
  ["Chambres d'hôtes La Pie Voleuse", "Hôtel / gîte", "RDV / Tournage prévu", "warm", "email", "6 rue de Fontenelle, 76000 Rouen", "rive_droite", 49.4467, 1.1011, "@demo.pie.voleuse", "02 61 91 00 10", "reservation@pie-voleuse.example.org", "Brigitte", "Colin", "2024-04-01", "Recommandation", 45000, "Maison à colombages, jardin intérieur", "inactive", "Repérage", 5, 60, ["tag-demo"]],
  ["Pizzeria Il Faro", "Restaurant", "Reel livré", "hot", "phone", "30 rue Saint-Sever, 76100 Rouen", "rive_gauche", 49.4294, 1.0817, "@demo.ilfaro", "02 61 91 00 11", null, "Marco", "Benedetti", "2025-02-14", "Visite", 9000, "Four à bois visible depuis la salle, pâte étalée à la main", "low", "Présenter le reel", 0, 88, ["tag-demo"]],
  ["Studio Lumière & Cie", "Agence de communication", "Reel livré", "warm", "email", "4 rue Raymond Poincaré, 76100 Rouen", "rive_gauche", 49.4261, 1.0903, "@demo.lumiere.cie", "02 61 91 00 12", "hello@lumiere-cie.example.org", "Valérie", "Dupuis", null, "LinkedIn", 60000, "Sous-traitance vidéo pour leurs clients", "active", "Relance après livraison", 2, 52, ["tag-demo"]],
  ["Garage Pop & Roule", "PME", "Gagné", "hot", "phone", "45 avenue des Canadiens, 76300 Sotteville-lès-Rouen", "rive_gauche", 49.4119, 1.085, null, "02 61 91 00 13", "accueil@pop-roule.example.org", "Étienne", "Vasseur", "2023-09-01", "Recommandation", 120000, "Garage indépendant, voitures de collection", null, null, null, 72, ["tag-demo"]],
  ["Léa Corsaire", "Créateur de contenu", "Gagné", "hot", "instagram", null, null, null, null, "@demo.lea.corsaire", null, "lea@corsaire.example.org", "Léa", "Corsaire", null, "Instagram", 90000, "Vidéos de voyage, abonnés en croissance", "active", null, null, 69, ["tag-demo"]],
  ["Les Frères Vallée (rap)", "Artiste / musicien", "Perdu", "cold", "instagram", null, null, null, null, "@demo.freres.vallee", null, null, "Hugo", "Vallée", null, "Instagram", 30000, "Clip prévu, budget trop serré", "active", null, null, 40, ["tag-demo"]],
];

/** Les 15 prospects fictifs, sans identifiant (la couche d'accès en attribue). */
export function demoProspects(): Omit<Prospect, "id">[] {
  const stageId = (n: string) => DEMO_STAGES.find((s) => s.name === n)!.id;
  const catId = (n: string) => DEMO_CATEGORIES.find((c) => c.name === n)!.id;
  return ROWS.map((r, i) => ({
    name: r[0], category_id: catId(r[1]), stage_id: stageId(r[2]), owner_id: null, heat: r[3], preferred_channel: r[4],
    address: r[5], district: r[6], lat: r[7], lng: r[8], website: null, instagram: r[9], tiktok: null, linkedin: null,
    email: r[11], phone: r[10], contact_first_name: r[12], contact_last_name: r[13], opened_on: r[14], source: r[15],
    score: r[21], est_amount_cents: r[16], highlights: r[17], ig_activity: r[18], is_independent: true,
    next_action_label: r[19], next_action_at: r[20] == null ? null : day(r[20]),
    do_not_contact: false, lost_reason: r[0] === "Les Frères Vallée (rap)" ? "Budget trop serré pour cette année" : null,
    archived_at: null, created_at: ago(30 - i), updated_at: ago(30 - i), tag_ids: r[22],
  }));
}

/** Historique de départ, indexé par nom de prospect. */
export const DEMO_ACTIVITIES: [name: string, kind: Activity["kind"], channel: Activity["channel"], body: string, daysAgo: number][] = [
  ["Maison Delaunay Traiteur", "message", "email", "Premier e-mail envoyé : portfolio et proposition de reel d'essai.", 6],
  ["Maison Delaunay Traiteur", "reply", "email", "Réponse : intéressé, demande combien de temps dure le tournage.", 2],
  ["Maison Delaunay Traiteur", "stage_change", null, "Contacté → Répondu", 2],
  ["Pizzeria Il Faro", "visit", "visit", "Visite sur place, très bon accueil, tournage fait mardi.", 9],
  ["Pizzeria Il Faro", "note", null, "Veut un montage plus rythmé pour les stories.", 3],
  ["Café Sous les Toits", "call", "phone", "Appel : rendez-vous fixé pour le tournage.", 4],
  ["Boutique Fil & Aiguille", "message", "instagram", "DM envoyé : compliment sur les ateliers et proposition de reel.", 3],
  ["Café Sous les Toits", "stage_change", null, "Répondu → RDV / Tournage prévu", 4],
  ["Pizzeria Il Faro", "stage_change", null, "RDV / Tournage prévu → Reel livré", 1],
  ["Studio Lumière & Cie", "stage_change", null, "RDV / Tournage prévu → Reel livré", 2],
  ["Léa Corsaire", "stage_change", null, "Reel livré → Gagné", 1],
  ["Garage Pop & Roule", "stage_change", null, "Reel livré → Gagné", 2],
  ["Bar à Vins Les Trois Clés", "message", "instagram", "DM envoyé : proposition de reel d'essai.", 2],
  ["Studio Yoga Respire", "message", "email", "E-mail envoyé : présentation et exemples de reels.", 1],
];
export const activityDate = ago;
