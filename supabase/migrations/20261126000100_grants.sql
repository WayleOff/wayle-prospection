-- Droits d'accès explicites pour l'API de Supabase.
-- Les projets récents n'ouvrent plus automatiquement les nouvelles tables à l'API : sans ces lignes,
-- l'application reçoit « permission denied for table … ». Les règles par ligne (RLS, voir le schéma)
-- restent la vraie protection : un utilisateur non membre de l'équipe ne voit et n'écrit rien.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- team_invites reste fermée au navigateur (gérée depuis le tableau de bord uniquement).
revoke all on team_invites from anon, authenticated;
revoke all on all tables in schema public from anon;
