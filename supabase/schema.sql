-- Run this in your Supabase SQL editor

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  created_at timestamp with time zone default now()
);

create table sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  session_type text not null check (session_type in ('push', 'pull', 'legs')),
  session_date date not null,
  total_volume integer default 0,
  sets_done integer default 0,
  sets_total integer default 0,
  note text,
  created_at timestamp with time zone default now()
);

create table session_sets (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade not null,
  exercise_index integer not null,
  exercise_name text not null,
  set_index integer not null,
  weight_kg numeric(5,2),
  reps integer,
  completed boolean default false
);

-- Row Level Security
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table session_sets enable row level security;

create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "Users can view own sessions" on sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on sessions for insert with check (auth.uid() = user_id);
create policy "Users can delete own sessions" on sessions for delete using (auth.uid() = user_id);

create policy "Users can view own sets" on session_sets for select
  using (session_id in (select id from sessions where user_id = auth.uid()));
create policy "Users can insert own sets" on session_sets for insert
  with check (session_id in (select id from sessions where user_id = auth.uid()));
create policy "Users can delete own sets" on session_sets for delete
  using (session_id in (select id from sessions where user_id = auth.uid()));

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
