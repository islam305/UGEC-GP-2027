-- Run once in Supabase SQL Editor as the project owner.
-- Saves notification state per authenticated account; source documents are untouched.
begin;
create table if not exists public.ugec_notification_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id text not null check (length(notification_id) between 1 and 250),
  seen boolean not null default false,
  dismissed boolean not null default false,
  primary key (user_id, notification_id)
);
alter table public.ugec_notification_states enable row level security;
revoke all on public.ugec_notification_states from public, anon, authenticated;
grant select, insert, update on public.ugec_notification_states to authenticated;
drop policy if exists ugec_notification_self_read on public.ugec_notification_states;
create policy ugec_notification_self_read on public.ugec_notification_states
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ugec_notification_self_insert on public.ugec_notification_states;
create policy ugec_notification_self_insert on public.ugec_notification_states
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists ugec_notification_self_update on public.ugec_notification_states;
create policy ugec_notification_self_update on public.ugec_notification_states
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
commit;
