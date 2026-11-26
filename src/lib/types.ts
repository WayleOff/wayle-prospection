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

/** Analyse SWOT de la communication vidéo d'un prospect (rédigée par l'IA, à vérifier). */
export interface AiSwot { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[]; /** Ce que l'IA ne pouvait pas savoir. */ unknowns: string[] }

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
  /** Poste du contact principal (gérant, responsable communication…). */
  contact_role: string | null;
  /** Ce que fait l'établissement, en quelques mots (texte libre : import ou saisie). */
  activity: string | null;
  /** Description de l'activité rédigée par l'IA à partir de la fiche et du site. */
  ai_description: string | null;
  /** Analyse SWOT de sa communication vidéo, rédigée par l'IA. */
  ai_swot: AiSwot | null;
  ai_analyzed_at: string | null;
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

/** Action d'une étape de séquence (les valeurs de la base : task_kind). */
export type StepAction = "first_contact" | "follow_up" | "call" | "visit";
export interface SequenceStep {
  id?: string;
  step_no: number;
  /** Jours après le début de la séquence (0 = le jour du lancement). */
  day_offset: number;
  action: StepAction;
  channel: Channel | null;
  label: string;
  template_id: string | null;
}
export interface Sequence { id: string; name: string; is_active: boolean; steps: SequenceStep[] }
export type SequenceInput = Omit<Sequence, "id"> & { id?: string };
export type RunStatus = "running" | "stopped_reply" | "finished";
export interface SequenceRun { id: string; prospect_id: string; sequence_id: string; current_step: number; status: RunStatus; started_at: string }

/** Critère du score automatique (table score_rules). `params` : réglages propres au critère (ex. `months`). */
export interface ScoreRule { key: string; label: string; weight: number; is_active: boolean; params: { months?: number } }

/** Offre du catalogue (prix en centimes). `is_recurring` : abonnement mensuel. */
export interface Offer { id: string; name: string; description: string | null; price_cents: number; is_recurring: boolean; is_active: boolean }
export type OfferInput = Omit<Offer, "id"> & { id?: string };

export type QuoteStatus = "draft" | "sent" | "accepted" | "refused";
/** Ligne de devis : quantité (peut être décimale), prix unitaire en centimes (négatif = remise), `recurring` = facturé chaque mois. */
export interface QuoteLine { label: string; description: string; qty: number; unit_cents: number; recurring: boolean }
export interface Quote {
  id: string;
  number: string; // D-AAAA-NNN
  prospect_id: string;
  lines: QuoteLine[];
  /** Montant retenu : prestations ponctuelles + un mois des lignes mensuelles. */
  total_cents: number;
  status: QuoteStatus;
  created_at: string;
  valid_until: string | null; // AAAA-MM-JJ
  notes: string | null;
  /** Acompte à la commande, en % du total ponctuel (0 = pas d'acompte). */
  deposit_percent: number;
}
export type QuoteInput = { prospect_id: string; lines: QuoteLine[]; valid_until: string | null; notes: string | null; deposit_percent: number };

/** Coordonnées de l'entreprise et mentions du devis (table settings, clé « company »). */
export interface Company {
  name: string; owner: string; address: string; zip_city: string; siret: string; phone: string; email: string;
  vat_mention: string; validity_days: number; payment_terms: string;
  /** Acompte proposé par défaut sur un nouveau devis, en % (0 = aucun). */
  default_deposit_percent: number;
}

/** Logo imprimé sur les devis : image PNG redimensionnée, stockée telle quelle dans les réglages. */
export interface Logo { data_url: string; width: number; height: number }

export type InvoiceKind = "invoice" | "deposit" | "credit";
/** Facture de vente importée (Shine ou autre). Montants en centimes ; `paid_on` vide = impayée. */
export interface Invoice {
  id: string; number: string; prospect_id: string | null; client_name: string;
  issued_on: string | null; paid_on: string | null;
  total_ht_cents: number | null; vat_cents: number | null; total_cents: number;
  kind: InvoiceKind; source: string; created_at: string;
}
export type InvoiceInput = Omit<Invoice, "id" | "created_at">;
