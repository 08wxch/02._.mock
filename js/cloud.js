// Supabase cloud adapter for 02._.mock.
// The anon key is public by design; all access is guarded by RLS.
const SUPABASE_URL = 'https://hqpbvxmrolxhuexzzxgo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxcGJ2eG1yb2x4aHVleHp6eGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3Nzc0NjMsImV4cCI6MjEwODM1MzQ2M30.HsBV5_KXdWadINtL17tIIgiHLbi28t_nU6jsJ1qoDD8';
const ACCOUNTS_URL = `${SUPABASE_URL}/functions/v1/accounts`;

let client = null;
let current = null;
let ready = false;
let lastStamp = '';
let lastAttempts = new Map();
let lastCredentials = new Map();
let lastStateCounts = { students: 0, exams: 0 };
let lastPeople = new Map();
let saveQueue = Promise.resolve();
let saveCount = 0;
let lastLocalSaveAt = 0;

function getClient() {
  if (!client && typeof window !== 'undefined' && window.supabase?.createClient) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'examio_cloud_auth_v1'
      }
    });
  }
  if (!client) throw new Error('ยังเชื่อมต่อฐานข้อมูลกลางไม่ได้');
  return client;
}


function countsOf(db) {
  return {
    students: Array.isArray(db?.students) ? db.students.length : 0,
    exams: Array.isArray(db?.exams) ? db.exams.length : 0
  };
}

// A partial local snapshot (for example after a failed refresh or a newly
// created org) must never be allowed to erase the central roster/exams.
function isDangerousShrink(next, previous) {
  if (!previous) return false;
  if (previous.students >= 10 && next.students < Math.max(5, Math.floor(previous.students * 0.5))) return true;
  if (previous.exams >= 3 && next.exams < Math.max(2, Math.floor(previous.exams * 0.5))) return true;
  return false;
}

function classIdsOf(student) {
  if (!student) return [];
  if (Array.isArray(student.classIds) && student.classIds.length) {
    return [...new Set(student.classIds.filter(Boolean))];
  }
  return student.classId ? [student.classId] : [];
}

function classLabel(student, db) {
  const codes = classIdsOf(student)
    .map(id => (db.classes || []).find(cls => cls.id === id)?.code)
    .filter(Boolean);
  return codes.join(', ') || student?.class || 'ไม่ระบุ class';
}

function toLocalSession(profile, db) {
  if (!profile) return null;
  if (profile.role === 'teacher') {
    const teacher = (db.teachers || []).find(t => t.id === profile.teacher_id && !t.deletedAt);
    if (!teacher) return null;
    const org = (db.organizations || []).find(o => o.id === (profile.org_id || teacher.orgId));
    return {
      role: 'teacher',
      teacherId: teacher.id,
      name: profile.display_name || teacher.name,
      teacherCode: profile.login_code || teacher.code,
      school: teacher.school || org?.name || '',
      orgId: profile.org_id || teacher.orgId,
      staffRole: teacher.staffRole,
      loginMethod: 'account'
    };
  }
  const student = (db.students || []).find(s => s.id === profile.student_id && !s.deletedAt);
  if (!student) return null;
  return {
    role: 'student',
    studentId: student.id,
    name: profile.display_name || student.name,
    studentCode: profile.login_code || student.code,
    class: classLabel(student, db),
    orgId: profile.org_id || student.orgId,
    loginMethod: profile.guest ? 'code' : 'account'
  };
}


function personSignature(person, role) {
  return [role, person.id, person.code || '', person.name || '', person.orgId || '', person.password || ''].join('|');
}

function peopleFromDB(db) {
  return [
    ...(db.teachers || []).filter(p => !p.deletedAt).map(person => ({ person, role: 'teacher' })),
    ...(db.students || []).filter(p => !p.deletedAt).map(person => ({ person, role: 'student' }))
  ];
}

