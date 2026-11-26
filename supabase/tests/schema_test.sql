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

rollback;
\echo TOUS LES TESTS SQL PASSENT
