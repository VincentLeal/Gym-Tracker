-- ============================================================================
-- Migration V2 — programme A/B/C (Vincent & Axelle)
-- ============================================================================
-- À exécuter manuellement dans le Supabase SQL Editor, dans l'ORDRE ci-dessous.
-- Ne PAS exécuter automatiquement depuis un pipeline / CI. Ce script est
-- idempotent (peut être relancé sans dégâts) et strictement additif :
-- aucune table, colonne ou ligne existante n'est supprimée ou réécrite.
--
-- Ordre d'exécution :
--   1) profiles.program_role (+ migration prudente des profils existants)
--   2) session_sets.exercise_id
--   3) session_sets.duration_minutes / session_sets.resistance_note (cardio)
--   4) contrainte session_type : autoriser 'a' / 'b' / 'c' en plus de push/pull/legs
--   5) contraintes / index d'unicité et de performance
--   6) contrôles de vérification (SELECT en fin de fichier)
--
-- Stratégie de retour arrière : voir bloc ROLLBACK en bas de fichier.
-- Aucun secret ni valeur d'environnement n'est inclus dans ce fichier.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) profiles.program_role
-- ----------------------------------------------------------------------------
-- Rôle explicite dans le programme, indépendant de l'objectif sportif.
-- profile_type est conservé tel quel (colonne legacy, non supprimée).
alter table profiles
  add column if not exists program_role text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_program_role_check'
  ) then
    alter table profiles
      add constraint profiles_program_role_check
      check (program_role is null or program_role in ('vincent', 'axelle'));
  end if;
end $$;

-- Migration prudente : uniquement les profils qui n'ont pas encore program_role.
-- male -> vincent, female -> axelle. Aucune ligne n'est écrasée si program_role
-- est déjà renseigné.
update profiles set program_role = 'vincent' where program_role is null and profile_type = 'male';
update profiles set program_role = 'axelle' where program_role is null and profile_type = 'female';


-- ----------------------------------------------------------------------------
-- 2) session_sets.exercise_id — identifiant stable de l'exercice
-- ----------------------------------------------------------------------------
-- Nullable : les anciennes séries (push/pull/legs) conservent exercise_id = null.
-- Les nouvelles séries (a/b/c) renseignent toujours cette colonne.
alter table session_sets
  add column if not exists exercise_id text;


-- ----------------------------------------------------------------------------
-- 3) session_sets — colonnes cardio
-- ----------------------------------------------------------------------------
-- Le cardio ne doit jamais détourner weight_kg/reps. On ajoute deux colonnes
-- dédiées, nullables, sans impact sur les lignes existantes.
alter table session_sets
  add column if not exists duration_minutes integer;

alter table session_sets
  add column if not exists resistance_note text;


-- ----------------------------------------------------------------------------
-- 4) sessions.session_type — accepter 'a' / 'b' / 'c' en plus de l'historique
-- ----------------------------------------------------------------------------
-- Les nouvelles séances utilisent uniquement a/b/c. push/pull/legs restent
-- acceptées pour ne pas invalider l'historique existant.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'sessions_session_type_check'
  ) then
    alter table sessions drop constraint sessions_session_type_check;
  end if;

  alter table sessions
    add constraint sessions_session_type_check
    check (session_type in ('push', 'pull', 'legs', 'a', 'b', 'c'));
end $$;


-- ----------------------------------------------------------------------------
-- 5) Contraintes d'unicité et index
-- ----------------------------------------------------------------------------
-- Contrainte historique (peut déjà exister si migration_unique_session_sets.sql
-- a été appliquée) : on la (re)crée seulement si absente, sans y toucher sinon.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'session_sets_unique_set'
  ) then
    alter table session_sets
      add constraint session_sets_unique_set
      unique (session_id, exercise_index, set_index);
  end if;
end $$;

-- Nouvelle contrainte d'unicité basée sur exercise_id, pour les nouvelles séries
-- uniquement. Index partiel : les anciennes lignes avec exercise_id = null n'y
-- participent pas (Postgres ne comparerait de toute façon jamais deux NULL comme
-- égaux, mais le filtre WHERE le rend explicite et évite tout doute).
create unique index if not exists session_sets_unique_by_exercise_id
  on session_sets (session_id, exercise_id, set_index)
  where exercise_id is not null;

-- Index de confort pour l'historique par exercice et les listes de séances.
create index if not exists session_sets_exercise_id_idx
  on session_sets (exercise_id)
  where exercise_id is not null;

create index if not exists sessions_user_id_session_date_idx
  on sessions (user_id, session_date desc);


-- ----------------------------------------------------------------------------
-- RLS — aucune modification nécessaire
-- ----------------------------------------------------------------------------
-- Toutes les policies existantes (profiles/sessions/session_sets) restent en
-- place à l'identique. Cette migration n'ajoute aucune table.


-- ============================================================================
-- CONTRÔLES DE VÉRIFICATION (à exécuter après la migration)
-- ============================================================================
-- 1. Toutes les colonnes attendues existent :
--    select column_name from information_schema.columns
--    where table_name = 'profiles' and column_name = 'program_role';
--    select column_name from information_schema.columns
--    where table_name = 'session_sets' and column_name in ('exercise_id', 'duration_minutes', 'resistance_note');
--
-- 2. Aucun profil existant n'a été perdu ou modifié de façon inattendue :
--    select profile_type, program_role, count(*) from profiles group by 1, 2 order by 1, 2;
--
-- 3. La contrainte session_type accepte bien les 6 valeurs :
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'sessions_session_type_check';
--
-- 4. Aucune séance ou série historique n'a été supprimée (comparer un count
--    avant/après migration, à faire manuellement avant d'exécuter ce script) :
--    select session_type, count(*) from sessions group by 1;
--    select count(*) from session_sets;
--
-- 5. Le nouvel index partiel est bien en place :
--    select indexname from pg_indexes where indexname = 'session_sets_unique_by_exercise_id';


-- ============================================================================
-- ROLLBACK (retour arrière réaliste — à exécuter manuellement si besoin)
-- ============================================================================
-- Ces opérations sont sûres tant qu'aucune donnée V2 (program_role, exercise_id,
-- séances a/b/c) n'a encore été créée par l'application. Si des séances a/b/c
-- existent déjà, les supprimer d'abord rendrait la contrainte session_type
-- inapplicable en retour arrière : dans ce cas, ne PAS revenir en arrière sur
-- l'étape 4, se contenter des étapes 1 à 3 si nécessaire.
--
-- alter table sessions drop constraint if exists sessions_session_type_check;
-- alter table sessions add constraint sessions_session_type_check
--   check (session_type in ('push', 'pull', 'legs'));
--
-- drop index if exists session_sets_unique_by_exercise_id;
-- drop index if exists session_sets_exercise_id_idx;
-- drop index if exists sessions_user_id_session_date_idx;
--
-- alter table session_sets drop column if exists exercise_id;
-- alter table session_sets drop column if exists duration_minutes;
-- alter table session_sets drop column if exists resistance_note;
--
-- alter table profiles drop constraint if exists profiles_program_role_check;
-- alter table profiles drop column if exists program_role;
