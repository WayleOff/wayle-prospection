export type StageKind = "open" | "won" | "lost";
export type Heat = "cold" | "warm" | "hot";
export type District = "rive_droite" | "rive_gauche";
export type Channel = "instagram" | "email" | "phone" | "visit" | "linkedin" | "tiktok";
export type ActivityKind = "note" | "message" | "call" | "visit" | "reply" | "stage_change";
export type IgActivity = "active" | "low" | "inactive";
export type Tone = "tu" | "vous";

export interface Stage { id: string; name: string; position: number; kind: StageKind; color: string }
export interface Category { id: string; name: string; default_tone: Tone; is_priority: boolean; position: number }
export interface Tag { id: string; name: string; color: string }
export interface Profile { id: string; name: string; color: string }

export interface Prospect {
  id: string;
  name: string;
  category_id: string | null;
  stage_id: string;
  owner_id: string | null;
  heat: Heat;
  preferred_channel: Channel | null;
  address: string | null;
  district: District | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  linkedin: string | null;
  email: string | null;
  phone: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  opened_on: string | null; // AAAA-MM-JJ
  source: string | null;
  score: number;
  est_amount_cents: number | null;
  highlights: string | null;
  ig_activity: IgActivity | null;
  is_independent: boolean;
  next_action_label: string | null;
  next_action_at: string | null; // AAAA-MM-JJ
  do_not_contact: boolean;
  lost_reason: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  tag_ids: string[];
}

/** Champs modifiables d'une fiche (tout sauf l'identifiant et les dates techniques). */
export type ProspectPatch = Partial<Omit<Prospect, "id" | "created_at" | "updated_at" | "tag_ids">>;
export type ProspectInput = ProspectPatch & { name: string; stage_id: string };

export interface Activity {
  id: string;
  prospect_id: string;
  kind: ActivityKind;
  channel: Channel | null;
  body: string | null;
  author_id: string | null;
  created_at: string;
}

export interface Reference {
  stages: Stage[];
  categories: Category[];
  tags: Tag[];
  profiles: Profile[];
  me: Profile | null; // null = connecté mais pas invité
}

/** Objectif d'un mois (month = premier jour du mois, AAAA-MM-01). Montants en centimes. */
export interface Goal { month: string; revenue_cents: number; contacts: number }

/** Modèle de message : texte de départ par canal, avec variables {prénom}, {nom_commerce}, {détail_remarqué}, {offre}, {quartier}. */
export interface Template { id: string; name: string; channel: Channel; category_id: string | null; tone: Tone; body: string }
export type TemplateInput = Omit<Template, "id"> & { id?: string };

/** Message préparé ou envoyé à un prospect. */
export interface SentMessage {
  id: string;
  prospect_id: string;
  template_id: string | null;
  channel: Channel;
  variant: number;
  body: string;
  written_by_ai: boolean;
  sent_at: string | null;
  author_id: string | null;
  created_at: string;
}
export type MessageInput = Pick<SentMessage, "prospect_id" | "template_id" | "channel" | "variant" | "body" | "written_by_ai">;
