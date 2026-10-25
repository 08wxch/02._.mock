-- Public exam-code lookup used by the student login screen.
-- Returns only the minimum exam/roster data needed to show the name picker.
-- The roster is returned only while the exam is open, and never includes
-- passwords or question content.
create or replace function public.public_exam_by_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_exam jsonb;
  v_roster jsonb := '[]'::jsonb;
begin
  select data into v_state from public.app_state where id = 'main';
  if v_state is null then
    return null;
  end if;

  select value into v_exam
  from jsonb_array_elements(coalesce(v_state->'exams', '[]'::jsonb)) value
  where value->>'code' = p_code
  limit 1;

  if v_exam is null then
    return null;
  end if;

  if coalesce(v_exam->>'status', '') = 'open' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s->>'id',
      'name', s->>'name',
      'code', s->>'code',
      'orgId', s->>'orgId',
      'classIds', coalesce(s->'classIds', '[]'::jsonb),
      'class', coalesce(s->>'class', ''),
      'classLabel', (
        select string_agg(c->>'code', ', ')
        from jsonb_array_elements_text(coalesce(s->'classIds', '[]'::jsonb)) cid
        join jsonb_array_elements(coalesce(v_state->'classes', '[]'::jsonb)) c
          on c->>'id' = cid
      )
    ) order by s->>'name'), '[]'::jsonb)
    into v_roster
    from jsonb_array_elements(coalesce(v_state->'students', '[]'::jsonb)) s
    where jsonb_typeof(v_exam->'assignedStudentIds') <> 'array'
       or (v_exam->'assignedStudentIds') ? (s->>'id');
  end if;

  return jsonb_build_object(
    'id', v_exam->>'id',
    'code', v_exam->>'code',
    'title', v_exam->>'title',
    'status', coalesce(v_exam->>'status', ''),
    'openAt', v_exam->>'openAt',
    'closeAt', v_exam->>'closeAt',
    'duration', coalesce((v_exam->>'duration')::int, 0),
    'totalPoints', coalesce((v_exam->>'totalPoints')::numeric, 0),
    'questionCount', coalesce(jsonb_array_length(v_exam->'questions'), 0),
    'roster', v_roster
  );
end;
$$;

revoke all on function public.public_exam_by_code(text) from public;
grant execute on function public.public_exam_by_code(text) to anon, authenticated;
