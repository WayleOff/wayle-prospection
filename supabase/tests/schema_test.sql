-- Tests du schéma (à lancer sur une base vide où la migration et le seed sont passés).
-- Ils simulent auth.users / auth.uid() ; sur Supabase, lancez-les sur un projet jetable.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'ÉCHEC : %', msg; end if; end $$;

-- Normalisation
select pg_temp.assert(norm_text('  Café « Sous les Toits » !') = 'cafe sous les toits', 'norm_text');
select pg_temp.assert(norm_handle('https://www.instagram.com/Demo.Pizza/?hl=fr') = 'demo.pizza', 'norm_handle url');
select pg_temp.assert(norm_handle('@Demo.Pizza') = 'demo.pizza', 'norm_handle @');
select pg_temp.assert(norm_phone('02 61 91 00 11') = '33261910011', 'norm_phone national');
select pg_temp.assert(norm_phone('+33 2 61 91 00 11') = '33261910011', 'norm_phone +33');
select pg_temp.assert(norm_phone('') is null, 'norm_phone vide');

-- Doublons (le seed contient Pizzeria Il Faro, @demo.ilfaro, 02 61 91 00 11)
select pg_temp.assert((select reason from find_duplicates('Autre nom', '@Demo.IlFaro', null) limit 1) = 'instagram', 'doublon instagram');
select pg_temp.assert((select reason from find_duplicates('Autre nom', null, '0261910011') limit 1) = 'phone', 'doublon téléphone');
select pg_temp.assert((select count(*) from find_duplicates('Pizzeria Il Faro', null, null)) >= 1, 'doublon nom exact');
select pg_temp.assert((select count(*) from find_duplicates('Pizzeria Ilfaro', null, null)) >= 1, 'doublon nom proche');
select pg_temp.assert((select count(*) from find_duplicates('Boulangerie Totalement Différente', null, null)) = 0, 'pas de faux doublon');

-- Triggers
insert into prospects (name, stage_id, instagram, phone)
  select 'Épicerie Chez Léon', id, 'https://instagram.com/Chez.Leon', '06 39 98 12 34' from stages where position = 1;
select pg_temp.assert((select name_norm || '|' || instagram_norm || '|' || phone_norm from prospects where name like 'Épicerie%')
                      = 'epicerie chez leon|chez.leon|33639981234', 'trigger de normalisation');

-- Séquences : un seul parcours en cours par prospect, libellé d'étape
insert into sequences (name) values ('Test');
insert into sequence_steps (sequence_id, step_no, day_offset, action, label)
  select id, 1, 0, 'first_contact', 'Premier message' from sequences where name = 'Test';
select pg_temp.assert((select label from sequence_steps limit 1) = 'Premier message', 'libellé d''étape');
insert into sequence_runs (prospect_id, sequence_id)
  select (select id from prospects where name = 'Épicerie Chez Léon'), id from sequences where name = 'Test';
do $$ begin
  begin
    insert into sequence_runs (prospect_id, sequence_id)
      select (select id from prospects where name = 'Épicerie Chez Léon'), id from sequences where name = 'Test';
    raise exception 'ÉCHEC : deux séquences en cours pour un même prospect';
  exception when unique_violation then null; end;
end $$;
update sequence_runs set status = 'finished';
insert into sequence_runs (prospect_id, sequence_id)
  select (select id from prospects where name = 'Épicerie Chez Léon'), id from sequences where name = 'Test';
select pg_temp.assert((select count(*) from sequence_runs where status = 'running') = 1, 'nouvelle séquence possible après la fin de la précédente');

-- Droits : un visiteur anonyme ne voit rien
set local role anon;
do $$ begin
  begin perform count(*) from prospects; raise exception 'ÉCHEC : anon peut lire prospects';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Droits : un compte non invité n'a pas de profil donc aucun accès
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'intrus@example.org');
select pg_temp.assert(not exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'intrus sans profil');
select set_config('t.stage', (select id::text from stages limit 1), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select pg_temp.assert((select count(*) from prospects) = 0, 'intrus : 0 ligne visible');
do $$ begin
  begin insert into prospects (name, stage_id) values ('Pirate', current_setting('t.stage')::uuid); raise exception 'ÉCHEC : intrus peut écrire';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
end $$;
reset role;

-- Droits : un compte invité obtient un profil et voit tout
insert into team_invites (email) values ('jonas@example.org');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'Jonas@Example.org');
select pg_temp.assert(exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'invité avec profil');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select pg_temp.assert((select count(*) from prospects) = 16, 'membre : voit les 16 lignes');
update prospects set heat = 'hot' where name = 'Épicerie Chez Léon';
select pg_temp.assert((select heat from prospects where name = 'Épicerie Chez Léon') = 'hot', 'membre : écriture');
do $$ begin
  begin perform count(*) from team_invites; raise exception 'ÉCHEC : membre peut lire team_invites';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Étape e : import annulable et critères du score, comme le fait l'application (compte membre)
