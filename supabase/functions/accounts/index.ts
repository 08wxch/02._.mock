import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

function clean(value: unknown, max = 120) {
  return String(value ?? '').trim().slice(0, max);
}

function emailFor(role: string, id: string) {
  return `${role}.${id.replace(/[^A-Za-z0-9_-]/g, '')}@example.com`;
}

async function authUserByEmail(email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users || []).find(user => String(user.email || '').toLowerCase() === email.toLowerCase()) || null;
}

async function upsertAccount(person: any, caller: any) {
  const role = person.role === 'teacher' ? 'teacher' : 'student';
  const id = clean(person.id, 100);
  if (!id) throw new Error('missing id');
  const orgId = clean(person.orgId || caller.org_id || '', 100);
  if (!caller.is_owner && orgId !== caller.org_id) throw new Error('organization mismatch');
  const code = clean(person.code, 64);
  const name = clean(person.name, 160);
  if (!code || !name) throw new Error('missing code/name');
  const email = emailFor(role, id);
  const column = role === 'teacher' ? 'teacher_id' : 'student_id';

  const { data: existingProfile, error: profileError } = await admin
    .from('profiles')
    .select('user_id, role, org_id')
    .eq(column, id)
    .maybeSingle();
  if (profileError) throw profileError;

  let userId: string | null = existingProfile?.user_id || null;
  if (!userId) {
    const { data: byEmail } = await admin.from('profiles').select('user_id').eq('login_code', code).maybeSingle();
    if (byEmail?.user_id) userId = byEmail.user_id;
  }

  const password = clean(person.password, 128);
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email,
      password: password.length >= 4 ? password : '123456',
      email_confirm: true,
      user_metadata: { role, app_id: id }
    });
    if (created.error || !created.data.user) {
      const existing = await authUserByEmail(email);
      if (!existing) throw created.error || new Error('cannot create auth user');
      userId = existing.id;
      if (password.length >= 4) {
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        if (error) throw error;
      }
    } else {
      userId = created.data.user.id;
    }
  } else if (password.length >= 4) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    role,
    teacher_id: role === 'teacher' ? id : null,
    student_id: role === 'student' ? id : null,
    org_id: orgId,
    login_code: code,
    login_name: name,
    display_name: name
  };
  const { error: upsertError } = await admin.from('profiles').upsert(row, { onConflict: 'user_id' });
  if (upsertError) throw upsertError;
  return { id, role, email, user_id: userId };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'missing session' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) return json({ error: 'invalid session' }, 401);

    const { data: callerProfile, error: callerError } = await admin
      .from('profiles')
      .select('role, teacher_id, student_id, org_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (callerError || !callerProfile || callerProfile.role !== 'teacher') {
      return json({ error: 'teacher account required' }, 403);
    }

    const { data: state } = await admin.from('app_state').select('data').eq('id', 'main').maybeSingle();
    const callerTeacher = (state?.data?.teachers || []).find((t: any) => t.id === callerProfile.teacher_id);
    const caller = { ...callerProfile, is_owner: Boolean(callerTeacher?.isOwner) };

    const body = await req.json().catch(() => ({}));
    if (body.action === 'sync') {
      const people = Array.isArray(body.people) ? body.people.slice(0, 100) : [];
      const results = [];
      for (const person of people) {
        try {
          results.push({ ok: true, ...(await upsertAccount(person, caller)) });
        } catch (err) {
          results.push({ ok: false, id: person?.id, error: String((err as Error)?.message || err) });
        }
      }
      return json({ ok: results.every(r => r.ok), results });
    }

    if (body.action === 'password') {
      const role = body.role === 'teacher' ? 'teacher' : 'student';
      const id = clean(body.id, 100);
      const password = clean(body.password, 128);
      if (password.length < 4) return json({ error: 'password too short' }, 400);
      const isSelf = role === 'teacher'
        ? callerProfile.teacher_id === id
        : callerProfile.student_id === id;
      const column = role === 'teacher' ? 'teacher_id' : 'student_id';
      const { data: profile } = await admin.from('profiles').select('user_id, org_id').eq(column, id).maybeSingle();
      if (!profile?.user_id) return json({ error: 'account not provisioned' }, 404);
      if (!isSelf && !caller.is_owner && profile.org_id !== caller.org_id) {
        return json({ error: 'forbidden' }, 403);
      }
      const { error } = await admin.auth.admin.updateUserById(profile.user_id, { password });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (err) {
    console.error('accounts function error', err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
