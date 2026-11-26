-- Wayle Prospection : schéma initial (étape a)
-- Une seule équipe (Jonas, Yannick). Tout est fermé aux visiteurs non connectés ;
-- les deux comptes membres lisent et écrivent tout (droits par ligne, RLS).

create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists pgcrypto;

-- ───────────── Types ─────────────
create type stage_kind    as enum ('open', 'won', 'lost');
create type heat_level    as enum ('cold', 'warm', 'hot');
create type district_t    as enum ('rive_droite', 'rive_gauche');
create type channel_t     as enum ('instagram', 'email', 'phone', 'visit', 'linkedin', 'tiktok');
create type activity_kind as enum ('note', 'message', 'call', 'visit', 'reply', 'stage_change');
create type task_kind     as enum ('first_contact', 'follow_up', 'meeting', 'reel_delivery', 'call', 'visit');
create type task_status   as enum ('todo', 'done', 'snoozed', 'no_reply');
create type tone_t        as enum ('tu', 'vous');
create type run_status    as enum ('running', 'stopped_reply', 'finished');
create type ig_activity_t as enum ('active', 'low', 'inactive');
create type quote_status  as enum ('draft', 'sent', 'accepted', 'refused');

-- ───────────── Fonctions utilitaires ─────────────
create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Texte normalisé : minuscules, sans accents, sans ponctuation, espaces simples.
create function norm_text(t text) returns text language sql stable as $$
  select nullif(btrim(regexp_replace(lower(unaccent(coalesce(t, ''))), '[^a-z0-9]+', ' ', 'g')), '')
$$;

-- Identifiant Instagram depuis « @nom », « nom » ou une URL instagram.com/nom/.
create function norm_handle(t text) returns text language sql immutable as $$
  select nullif(lower(regexp_replace(regexp_replace(
           coalesce(t, ''), '^\s*(https?://)?(www\.)?(instagram\.com|instagr\.am)/', '', 'i'),
           '^@|[/?#].*$|\s+', '', 'g')), '')
$$;

-- Téléphone au format international sans « + » (France par défaut).
create function norm_phone(t text) returns text language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(t, ''), '[^0-9+]', '', 'g');
begin
  if d = '' then return null; end if;
  if left(d, 1) = '+' then return nullif(regexp_replace(d, '[^0-9]', '', 'g'), ''); end if;
  if left(d, 2) = '00' then return nullif(substr(d, 3), ''); end if;
  if left(d, 1) = '0' and length(d) = 10 then return '33' || substr(d, 2); end if;
  return d;
end $$;

-- ───────────── Équipe ─────────────
create table team_invites (            -- seules ces adresses obtiennent un profil
  email text primary key check (email = lower(email))
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#cf3f17',
  created_at timestamptz not null default now()
);

create function is_member() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid())
$$;

-- À la création d'un compte : profil seulement si l'adresse est invitée.
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.team_invites where email = lower(new.email)) then
    insert into public.profiles (id, name)
    values (new.id, initcap(split_part(lower(new.email), '@', 1)))
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────── Référentiels ─────────────
create table stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null,
  kind stage_kind not null default 'open',
  color text not null default '#71717a'
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_tone tone_t not null default 'tu',
  is_priority boolean not null default false,
  position int not null default 0
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#71717a'
);

-- ───────────── Prospects ─────────────
create table prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  category_id uuid references categories(id) on delete set null,
  stage_id uuid not null references stages(id),
  owner_id uuid references profiles(id) on delete set null,
  heat heat_level not null default 'cold',
  preferred_channel channel_t,
  address text,
  district district_t,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  website text,
  instagram text,
  tiktok text,
  linkedin text,
  email text,
  phone text,
  contact_first_name text,
  contact_last_name text,
  opened_on date,
  source text,
  score int not null default 0 check (score between 0 and 100),
  est_amount_cents int check (est_amount_cents >= 0),
  highlights text,                      -- « éléments à mettre en avant »
  ig_activity ig_activity_t,            -- saisi à la main
  is_independent boolean not null default true,
  next_action_label text,
  next_action_at date,
  do_not_contact boolean not null default false,
  lost_reason text,
  archived_at timestamptz,
  -- valeurs normalisées (remplies par trigger) pour détecter les doublons
  name_norm text,
  instagram_norm text,
  phone_norm text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prospects_stage_idx on prospects (stage_id) where archived_at is null;
create index prospects_owner_idx on prospects (owner_id);
create index prospects_next_action_idx on prospects (next_action_at) where archived_at is null;
create index prospects_name_trgm_idx on prospects using gin (name_norm gin_trgm_ops);
create index prospects_instagram_norm_idx on prospects (instagram_norm);
create index prospects_phone_norm_idx on prospects (phone_norm);

create function prospects_normalize() returns trigger language plpgsql as $$
begin
  new.name_norm      := norm_text(new.name);
  new.instagram_norm := norm_handle(new.instagram);
  new.phone_norm     := norm_phone(new.phone);
  return new;
