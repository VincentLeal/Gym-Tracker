-- ============================================================================
-- Migration V3 — RIR ressenti par série
-- ============================================================================
-- À exécuter manuellement dans le Supabase SQL Editor. Idempotent et strictement
-- additif : une colonne nullable, aucune ligne existante n'est modifiée.
--
-- L'application n'envoie la colonne rir que lorsqu'un RIR est saisi : tant que
-- cette migration n'est pas appliquée, l'enregistrement des séries sans RIR
-- continue de fonctionner, mais la saisie d'un RIR échouera à la sauvegarde.
-- ============================================================================

alter table session_sets
  add column if not exists rir smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'session_sets_rir_check'
  ) then
    alter table session_sets
      add constraint session_sets_rir_check
      check (rir is null or rir between 0 and 10);
  end if;
end $$;

-- Vérification :
--   select column_name, data_type from information_schema.columns
--   where table_name = 'session_sets' and column_name = 'rir';

-- ROLLBACK (perd les RIR saisis) :
--   alter table session_sets drop constraint if exists session_sets_rir_check;
--   alter table session_sets drop column if exists rir;
