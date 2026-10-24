create table if not exists public.credentials (
  owner_type text not null check (owner_type in ('teacher','student')),
  owner_id text not null,
  password text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_type, owner_id)
);

alter table public.credentials enable row level security;
drop policy if exists credentials_teacher_all on public.credentials;
create policy credentials_teacher_all on public.credentials
  for all to authenticated
  using (public.jwt_role() = 'teacher')
  with check (public.jwt_role() = 'teacher');