async function callAccounts(payload) {
  const supa = getClient();
  const { data: { session } } = await supa.auth.getSession();
  if (!session?.access_token) throw new Error('ไม่พบ session สำหรับจัดการบัญชี');
  const response = await fetch(ACCOUNTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'จัดการบัญชีเข้าสู่ระบบไม่สำเร็จ');
  return body;
}

async function syncAccounts(people) {
  if (!people.length) return;
  const body = await callAccounts({
    action: 'sync',
    people: people.map(({ person, role }) => ({
      role,
      id: person.id,
      code: person.code,
      name: person.name,
      orgId: person.orgId,
      password: person.password
    }))
  });
  const failed = (body.results || []).filter(r => !r.ok);
  if (failed.length) throw new Error(failed[0].error || 'สร้างบัญชีเข้าสู่ระบบไม่สำเร็จ');
}

function rememberPeople(db) {
  lastPeople = new Map(peopleFromDB(db).map(({ person, role }) => [`${role}:${person.id}`, personSignature(person, role)]));
}

async function loadCloudDB() {
  const supa = getClient();
  const [stateResult, attemptsResult] = await Promise.all([
    supa.from('app_state').select('data,updated_at').eq('id', 'main').maybeSingle(),
    supa.from('attempts').select('data').order('updated_at', { ascending: true })
  ]);
  if (stateResult.error) throw stateResult.error;
  if (attemptsResult.error) throw attemptsResult.error;
  if (!stateResult.data?.data) throw new Error('ยังไม่พบข้อมูลในฐานข้อมูลกลาง');

  const db = stateResult.data.data;
  db.attempts = (attemptsResult.data || []).map(row => row.data).filter(Boolean);
  lastAttempts = new Map(db.attempts.map(a => [a.id, JSON.stringify(a)]));
  lastStamp = stateResult.data.updated_at || '';
  lastStateCounts = countsOf(db);

  if (current?.role === 'teacher') {
    const credResult = await supa.from('credentials').select('owner_type,owner_id,password');
    if (!credResult.error) {
      lastCredentials = new Map((credResult.data || []).map(row => [`${row.owner_type}:${row.owner_id}`, row.password]));
      for (const person of [...(db.teachers || []), ...(db.students || [])]) {
        person.password = lastCredentials.get(`${person.id.startsWith('teacher_') ? 'teacher' : 'student'}:${person.id}`) || person.password;
      }
    }
  }
  rememberPeople(db);
  ready = true;
  return db;
}

