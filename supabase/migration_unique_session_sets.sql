-- À exécuter dans Supabase SQL Editor si ton projet existe déjà

alter table session_sets
  add constraint session_sets_unique_set
  unique (session_id, exercise_index, set_index);