select set_config('t.stage', (select id::text from stages order by position limit 1), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
with b as (insert into import_batches (origin, column_mapping, created_count, skipped_count) values ('csv', '{"Nom":"name"}', 2, 1) returning id)
insert into prospects (id, name, stage_id, score, source, import_batch_id, created_by, owner_id)
select v.id::uuid, v.name, current_setting('t.stage')::uuid, 42, 'Import CSV', b.id, '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1'
from b, (values ('10000000-0000-0000-0000-000000000001', 'Import Un'), ('10000000-0000-0000-0000-000000000002', 'Import Deux')) v(id, name);
select pg_temp.assert((select count(*) from prospects where import_batch_id is not null and archived_at is null) = 2, 'import : 2 fiches créées dans le lot');
update prospects set archived_at = now() where import_batch_id = (select id from import_batches limit 1) and archived_at is null;
update import_batches set undone_at = now();
select pg_temp.assert((select count(*) from prospects where import_batch_id is not null and archived_at is null) = 0, 'annulation : lot archivé');
select pg_temp.assert((select undone_at is not null from import_batches limit 1), 'annulation : lot marqué');
insert into score_rules (key, label, weight, is_active, params) values ('recent_opening', 'Ouverture récente', 30, true, '{"months": 6}')
  on conflict (key) do update set weight = excluded.weight, params = excluded.params;
select pg_temp.assert((select (params->>'months')::int from score_rules where key = 'recent_opening') = 6, 'score_rules : upsert');
reset role;

-- Étape f : devis (comme le fait l'application, compte membre)
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
insert into offers (name, description, price_cents, is_recurring) values ('Reel d''essai', 'Demi-journée', 9000, false);
insert into quotes (number, prospect_id, lines, total_cents, status, valid_until, notes)
  select 'D-2026-001', id, '[{"label":"Reel d''essai","description":"","qty":1,"unit_cents":9000,"recurring":false}]'::jsonb, 9000, 'draft', current_date + 30, 'Note' from prospects limit 1;
select pg_temp.assert((select valid_until is not null and notes = 'Note' and status = 'draft' from quotes where number = 'D-2026-001'), 'devis : colonnes valid_until / notes');
do $$ begin
  begin insert into quotes (number, prospect_id) select 'D-2026-001', id from prospects limit 1; raise exception 'ÉCHEC : numéro de devis en double accepté';
  exception when unique_violation then null; end;
end $$;
update quotes set status = 'accepted' where number = 'D-2026-001';
insert into settings (key, value) values ('company', '{"siret":"123"}') on conflict (key) do update set value = excluded.value;
select pg_temp.assert((select value->>'siret' from settings where key = 'company') = '123', 'settings : coordonnées entreprise');
reset role;

-- Étape f (suite) : acompte et factures importées
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
update quotes set deposit_percent = 30 where number = 'D-2026-001';
select pg_temp.assert((select deposit_percent = 30 from quotes where number = 'D-2026-001'), 'acompte : 30 %');
do $$ begin
  begin update quotes set deposit_percent = 150 where number = 'D-2026-001'; raise exception 'ÉCHEC : acompte au-dessus de 100 accepté';
  exception when check_violation then null; end;
end $$;
insert into import_batches (origin, column_mapping, created_count, skipped_count) values ('csv', '{"Facture":"number"}', 2, 0);
insert into invoices (number, prospect_id, client_name, issued_on, paid_on, total_cents, import_batch_id)
  select 'F-2026-001', p.id, 'Client', current_date, null, 45000, b.id from prospects p, import_batches b where b.origin = 'csv' limit 1;
insert into invoices (number, client_name, total_cents, kind) values ('AV-2026-001', 'Sans fiche', -5000, 'credit');
select pg_temp.assert((select count(*) from invoices) = 2, 'factures : 2 créées (une sans prospect)');
do $$ begin
  begin insert into invoices (number, client_name, total_cents) values ('F-2026-001', 'Doublon', 1); raise exception 'ÉCHEC : numéro de facture en double accepté';
  exception when unique_violation then null; end;
end $$;
do $$ begin
  begin insert into invoices (number, client_name, total_cents, kind) values ('X', 'Client', 1, 'autre'); raise exception 'ÉCHEC : type de facture inconnu accepté';
  exception when check_violation then null; end;
end $$;
update invoices set paid_on = current_date where number = 'F-2026-001';
select pg_temp.assert((select paid_on is not null from invoices where number = 'F-2026-001'), 'factures : marquée payée');
delete from invoices where import_batch_id is not null;
select pg_temp.assert((select count(*) from invoices) = 1, 'factures : annulation du lot');
reset role;
set local role anon;
do $$ begin
  begin perform count(*) from invoices; raise exception 'ÉCHEC : factures lisibles sans connexion';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
\echo TOUS LES TESTS SQL PASSENT
