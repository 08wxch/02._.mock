create or replace function public.has_app_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.user_id = auth.uid())
      or exists (select 1 from public.guest_sessions g where g.user_id = auth.uid() and g.expires_at > now());
$$;
revoke all on function public.has_app_access() from public;
grant execute on function public.has_app_access() to authenticated;

drop policy if exists app_state_read on public.app_state;
create policy app_state_read on public.app_state
  for select to authenticated using (public.has_app_access());
