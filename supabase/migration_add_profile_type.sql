-- À exécuter dans Supabase SQL Editor si ton projet existe déjà
-- (inutile si tu repars d'un projet vierge avec schema.sql)

alter table profiles
  add column if not exists profile_type text default 'male'
  check (profile_type in ('male', 'female'));
