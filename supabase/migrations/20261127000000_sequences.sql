-- Étape d : séquences de relance.
-- 1. Chaque étape d'une séquence a un libellé affiché dans « Aujourd'hui » (ex. « Relance courte »).
-- 2. Un prospect ne peut avoir qu'une seule séquence en cours à la fois.
alter table sequence_steps add column if not exists label text;
create unique index if not exists sequence_runs_one_running on sequence_runs (prospect_id) where status = 'running';
