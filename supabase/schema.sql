-- 02._.mock cloud schema (shared demo phase)
-- Run in Supabase SQL Editor / Management API as the project owner.
create extension if not exists pgcrypto;

create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  teacher_id text,
  student_id text,
  org_id text,
  login_code text,
  login_name text,
  display_name text,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_login_code_key
  on public.profiles (lower(login_code)) where login_code is not null;
create index if not exists profiles_student_idx on public.profiles (student_id);
create index if not exists profiles_teacher_idx on public.profiles (teacher_id);

create table if not exists public.attempts (
  id text primary key,
  exam_id text not null,
  student_id text not null,
  org_id text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists attempts_exam_idx on public.attempts (exam_id);
create index if not exists attempts_student_idx on public.attempts (student_id);
create index if not exists attempts_org_idx on public.attempts (org_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists app_state_set_updated_at on public.app_state;
create trigger app_state_set_updated_at
before insert or update on public.app_state
for each row execute function public.set_updated_at();

drop trigger if exists attempts_set_updated_at on public.attempts;
create trigger attempts_set_updated_at
before insert or update on public.attempts
for each row execute function public.set_updated_at();

create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

create or replace function public.jwt_org()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'org_id', '');
$$;

create or replace function public.jwt_student_id()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'student_id', '');
$$;

create or replace function public.jwt_teacher_id()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'teacher_id', '');
$$;

create or replace function public.resolve_login(p_identifier text)
returns table (email text, role text, display_name text)
language sql
security definer
set search_path = public, auth
as $$
  select u.email::text,
         p.role,
         p.display_name
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where p.login_code is not null
    and (
      lower(p.login_code) = lower(trim(p_identifier))
      or lower(p.login_name) = lower(trim(p_identifier))
    )
  order by case when lower(p.login_code) = lower(trim(p_identifier)) then 0 else 1 end
  limit 1;
$$;
revoke all on function public.resolve_login(text) from public;
grant execute on function public.resolve_login(text) to anon, authenticated;

alter table public.app_state enable row level security;
alter table public.profiles enable row level security;
alter table public.attempts enable row level security;

drop policy if exists app_state_read on public.app_state;
create policy app_state_read on public.app_state
  for select to authenticated using (true);

drop policy if exists app_state_insert_teacher on public.app_state;
create policy app_state_insert_teacher on public.app_state
  for insert to authenticated with check (public.jwt_role() = 'teacher');

drop policy if exists app_state_update_teacher on public.app_state;
create policy app_state_update_teacher on public.app_state
  for update to authenticated
  using (public.jwt_role() = 'teacher')
  with check (public.jwt_role() = 'teacher');

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (user_id = auth.uid() or public.jwt_role() = 'teacher');

drop policy if exists attempts_read on public.attempts;
create policy attempts_read on public.attempts
  for select to authenticated
  using (
    public.jwt_role() = 'teacher'
    or student_id = public.jwt_student_id()
  );

drop policy if exists attempts_insert on public.attempts;
create policy attempts_insert on public.attempts
  for insert to authenticated
  with check (
    public.jwt_role() = 'teacher'
    or student_id = public.jwt_student_id()
  );

drop policy if exists attempts_update on public.attempts;
create policy attempts_update on public.attempts
  for update to authenticated
  using (
    public.jwt_role() = 'teacher'
    or student_id = public.jwt_student_id()
  )
  with check (
    public.jwt_role() = 'teacher'
    or student_id = public.jwt_student_id()
  );

drop policy if exists attempts_delete on public.attempts;
create policy attempts_delete on public.attempts
  for delete to authenticated
  using (public.jwt_role() = 'teacher');

insert into public.app_state (id, data)
values ('main', '{"meta":{"version":7}}'::jsonb)
on conflict (id) do nothing;