async function profileFor(userId) {
  const supa = getClient();
  const { data, error } = await supa.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function guestFor(userId) {
  const supa = getClient();
  const { data, error } = await supa.from('guest_sessions')
    .select('student_id,exam_id,org_id,expires_at')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function isCloudEnabled() {
  return Boolean(window.supabase?.createClient);
}

export function isCloudReady() {
  return ready;
}

export async function cloudRestore() {
  if (!isCloudEnabled()) return null;
  const supa = getClient();
  const { data: { session }, error } = await supa.auth.getSession();
  if (error) throw error;
  if (!session?.user) return null;

  if (session.user.is_anonymous) {
    const guest = await guestFor(session.user.id);
    if (!guest) {
      await supa.auth.signOut();
      return null;
    }
    const profile = {
      role: 'student',
      student_id: guest.student_id,
      org_id: guest.org_id,
      display_name: null,
      login_code: null,
      guest: true
    };
    current = profile;
    const db = await loadCloudDB();
    const local = toLocalSession(profile, db);
    if (!local) {
      await supa.auth.signOut();
      return null;
    }
    return { session: local, db, guest: true };
  }

  const profile = await profileFor(session.user.id);
  if (!profile) {
    await supa.auth.signOut();
    return null;
  }
  current = profile;
  const db = await loadCloudDB();
  const local = toLocalSession(profile, db);
  if (!local) {
    await supa.auth.signOut();
    return null;
  }
  return { session: local, db, guest: false };
}

export async function cloudLogin(identifier, password) {
  if (!isCloudEnabled()) return { ok: false, error: 'ยังเชื่อมต่อฐานข้อมูลกลางไม่ได้' };
  const supa = getClient();
  const { data: rows, error: lookupError } = await supa.rpc('resolve_login', { p_identifier: identifier });
  if (lookupError) return { ok: false, error: 'เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่' };
  if (!Array.isArray(rows) || !rows.length) {
    return { ok: false, error: 'รหัสหรือชื่อผู้ใช้ไม่ถูกต้อง' };
  }
  const account = rows[0];
  const { data: authData, error: authError } = await supa.auth.signInWithPassword({
    email: account.email,
    password
  });
  if (authError || !authData?.session) {
    return { ok: false, error: 'รหัสผ่านไม่ถูกต้อง' };
  }
  const profile = await profileFor(authData.session.user.id);
  if (!profile) {
    await supa.auth.signOut();
    return { ok: false, error: 'บัญชีนี้ยังไม่ผูกกับข้อมูลโรงเรียน' };
  }
  current = profile;
  const db = await loadCloudDB();
  const local = toLocalSession(profile, db);
  if (!local) {
    await supa.auth.signOut();
    return { ok: false, error: 'ไม่พบข้อมูลผู้ใช้นี้ในระบบ' };
  }
  return { ok: true, session: local, db };
}

export async function cloudLookupExam(code) {
  if (!isCloudEnabled()) return null;
  try {
    const supa = getClient();
    const { data, error } = await supa.rpc('public_exam_by_code', { p_code: String(code || '').trim() });
    if (error) return null;
    return data || null;
  } catch (err) {
    console.warn('Public exam lookup failed', err);
    return null;
  }
}

export async function cloudGuestLogin(examId, studentId) {
  if (!isCloudEnabled()) return { ok: false, error: 'ยังเชื่อมต่อฐานข้อมูลกลางไม่ได้' };
  const supa = getClient();
  let { data: { session } } = await supa.auth.getSession();
  if (session?.user && !session.user.is_anonymous) {
    return { ok: false, error: 'บัญชีนี้เข้าสู่ระบบอยู่แล้ว กรุณาออกจากระบบก่อนใช้รหัสเข้าสอบ' };
  }
  if (!session?.user) {
    const { data, error } = await supa.auth.signInAnonymously();
    if (error || !data?.session) {
      return { ok: false, error: 'เปิดโหมดผู้เข้าสอบไม่สำเร็จ กรุณาเข้าสู่ระบบด้วยบัญชีนักเรียน' };
    }
    session = data.session;
  }
  const { error: claimError } = await supa.rpc('claim_guest', {
    p_exam_id: examId,
    p_student_id: studentId
  });
  if (claimError) {
    return { ok: false, error: claimError.message || 'ยืนยันสิทธิ์เข้าสอบไม่สำเร็จ' };
  }
  current = { role: 'student', student_id: studentId, guest: true };
  const db = await loadCloudDB();
  const student = (db.students || []).find(s => s.id === studentId);
  if (!student) return { ok: false, error: 'ไม่พบข้อมูลนักเรียน' };
  const profile = {
    role: 'student',
    student_id: student.id,
    org_id: student.orgId,
    display_name: student.name,
    login_code: student.code,
    guest: true
  };
  current = profile;
  return {
    ok: true,
    session: {
      role: 'student',
      studentId: student.id,
      name: student.name,
      studentCode: student.code,
      class: classLabel(student, db),
      orgId: student.orgId,
      loginMethod: 'code',
      examId
    },
    db
  };
}

function cleanState(db) {
  const state = { ...db };
  delete state.attempts;
  state.teachers = (state.teachers || []).map(t => {
    const next = { ...t };
    delete next.password;
    return next;
  });
  state.students = (state.students || []).map(s => {
    const next = { ...s };
    delete next.password;
    return next;
  });
  return state;
}

function attemptRow(attempt) {
  return {
    id: attempt.id,
    exam_id: attempt.examId || '',
    student_id: attempt.studentId || '',
    org_id: attempt.orgId || '',
    data: attempt
  };
}

async function persistSnapshot(state, attempts) {
  const supa = getClient();
  const nextMap = new Map(attempts.map(a => [a.id, JSON.stringify(a)]));
  lastLocalSaveAt = Date.now();

  if (current?.role === 'teacher') {
    const incoming = countsOf(state);
    if (isDangerousShrink(incoming, lastStateCounts)) {
      throw new Error('ปฏิเสธการบันทึก: ข้อมูลนักเรียนหรือชุดสอบลดลงผิดปกติ');
    }
    const { error } = await supa.from('app_state').upsert({ id: 'main', data: cleanState(state) });
    if (error) throw error;
    lastStateCounts = incoming;
    const credentialRows = [
      ...(state.teachers || []).filter(t => t.password).map(t => ({ owner_type: 'teacher', owner_id: t.id, password: t.password })),
      ...(state.students || []).filter(s => s.password).map(s => ({ owner_type: 'student', owner_id: s.id, password: s.password }))
    ];
    if (credentialRows.length) {
      const { error: credError } = await supa.from('credentials').upsert(credentialRows);
      if (credError) throw credError;
    }

    const changedPeople = peopleFromDB(state).filter(({ person, role }) => {
      const key = `${role}:${person.id}`;
      return lastPeople.get(key) !== personSignature(person, role);
    });
    let accountsOk = true;
    if (changedPeople.length) {
      try {
        await syncAccounts(changedPeople);
      } catch (err) {
        accountsOk = false;
        console.error('Account provisioning failed', err);
        window.dispatchEvent(new CustomEvent('examio:cloud-error', {
          detail: { message: err?.message || 'สร้างบัญชีเข้าสู่ระบบไม่สำเร็จ' }
        }));
      }
    }
    if (accountsOk) rememberPeople(state);
  }

  const changed = attempts.filter(a => lastAttempts.get(a.id) !== nextMap.get(a.id));
  // Never mass-delete attempts when the local snapshot has no exams; that is
  // almost always a partially loaded state, not a teacher deleting everything.
  const removed = (state.exams || []).length === 0
    ? []
    : [...lastAttempts.keys()].filter(id => !nextMap.has(id));

  if (changed.length) {
    const { error } = await supa.from('attempts').upsert(changed.map(attemptRow));
    if (error) throw error;
  }
  if (removed.length && current?.role === 'teacher') {
    const { error } = await supa.from('attempts').delete().in('id', removed);
    if (error) throw error;
  }
  lastAttempts = nextMap;
}

export async function cloudGetPassword(role, id) {
  if (!ready || !current) return { ok: false, error: 'ยังเชื่อมต่อฐานข้อมูลกลางไม่ได้' };
  try {
    const body = await callAccounts({ action: 'reveal', role, id });
    const password = String(body.password || '');
    if (!password) return { ok: false, error: 'ไม่พบรหัสผ่านของบัญชีนี้' };
    return { ok: true, password };
  } catch (err) {
    return { ok: false, error: err?.message || 'ดูรหัสผ่านไม่สำเร็จ' };
  }
}

const QUESTION_IMAGE_BUCKET = 'question-images';

function imageExtension(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpg';
  return 'webp';
}

export async function cloudUploadQuestionImage(blob) {
  if (!ready || !current) return { ok: false, error: 'ยังเชื่อมต่อฐานข้อมูลกลางไม่ได้' };
  if (current.role !== 'teacher') return { ok: false, error: 'เฉพาะครูเท่านั้นที่อัปโหลดภาพโจทย์ได้' };
  if (!blob || !blob.size) return { ok: false, error: 'ไม่พบไฟล์รูปภาพ' };
  if (blob.size > 5 * 1024 * 1024) return { ok: false, error: 'รูปภาพต้องมีขนาดไม่เกิน 5 MB' };
  const type = blob.type || 'image/jpeg';
  const teacherKey = String(current.teacher_id || current.teacherId || 'teacher').replace(/[^A-Za-z0-9_-]/g, '');
  const path = `questions/${teacherKey}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${imageExtension(type)}`;
  try {
    const supa = getClient();
    const { error } = await supa.storage.from(QUESTION_IMAGE_BUCKET).upload(path, blob, {
      contentType: type,
      cacheControl: '31536000',
      upsert: false
    });
    if (error) throw error;
    const { data } = supa.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl, path };
  } catch (err) {
    return { ok: false, error: err?.message || 'อัปโหลดรูปภาพไม่สำเร็จ' };
  }
}

export async function cloudDeleteQuestionImage(path) {
  if (!ready || !current || current.role !== 'teacher' || !path) return;
  try {
    const supa = getClient();
    await supa.storage.from(QUESTION_IMAGE_BUCKET).remove([path]);
  } catch (err) {
    console.warn('Could not remove question image', err);
  }
}

export async function cloudSetPassword(role, id, password) {
  if (!ready || !current) return { ok: false, error: 'ยังเชื่อมต่อฐานข้อมูลกลางไม่ได้' };
  const next = String(password || '');
  if (next.length < 4) return { ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' };
  try {
    const body = await callAccounts({ action: 'password', role, id, password: next });
    return body.ok === false ? { ok: false, error: body.error } : { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'อัปเดตรหัสผ่านบนคลาวด์ไม่สำเร็จ' };
  }
}

export function cloudSave(db) {
  if (!ready || !current) return Promise.resolve();
  saveCount += 1;
  const state = JSON.parse(JSON.stringify(db));
  const attempts = JSON.parse(JSON.stringify(db.attempts || []));
  saveQueue = saveQueue.then(() => persistSnapshot(state, attempts)).catch(err => {
    console.error('Cloud save failed', err);
    window.dispatchEvent(new CustomEvent('examio:cloud-error', {
      detail: { message: 'บันทึกขึ้นคลาวด์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต' }
    }));
  }).finally(() => {
    saveCount -= 1;
  });
  return saveQueue;
}

export async function cloudRefresh() {
  if (!ready || !current) return null;
  if (saveCount > 0) return null;
  if (Date.now() - lastLocalSaveAt < 1200) return null;
  const supa = getClient();
  const [stateResult, attemptsResult] = await Promise.all([
    supa.from('app_state').select('data,updated_at').eq('id', 'main').maybeSingle(),
    supa.from('attempts').select('data').order('updated_at', { ascending: true })
  ]);
  if (stateResult.error || attemptsResult.error || !stateResult.data?.data) return null;

  const rows = attemptsResult.data || [];
  const nextMap = new Map(rows.map(row => [row.data?.id, JSON.stringify(row.data)]));
  const stamp = stateResult.data.updated_at || '';
  const attemptsChanged = nextMap.size !== lastAttempts.size
    || [...nextMap.entries()].some(([id, raw]) => lastAttempts.get(id) !== raw);

  if (stamp === lastStamp && !attemptsChanged) return null;

  const db = stateResult.data.data;
  const incoming = countsOf(db);
  if (isDangerousShrink(incoming, lastStateCounts)) {
    console.warn('Rejected partial cloud snapshot', incoming, lastStateCounts);
    window.dispatchEvent(new CustomEvent('examio:cloud-error', {
      detail: { message: 'พบข้อมูลกลางผิดปกติ จึงยังใช้ข้อมูลในเครื่องก่อน' }
    }));
    return null;
  }
  db.attempts = rows.map(row => row.data).filter(Boolean);
  lastAttempts = nextMap;
  lastStamp = stamp;
  lastStateCounts = incoming;
  rememberPeople(db);
  return db;
}

export async function cloudLogout() {
  ready = false;
  current = null;
  lastStamp = '';
  lastAttempts = new Map();
  lastCredentials = new Map();
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch (err) {
    console.warn('Cloud sign out failed', err);
  }
}
