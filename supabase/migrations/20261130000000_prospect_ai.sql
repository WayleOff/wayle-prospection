-- Fiche prospect : poste du contact, activité, description et analyse SWOT générées par l'IA.
alter table prospects add column if not exists contact_role text;
alter table prospects add column if not exists activity text;
alter table prospects add column if not exists ai_description text;
alter table prospects add column if not exists ai_swot jsonb;
alter table prospects add column if not exists ai_analyzed_at timestamptz;
