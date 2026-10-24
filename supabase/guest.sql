-- Guest exam-code access: an anonymous Supabase user is linked to one student
-- for a single exam session. No password is required for the code flow.
create table if not exists public.guest_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  student_id text not null,
  exam_id text,
  org_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 hours')
);

alter table public.guest_sessions enable row level security;

drop policy if exists guest_sessions_self_read on public.guest_sessions;
create policy guest_sessions_self_read on public.guest_sessions
  for select to authenticated using (user_id = auth.uid());

create or replace function public.current_student_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.student_id from public.profiles p where p.user_id = auth.uid()),
    (select g.student_id from public.guest_sessions g
      where g.user_id = auth.uid() and g.expires_at > now())
  );
$$;
revoke all on function public.current_student_id() from public;
grant execute on function public.current_student_id() to authenticated;

create or replace function public.claim_guest(p_exam_id text, p_student_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_student jsonb;
  v_exam jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select data into v_state from public.app_state where id = 'main';
  if v_state is null then
    raise exception 'app state not ready';
  end if;

  select value into v_student
  from jsonb_array_elements(coalesce(v_state->'students', '[]'::jsonb))
  where value->>'id' = p_student_id
  limit 1;
  if v_student is null then
    raise exception 'student not found';
  end if;

  select value into v_exam
  from jsonb_array_elements(coalesce(v_state->'exams', '[]'::jsonb))
  where value->>'id' = p_exam_id
  limit 1;
  if v_exam is null then
    raise exception 'exam not found';
  end if;
  if coalesce(v_exam->>'status', '') <> 'open' then
    raise exception 'exam not open';
  end if;

  if jsonb_typeof(v_exam->'assignedStudentIds') = 'array'
     and not (v_exam->'assignedStudentIds' ? p_student_id) then
    raise exception 'student not assigned';
  end if;

  insert into public.guest_sessions (user_id, student_id, exam_id, org_id, created_at, expires_at)
  values (auth.uid(), p_student_id, p_exam_id, v_student->>'orgId', now(), now() + interval '8 hours')
  on conflict (user_id) do update
    set student_id = excluded.student_id,
        exam_id = excluded.exam_id,
        org_id = excluded.org_id,
        created_at = now(),
        expires_at = now() + interval '8 hours';
end;
$$;
revoke all on function public.claim_guest(text, text) from public;
grant execute on function public.claim_guest(text, text) to authenticated;

drop policy if exists attempts_read on public.attempts;
create policy attempts_read on public.attempts
  for select to authenticated
  using (
    public.jwt_role() = 'teacher'
    or student_id = public.current_student_id()
  );

drop policy if exists attempts_insert on public.attempts;
create policy attempts_insert on public.attempts
  for insert to authenticated
  with check (
    public.jwt_role() = 'teacher'
    or student_id = public.current_student_id()
  );

drop policy if exists attempts_update on public.attempts;
create policy attempts_update on public.attempts
  for update to authenticated
  using (
    public.jwt_role() = 'teacher'
    or student_id = public.current_student_id()
  )
  with check (
    public.jwt_role() = 'teacher'
    or student_id = public.current_student_id()
  );

drop policy if exists attempts_delete on public.attempts;
create policy attempts_delete on public.attempts
  for delete to authenticated
  using (public.jwt_role() = 'teacher');
