-- ===========================================================================
-- 02._.mock — account cleanup
-- ใช้เมื่อลบบัญชีครู/นักเรียน เพื่อลบ credentials, profile และ auth user
-- ที่เกี่ยวข้อง ไม่ให้เหลือข้อมูลค้างในฐานข้อมูล
--
-- วิธีใช้: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- รันซ้ำได้ปลอดภัย (idempotent)
-- ===========================================================================

create or replace function public.delete_app_account(p_role text, p_person_id text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor public.profiles;
  v_target public.profiles;
  v_actor_teacher jsonb;
  v_target_teacher jsonb;
  v_owner boolean;
  v_manager boolean;
  v_same_org boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_role not in ('teacher', 'student')
     or p_person_id is null
     or trim(p_person_id) = '' then
    raise exception 'invalid account';
  end if;

  select * into v_actor
  from public.profiles
  where user_id = auth.uid();

  if v_actor.user_id is null or v_actor.role <> 'teacher' then
    raise exception 'not allowed';
  end if;

  select * into v_target
  from public.profiles
  where (p_role = 'teacher' and teacher_id = p_person_id)
     or (p_role = 'student' and student_id = p_person_id)
  limit 1;

  if v_target.user_id is null then
    return false;
  end if;
  if v_target.user_id = auth.uid() then
    raise exception 'cannot delete self';
  end if;

  select t.value into v_actor_teacher
  from public.app_state s,
       lateral jsonb_array_elements(coalesce(s.data -> 'teachers', '[]'::jsonb)) t(value)
  where s.id = 'main'
    and t.value ->> 'id' = v_actor.teacher_id
  limit 1;

  v_owner := coalesce((v_actor_teacher ->> 'isOwner')::boolean, false);
  v_manager := coalesce(v_actor_teacher ->> 'staffRole', '') = 'manager';
  v_same_org := v_actor.org_id is not null and v_actor.org_id = v_target.org_id;

  if v_target.role = 'teacher' then
    select t.value into v_target_teacher
    from public.app_state s,
         lateral jsonb_array_elements(coalesce(s.data -> 'teachers', '[]'::jsonb)) t(value)
    where s.id = 'main'
      and t.value ->> 'id' = v_target.teacher_id
    limit 1;

    if coalesce((v_target_teacher ->> 'isOwner')::boolean, false) then
      raise exception 'cannot delete owner';
    end if;
  end if;

  if not v_owner and not (v_manager and v_same_org) then
    raise exception 'not allowed';
  end if;
  if not v_owner
     and p_role = 'teacher'
     and coalesce(v_target_teacher ->> 'staffRole', 'teacher') <> 'teacher' then
    raise exception 'not allowed';
  end if;

  delete from public.credentials
  where owner_type = p_role and owner_id = p_person_id;

  -- Prefer deleting the Supabase Auth user so the login is gone completely.
  -- If the SQL role cannot touch auth.users, still remove the profile row.
  begin
    delete from auth.users where id = v_target.user_id;
  exception when others then
    delete from public.profiles where user_id = v_target.user_id;
  end;

  return true;
end;
$$;

revoke all on function public.delete_app_account(text, text) from public;
grant execute on function public.delete_app_account(text, text) to authenticated;

select 'delete_app_account' as function, true as installed;