end $$;
create trigger prospects_normalize_trg before insert or update on prospects
  for each row execute function prospects_normalize();
create trigger prospects_updated_at before update on prospects
  for each row execute function set_updated_at();

create table prospect_tags (
  prospect_id uuid not null references prospects(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (prospect_id, tag_id)
);

-- Prospects ressemblant à une saisie (même Instagram, même téléphone, nom proche).
create function find_duplicates(p_name text, p_instagram text, p_phone text, p_exclude uuid default null)
returns table (id uuid, name text, reason text, similarity real)
language sql stable security invoker as $$
  select p.id, p.name,
         case when norm_handle(p_instagram) is not null and p.instagram_norm = norm_handle(p_instagram) then 'instagram'
              when norm_phone(p_phone) is not null and p.phone_norm = norm_phone(p_phone) then 'phone'
              else 'name' end,
         similarity(p.name_norm, coalesce(norm_text(p_name), ''))
  from prospects p
  where p.archived_at is null
    and (p_exclude is null or p.id <> p_exclude)
    and ( (norm_handle(p_instagram) is not null and p.instagram_norm = norm_handle(p_instagram))
       or (norm_phone(p_phone) is not null and p.phone_norm = norm_phone(p_phone))
       or (norm_text(p_name) is not null and (p.name_norm = norm_text(p_name) or similarity(p.name_norm, norm_text(p_name)) >= 0.6)) )
  order by 4 desc
  limit 5
$$;

-- ───────────── Historique et tâches ─────────────
create table activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  kind activity_kind not null,
  channel channel_t,
  body text,
  meta jsonb not null default '{}',
  author_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index activities_prospect_idx on activities (prospect_id, created_at desc);

create table sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true
);
create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel channel_t not null,
  category_id uuid references categories(id) on delete set null,
  tone tone_t not null default 'tu',
  body text not null
);
create table sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sequences(id) on delete cascade,
  step_no int not null,
  day_offset int not null check (day_offset >= 0),
  action task_kind not null,
  channel channel_t,
  template_id uuid references templates(id) on delete set null,
  unique (sequence_id, step_no)
);
create table sequence_runs (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  sequence_id uuid not null references sequences(id) on delete cascade,
  current_step int not null default 1,
  status run_status not null default 'running',
  started_at timestamptz not null default now()
);
create table tasks (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  kind task_kind not null,
  title text,
  due_on date not null,
  status task_status not null default 'todo',
  assignee_id uuid references profiles(id) on delete set null,
  run_id uuid references sequence_runs(id) on delete set null,
  step_no int,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_due_idx on tasks (due_on) where status in ('todo', 'snoozed');
create table messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  template_id uuid references templates(id) on delete set null,
  channel channel_t not null,
  variant int not null default 1,
  body text not null,
  written_by_ai boolean not null default false,
  sent_at timestamptz,
  author_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────── Offres, devis, objectifs, score, imports, réglages ─────────────
create table offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  is_recurring boolean not null default false,
  is_active boolean not null default true
);
create table quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  prospect_id uuid not null references prospects(id) on delete cascade,
  lines jsonb not null default '[]',
  total_cents int not null default 0,
  status quote_status not null default 'draft',
  pdf_path text,
  created_at timestamptz not null default now()
);
create table goals (
  month date primary key check (month = date_trunc('month', month)::date),
  revenue_cents int not null default 0,
  contacts int not null default 0
);
create table score_rules (
  key text primary key,
  label text not null,
  weight int not null default 10,
  params jsonb not null default '{}',
  is_active boolean not null default true
);
create table import_batches (
  id uuid primary key default gen_random_uuid(),
  origin text not null check (origin in ('csv', 'notion')),
  column_mapping jsonb not null default '{}',
  created_count int not null default 0,
  skipped_count int not null default 0,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
alter table prospects add column import_batch_id uuid references import_batches(id) on delete set null;
create table settings (
  key text primary key,
  value jsonb not null default '{}'
);

-- ───────────── Droits par ligne ─────────────
do $$
declare t text;
begin
  foreach t in array array['stages','categories','tags','prospects','prospect_tags','activities','sequences',
    'templates','sequence_steps','sequence_runs','tasks','messages','offers','quotes','goals','score_rules',
    'import_batches','settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy members_all on %I for all to authenticated using (is_member()) with check (is_member())', t);
  end loop;
end $$;

alter table profiles enable row level security;
create policy profiles_read on profiles for select to authenticated using (is_member());
create policy profiles_update_self on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

alter table team_invites enable row level security;       -- aucune politique : gérée depuis le tableau de bord
revoke all on team_invites from anon, authenticated;
revoke all on all tables in schema public from anon;

-- ───────────── Temps réel (étape b : kanban à deux) ─────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table prospects, tasks, activities;
  end if;
end $$;
