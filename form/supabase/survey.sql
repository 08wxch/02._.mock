-- ===========================================================================
-- 02._.form — Supabase setup
-- ใช้โปรเจกต์เดียวกับ 02._.mock (ระบบบัญชีและรหัสผ่านเดิม)
-- วิธีใช้: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- รันซ้ำได้ปลอดภัย (idempotent)
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ตารางแบบสอบถาม
-- ---------------------------------------------------------------------------
create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null default '',
  title text not null default '',
  description text not null default '',
  questions jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  open_at timestamptz,
  close_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists surveys_owner_idx on public.surveys (owner_id);
create index if not exists surveys_updated_idx on public.surveys (updated_at desc);
create index if not exists surveys_slug_idx on public.surveys (slug);

-- ---------------------------------------------------------------------------
-- ตารางคำตอบ (ไม่ระบุตัวตนผู้ตอบ)
-- ---------------------------------------------------------------------------
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  user_agent text
);

create index if not exists survey_responses_survey_idx
  on public.survey_responses (survey_id, submitted_at desc);

-- ---------------------------------------------------------------------------
-- ผู้ดูแลระบบแบบสอบถาม (ค่าเริ่มต้น: บัญชี Wich Pitchon)
-- ---------------------------------------------------------------------------
create table if not exists public.survey_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_admins enable row level security;

-- ---------------------------------------------------------------------------
-- ฟังก์ชันช่วยตรวจสิทธิ์
-- ---------------------------------------------------------------------------
create or replace function public.survey_is_creator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'teacher'
  );
$$;
revoke all on function public.survey_is_creator() from public;
grant execute on function public.survey_is_creator() to authenticated;

create or replace function public.survey_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.survey_admins a where a.user_id = auth.uid()
  );
$$;
revoke all on function public.survey_is_admin() from public;
grant execute on function public.survey_is_admin() to authenticated;

-- เรียกครั้งแรกหลังติดตั้ง: ถ้ายังไม่มีผู้ดูแลเลย ให้ผู้ที่เข้าสู่ระบบคนแรกเป็นผู้ดูแล
create or replace function public.survey_claim_admin()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if not public.survey_is_creator() then
    return false;
  end if;
  if exists (select 1 from public.survey_admins) then
    return exists (select 1 from public.survey_admins where user_id = auth.uid());
  end if;
  insert into public.survey_admins (user_id) values (auth.uid()) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.survey_claim_admin() from public;
grant execute on function public.survey_claim_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: แบบสอบถาม
-- ---------------------------------------------------------------------------
drop policy if exists surveys_read on public.surveys;
create policy surveys_read on public.surveys
  for select to authenticated
  using (
    public.survey_is_creator()
    and (
      status <> 'draft'
      or owner_id = auth.uid()
      or public.survey_is_admin()
    )
  );

drop policy if exists surveys_insert on public.surveys;
create policy surveys_insert on public.surveys
  for insert to authenticated
  with check (owner_id = auth.uid() and public.survey_is_creator());

drop policy if exists surveys_update on public.surveys;
create policy surveys_update on public.surveys
  for update to authenticated
  using (owner_id = auth.uid() or public.survey_is_admin())
  with check (owner_id = auth.uid() or public.survey_is_admin());

