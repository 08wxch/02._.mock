create or replace function public.jwt_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role from public.profiles p where p.user_id = auth.uid()),
    auth.jwt() -> 'app_metadata' ->> 'role',
    ''
  );
$$;

create or replace function public.jwt_org()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.org_id from public.profiles p where p.user_id = auth.uid()),
    auth.jwt() -> 'app_metadata' ->> 'org_id',
    ''
  );
$$;

create or replace function public.jwt_student_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.student_id from public.profiles p where p.user_id = auth.uid()),
    auth.jwt() -> 'app_metadata' ->> 'student_id',
    ''
  );
$$;

create or replace function public.jwt_teacher_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.teacher_id from public.profiles p where p.user_id = auth.uid()),
    auth.jwt() -> 'app_metadata' ->> 'teacher_id',
    ''
  );
$$;

drop policy if exists profiles_insert_teacher on public.profiles;
create policy profiles_insert_teacher on public.profiles
  for insert to authenticated with check (public.jwt_role() = 'teacher');

drop policy if exists profiles_update_teacher on public.profiles;
create policy profiles_update_teacher on public.profiles
  for update to authenticated
  using (public.jwt_role() = 'teacher')
  with check (public.jwt_role() = 'teacher');
