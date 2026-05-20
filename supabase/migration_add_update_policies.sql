-- Allow users to update their own sessions and sets (needed for sets_done/total_volume sync)

create policy "Users can update own sessions" on sessions for update
  using (auth.uid() = user_id);

create policy "Users can update own sets" on session_sets for update
  using (session_id in (select id from sessions where user_id = auth.uid()));