drop policy if exists surveys_delete on public.surveys;
create policy surveys_delete on public.surveys
  for delete to authenticated
  using (owner_id = auth.uid() or public.survey_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: คำตอบ (เจ้าของแบบสอบถามและผู้ดูแลเท่านั้น)
-- ---------------------------------------------------------------------------
drop policy if exists survey_responses_read on public.survey_responses;
create policy survey_responses_read on public.survey_responses
  for select to authenticated
  using (
    public.survey_is_admin()
    or exists (
      select 1 from public.surveys s
      where s.id = survey_responses.survey_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists survey_responses_delete on public.survey_responses;
create policy survey_responses_delete on public.survey_responses
  for delete to authenticated
  using (
    public.survey_is_admin()
    or exists (
      select 1 from public.surveys s
      where s.id = survey_responses.survey_id and s.owner_id = auth.uid()
    )
  );

-- ผู้ใช้ทั่วไปอ่านตารางผู้ดูแลได้เฉพาะแถวของตัวเอง (แอปใช้ RPC ตรวจสิทธิ์)
drop policy if exists survey_admins_read on public.survey_admins;
create policy survey_admins_read on public.survey_admins
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- สิทธิ์ระดับตาราง
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.surveys to authenticated;
grant select, delete on public.survey_responses to authenticated;
grant select on public.survey_admins to authenticated;

-- ---------------------------------------------------------------------------
-- อัปเดตเวลาอัตโนมัติ
-- ---------------------------------------------------------------------------
create or replace function public.survey_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists surveys_touch_updated_at on public.surveys;
create trigger surveys_touch_updated_at
  before update on public.surveys
  for each row execute function public.survey_touch_updated_at();

-- ---------------------------------------------------------------------------
-- รายการแบบสอบถามพร้อมจำนวนคำตอบ (หน้าแดชบอร์ด)
-- ---------------------------------------------------------------------------
create or replace function public.survey_overview()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(payload order by updated_at desc), '[]'::jsonb)
  from (
    select
      s.updated_at,
      jsonb_build_object(
        'id', s.id,
        'slug', s.slug,
        'ownerId', s.owner_id,
        'ownerName', s.owner_name,
        'title', s.title,
        'description', s.description,
        'questions', s.questions,
        'settings', s.settings,
        'status', s.status,
        'openAt', s.open_at,
        'closeAt', s.close_at,
        'createdAt', s.created_at,
        'updatedAt', s.updated_at,
        'responseCount', coalesce(r.total, 0),
        'lastResponseAt', r.last_at
      ) as payload
    from public.surveys s
    left join (
      select survey_id, count(*)::int as total, max(submitted_at) as last_at
      from public.survey_responses
      group by survey_id
    ) r on r.survey_id = s.id
    where public.survey_is_creator()
      and (s.status <> 'draft' or s.owner_id = auth.uid() or public.survey_is_admin())
  ) data;
$$;
revoke all on function public.survey_overview() from public;
grant execute on function public.survey_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- รายชื่อผู้สร้าง (สำหรับตัวกรองและหน้าบัญชี)
-- ---------------------------------------------------------------------------
create or replace function public.survey_people()
returns table (
  user_id uuid,
  teacher_id text,
  name text,
  code text,
  org_id text,
  is_admin boolean,
  form_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.user_id,
    p.teacher_id,
    coalesce(nullif(p.display_name, ''), nullif(p.login_name, ''), nullif(p.login_code, ''), 'ไม่ระบุชื่อ') as name,
    case when public.survey_is_admin() or p.user_id = auth.uid()
      then coalesce(p.login_code, '') else '' end as code,
    coalesce(p.org_id, '') as org_id,
    exists (select 1 from public.survey_admins a where a.user_id = p.user_id) as is_admin,
    (select count(*) from public.surveys s where s.owner_id = p.user_id) as form_count,
    p.created_at
  from public.profiles p
  where p.role = 'teacher'
    and public.survey_is_creator()
  order by 6 desc, 3 asc;
$$;
revoke all on function public.survey_people() from public;
grant execute on function public.survey_people() to authenticated;

-- ---------------------------------------------------------------------------
-- เปิดแบบสอบถามสาธารณะ (ไม่ต้องเข้าสู่ระบบ)
-- ---------------------------------------------------------------------------
create or replace function public.survey_public(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'slug', s.slug,
    'title', s.title,
    'description', s.description,
    'questions', s.questions,
    'settings', s.settings,
    'openAt', s.open_at,
    'closeAt', s.close_at,
    'ownerName', s.owner_name,
    'responseCount', (select count(*)::int from public.survey_responses r where r.survey_id = s.id),
    'state', case
      when s.status = 'closed' then 'closed'
      when s.open_at is not null and now() < s.open_at then 'scheduled'
      when s.close_at is not null and now() > s.close_at then 'closed'
      else 'open'
    end
  )
  from public.surveys s
  where s.slug = lower(trim(p_slug))
    and s.status in ('published', 'closed');
$$;
revoke all on function public.survey_public(text) from public;
grant execute on function public.survey_public(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ส่งคำตอบ (ตรวจข้อบังคับและช่วงเวลาให้ที่เซิร์ฟเวอร์)
-- ---------------------------------------------------------------------------
create or replace function public.survey_submit(p_slug text, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  form public.surveys;
  q jsonb;
  value jsonb;
  missing text;
  cleaned jsonb := '{}'::jsonb;
  total integer;
begin
  select * into form
  from public.surveys
  where slug = lower(trim(p_slug))
  limit 1;

  if form.id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if form.status = 'draft' then
    return jsonb_build_object('error', 'not_found');
  end if;
  if form.status = 'closed' then
    return jsonb_build_object('error', 'closed');
  end if;
  if form.open_at is not null and now() < form.open_at then
    return jsonb_build_object('error', 'not_open');
  end if;
  if form.close_at is not null and now() > form.close_at then
    return jsonb_build_object('error', 'closed');
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    return jsonb_build_object('error', 'invalid_answers');
  end if;
  if length(p_answers::text) > 262144 then
    return jsonb_build_object('error', 'answers_too_large');
  end if;

  for q in select * from jsonb_array_elements(form.questions) loop
    value := p_answers -> (q ->> 'id');
    if coalesce((q ->> 'required')::boolean, false) then
      missing := q ->> 'title';
      if value is null
         or value = 'null'::jsonb
         or (jsonb_typeof(value) = 'string' and btrim(value #>> '{}') = '')
         or (jsonb_typeof(value) = 'array' and jsonb_array_length(value) = 0) then
        return jsonb_build_object('error', 'required', 'question', missing);
      end if;
    end if;
    if value is not null and value <> 'null'::jsonb then
      if jsonb_typeof(value) = 'string' and length(value #>> '{}') > 10000 then
        value := to_jsonb(left(value #>> '{}', 10000));
      end if;
      cleaned := cleaned || jsonb_build_object(q ->> 'id', value);
    end if;
  end loop;

  select count(*) into total from jsonb_object_keys(cleaned);
  if total > 500 then
    return jsonb_build_object('error', 'too_many_answers');
  end if;

  insert into public.survey_responses (survey_id, answers)
  values (form.id, cleaned);

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.survey_submit(text, jsonb) from public;
grant execute on function public.survey_submit(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ตั้งผู้ดูแลเริ่มต้นให้บัญชี Wich Pitchon (ถ้ามีโปรไฟล์อยู่แล้ว)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.profiles') is not null then
    insert into public.survey_admins (user_id)
    select p.user_id
    from public.profiles p
    where p.role = 'teacher'
      and (
        lower(coalesce(p.login_name, '')) like '%wich%'
        or lower(coalesce(p.display_name, '')) like '%wich%'
        or lower(coalesce(p.login_code, '')) like '%wich%'
      )
    on conflict do nothing;
  end if;
end $$;

-- ตรวจผลหลังติดตั้ง
select
  (select count(*) from public.surveys) as surveys,
  (select count(*) from public.survey_responses) as responses,
  (select count(*) from public.survey_admins) as admins;
