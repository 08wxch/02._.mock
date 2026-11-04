import {
  SUPABASE_URL, SUPABASE_ANON_KEY, ACCOUNTS_URL,
  LOCAL_MODE, SESSION_KEY, LOCAL_DB_KEY, OWNER_NAME
} from './config.js';
import { randomSlug, uid } from './utils.js';

let client = null;

function supa() {
  if (!client) {
    if (!window.supabase?.createClient) throw new Error('โหลดไลบรารี Supabase ไม่สำเร็จ');
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'formio_auth_v1'
      }
    });
  }
  return client;
}

function withTimeout(promise, ms = 20_000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่')), ms))
  ]);
}

function friendlyError(error, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่') {
  const message = String(error?.message || error || '');
  if (!message) return new Error(fallback);
  if (/relation .* does not exist|Could not find the table|schema cache/i.test(message)) {
    return new Error('ฐานข้อมูลยังไม่พร้อมใช้งาน — กรุณารันไฟล์ SQL ตั้งค่าก่อน');
  }
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) {
    return new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต');
  }
  if (/Invalid login credentials/i.test(message)) return new Error('รหัสผ่านไม่ถูกต้อง');
  if (/JWT|session/i.test(message)) return new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  return new Error(message);
}

function mapForm(row = {}) {
  return {
    id: row.id,
    slug: row.slug,
    ownerId: row.ownerId ?? row.owner_id,
    ownerName: row.ownerName ?? row.owner_name ?? '',
    title: row.title ?? '',
    description: row.description ?? '',
    questions: Array.isArray(row.questions) ? row.questions : [],
    settings: row.settings || {},
    status: row.status || 'draft',
    openAt: row.openAt ?? row.open_at ?? null,
    closeAt: row.closeAt ?? row.close_at ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
    responseCount: Number(row.responseCount ?? row.response_count ?? 0),
    lastResponseAt: row.lastResponseAt ?? row.last_response_at ?? null
  };
}

function mapPerson(row = {}) {
  return {
    userId: row.user_id ?? row.userId,
    teacherId: row.teacher_id ?? row.teacherId ?? '',
    name: row.name ?? row.display_name ?? '',
    code: row.code ?? row.login_code ?? '',
    orgId: row.org_id ?? row.orgId ?? '',
    isAdmin: Boolean(row.is_admin ?? row.isAdmin),
    formCount: Number(row.form_count ?? row.formCount ?? 0),
    createdAt: row.created_at ?? row.createdAt ?? null
  };
}

function mapResponse(row = {}) {
  return {
    id: row.id,
    surveyId: row.survey_id ?? row.surveyId,
    answers: row.answers || {},
    submittedAt: row.submitted_at ?? row.submittedAt,
    userAgent: row.user_agent ?? row.userAgent ?? ''
  };
}

function makeSession(person) {
  return {
    userId: person.userId,
    name: person.name,
    code: person.code,
    teacherId: person.teacherId || '',
    orgId: person.orgId || '',
    isAdmin: Boolean(person.isAdmin)
  };
}

// ---------------------------------------------------------------------------
// LOCAL DEMO BACKEND
// ---------------------------------------------------------------------------

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function seedLocal() {
  const wich = 'local_wich';
  const natt = 'local_natt';
  const priya = 'local_priya';
  const accounts = [
    { userId: wich, teacherId: wich, name: 'Wich Pitchon', code: 'Wich Pitchon', password: '123456', orgId: 'org_math', isAdmin: true, createdAt: nowIso(-90 * DAY) },
    { userId: natt, teacherId: natt, name: 'ครูณัฐวุฒิ', code: 'TCH-0002', password: '123456', orgId: 'org_science', isAdmin: false, createdAt: nowIso(-60 * DAY) },
    { userId: priya, teacherId: priya, name: 'ครูปรียา', code: 'TCH-0003', password: '123456', orgId: 'org_math', isAdmin: false, createdAt: nowIso(-30 * DAY) }
  ];

  const formMath = {
    id: 'local_form_math',
    slug: 'math-survey',
    ownerId: wich,
    ownerName: 'Wich Pitchon',
    title: 'แบบสำรวจความพึงพอใจต่อการเรียนคณิตศาสตร์',
    description: 'แบบสอบถามนี้จัดทำขึ้นเพื่อรับฟังความคิดเห็นของนักเรียนเกี่ยวกับการจัดการเรียนการสอนวิชาคณิตศาสตร์ ในภาคเรียนที่ 2/2569 ใช้เวลาประมาณ 3 นาที และไม่มีการระบุตัวตนของผู้ตอบ',
    status: 'published',
    openAt: nowIso(-3 * DAY),
    closeAt: nowIso(7 * DAY),
    createdAt: nowIso(-5 * DAY),
    updatedAt: nowIso(-2 * DAY),
    settings: {
      confirmation: 'ขอบคุณที่สละเวลาตอบแบบสอบถาม ความคิดเห็นของนักเรียนมีค่ามากสำหรับการพัฒนาการเรียนการสอน',
      showProgress: true
    },
    questions: [
      { id: 'q1', type: 'radio', title: 'ระดับความพึงพอใจโดยรวมต่อการเรียนคณิตศาสตร์', description: '', required: true, options: ['พึงพอใจมาก', 'พึงพอใจ', 'ปานกลาง', 'ควรปรับปรุง'] },
      { id: 'q2', type: 'checkbox', title: 'กิจกรรมใดที่นักเรียนคิดว่าช่วยให้เข้าใจบทเรียนได้ดีที่สุด', description: 'เลือกได้มากกว่าหนึ่งข้อ', required: true, options: ['การสอนแบบอธิบายพร้อมตัวอย่าง', 'แบบฝึกหัดระหว่างคาบ', 'งานกลุ่มและกิจกรรมแข่งขัน', 'คลิปวิดีโอทบทวน', 'การให้คำปรึกษานอกเวลา'] },
      { id: 'q3', type: 'rating', title: 'ให้คะแนนความชัดเจนในการอธิบายของครู', description: '', required: true, options: [], scale: 5 },
      { id: 'q4', type: 'short', title: 'หัวข้อใดที่นักเรียนอยากให้ทบทวนเพิ่มเติม', description: '', required: false, options: [] },
      { id: 'q5', type: 'paragraph', title: 'ข้อเสนอแนะเพิ่มเติมสำหรับการเรียนการสอน', description: '', required: false, options: [] },
      { id: 'q6', type: 'yesno', title: 'นักเรียนต้องการให้จัดสอบย่อยทบทวนก่อนสอบกลางภาคหรือไม่', description: '', required: true, options: [] }
    ]
  };

  const formAI = {
    id: 'local_form_ai',
    slug: 'ai-workshop',
    ownerId: wich,
    ownerName: 'Wich Pitchon',
    title: 'แบบประเมินการอบรมเชิงปฏิบัติการ AI เพื่อการศึกษา',
    description: 'แบบประเมินนี้จะเปิดให้ตอบหลังจบกิจกรรมอบรม ใช้เวลาประมาณ 2 นาที',
    status: 'published',
    openAt: nowIso(2 * DAY),
    closeAt: nowIso(9 * DAY),
    createdAt: nowIso(-2 * DAY),
    updatedAt: nowIso(-1 * DAY),
    settings: { confirmation: 'ขอบคุณสำหรับความคิดเห็น ระบบจะนำผลไปปรับปรุงการอบรมครั้งถัดไป', showProgress: true },
    questions: [
      { id: 'q1', type: 'short', title: 'ชื่อ-นามสกุลผู้เข้าอบรม', description: '', required: true, options: [] },
      { id: 'q2', type: 'radio', title: 'ความเหมาะสมของระยะเวลาในการอบรม', description: '', required: true, options: ['เหมาะสมมาก', 'เหมาะสม', 'ควรปรับ', 'ไม่เหมาะสม'] },
      { id: 'q3', type: 'rating', title: 'ประโยชน์ที่ได้รับจากการอบรม', description: '', required: true, options: [], scale: 5 },
      { id: 'q4', type: 'checkbox', title: 'หัวข้อที่ต้องการเรียนรู้เพิ่มเติม', description: '', required: false, options: ['การเขียนคำสั่ง (Prompt)', 'การสร้างสื่อการสอน', 'การประเมินผลด้วย AI', 'จริยธรรมและความปลอดภัย'] },
      { id: 'q5', type: 'paragraph', title: 'ข้อเสนอแนะสำหรับการจัดอบรมครั้งต่อไป', description: '', required: false, options: [] }
    ]
  };

  const formScience = {
    id: 'local_form_science',
    slug: 'science-day',
    ownerId: natt,
    ownerName: 'ครูณัฐวุฒิ',
    title: 'แบบสอบถามความคิดเห็นเกี่ยวกับกิจกรรมวันวิทยาศาสตร์',
    description: 'ขอเชิญนักเรียนทุกคนร่วมแสดงความคิดเห็นต่อกิจกรรมวันวิทยาศาสตร์ ประจำปีการศึกษา 2569',
    status: 'published',
    openAt: nowIso(-1 * DAY),
    closeAt: nowIso(4 * DAY),
    createdAt: nowIso(-4 * DAY),
    updatedAt: nowIso(-1 * DAY),
    settings: { confirmation: 'ขอบคุณสำหรับความคิดเห็น กิจกรรมครั้งต่อไปจะดีขึ้นเพราะเสียงของทุกคน', showProgress: false },
    questions: [
      { id: 'q1', type: 'radio', title: 'นักเรียนเข้าร่วมกิจกรรมในฐานใดมากที่สุด', description: '', required: true, options: ['ฐานฟิสิกส์', 'ฐานเคมี', 'ฐานชีววิทยา', 'ฐานดาราศาสตร์'] },
      { id: 'q2', type: 'rating', title: 'ความสนุกและน่าสนใจของกิจกรรมโดยรวม', description: '', required: true, options: [], scale: 5 },
      { id: 'q3', type: 'yesno', title: 'ควรจัดกิจกรรมนี้อีกในปีการศึกษาหน้า', description: '', required: true, options: [] },
      { id: 'q4', type: 'paragraph', title: 'สิ่งที่นักเรียนประทับใจหรืออยากให้ปรับปรุง', description: '', required: false, options: [] }
    ]
  };

  const formExtra = {
    id: 'local_form_extra',
    slug: 'extra-class',
    ownerId: wich,
    ownerName: 'Wich Pitchon',
    title: 'แบบสำรวจความสนใจเรียนเสริมวันเสาร์',
    description: 'แบบสอบถามปิดรับคำตอบแล้ว ขอบคุณนักเรียนที่ร่วมตอบทุกคน',
    status: 'published',
    openAt: nowIso(-12 * DAY),
    closeAt: nowIso(-4 * DAY),
    createdAt: nowIso(-14 * DAY),
    updatedAt: nowIso(-4 * DAY),
    settings: { confirmation: 'ขอบคุณสำหรับคำตอบ', showProgress: true },
    questions: [
      { id: 'q1', type: 'yesno', title: 'สนใจเรียนเสริมวันเสาร์หรือไม่', description: '', required: true, options: [] },
      { id: 'q2', type: 'dropdown', title: 'ช่วงเวลาที่สะดวกที่สุด', description: '', required: true, options: ['08.30 – 10.00 น.', '10.15 – 11.45 น.', '13.00 – 14.30 น.'] },
      { id: 'q3', type: 'paragraph', title: 'หัวข้อที่อยากเรียนเสริม', description: '', required: false, options: [] }
    ]
  };

  const forms = [formMath, formAI, formScience, formExtra];
  const responses = [];
  const addResponse = (formId, offsetMs, answers) => {
    responses.push({ id: uid('resp'), surveyId: formId, answers, submittedAt: nowIso(offsetMs), userAgent: 'local-demo' });
  };

  addResponse(formMath.id, -2.4 * DAY, {
    q1: 'พึงพอใจมาก',
    q2: ['การสอนแบบอธิบายพร้อมตัวอย่าง', 'คลิปวิดีโอทบทวน'],
    q3: 5,
    q4: 'ตรีโกณมิติ',
    q5: 'อยากให้มีเฉลยละเอียดหลังทำแบบฝึกหัดทุกครั้ง',
    q6: true
  });
  addResponse(formMath.id, -1.7 * DAY, {
    q1: 'พึงพอใจ',
    q2: ['แบบฝึกหัดระหว่างคาบ', 'งานกลุ่มและกิจกรรมแข่งขัน'],
    q3: 4,
    q4: 'ความน่าจะเป็น',
    q5: 'ชอบที่มีกิจกรรมกลุ่ม ได้ช่วยเพื่อนทำโจทย์',
    q6: true
  });
  addResponse(formMath.id, -0.6 * DAY, {
    q1: 'ปานกลาง',
    q2: ['คลิปวิดีโอทบทวน'],
    q3: 3,
    q4: 'ฟังก์ชันลอการิทึม',
    q5: 'บางคาบอธิบายเร็วเกินไป อยากให้หยุดถามความเข้าใจบ่อยขึ้น',
    q6: false
  });
  addResponse(formMath.id, -0.2 * DAY, {
    q1: 'พึงพอใจมาก',
    q2: ['การสอนแบบอธิบายพร้อมตัวอย่าง', 'งานกลุ่มและกิจกรรมแข่งขัน', 'การให้คำปรึกษานอกเวลา'],
    q3: 5,
    q4: '',
    q5: '',
    q6: true
  });

  addResponse(formScience.id, -0.9 * DAY, {
    q1: 'ฐานดาราศาสตร์',
    q2: 5,
    q3: true,
    q4: 'ชอบฐานดาราศาสตร์เพราะได้ดูกล้องโทรทรรศน์จริง'
  });
  addResponse(formScience.id, -0.4 * DAY, {
    q1: 'ฐานเคมี',
    q2: 4,
    q3: true,
    q4: 'อยากให้เพิ่มฐานหุ่นยนต์และเวลาทำกิจกรรมแต่ละฐานอีกนิด'
  });

  addResponse(formExtra.id, -6 * DAY, { q1: true, q2: '10.15 – 11.45 น.', q3: 'แคลคูลัสเบื้องต้น' });
  addResponse(formExtra.id, -5.8 * DAY, { q1: false, q2: '08.30 – 10.00 น.', q3: '' });
  addResponse(formExtra.id, -5.5 * DAY, { q1: true, q2: '13.00 – 14.30 น.', q3: 'สถิติ' });

  return { accounts, forms, responses, admins: [wich] };
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.accounts)) return parsed;
    }
  } catch { /* noop */ }
  const seeded = seedLocal();
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeLocal(db) {
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
}

function localSessionFromAccount(account) {
  const db = readLocal();
  return makeSession({
    userId: account.userId,
    name: account.name,
    code: account.code,
    teacherId: account.teacherId,
    orgId: account.orgId,
    isAdmin: db.admins.includes(account.userId)
  });
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

export async function login(identifier, password) {
  const code = String(identifier || '').trim();
  const pass = String(password || '');
  if (!code) throw new Error('กรุณากรอกรหัสผู้ใช้หรือชื่อ–นามสกุล');
  if (!pass) throw new Error('กรุณากรอกรหัสผ่าน');

  if (LOCAL_MODE) {
    const db = readLocal();
    const account = db.accounts.find(item =>
      item.code.toLowerCase() === code.toLowerCase() || item.name.toLowerCase() === code.toLowerCase()
    );
    if (!account) throw new Error('ไม่พบรหัสผู้ใช้หรือชื่อนี้ในระบบ');
    if (account.password !== pass) throw new Error('รหัสผ่านไม่ถูกต้อง');
    const session = localSessionFromAccount(account);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  const supaClient = supa();
  const { data: rows, error } = await withTimeout(supaClient.rpc('resolve_login', { p_identifier: code }));
  if (error) throw friendlyError(error);
  if (!Array.isArray(rows) || !rows.length) throw new Error('ไม่พบรหัสผู้ใช้หรือชื่อนี้ในระบบ');

  const account = rows[0];
  const { data: authData, error: authError } = await withTimeout(supaClient.auth.signInWithPassword({
    email: account.email,
    password: pass
  }));
  if (authError || !authData?.session) throw new Error('รหัสผ่านไม่ถูกต้อง');

  const profile = await fetchProfile(authData.session.user.id);
  if (!profile) {
    await supaClient.auth.signOut();
    throw new Error('บัญชีนี้ยังไม่ได้ผูกกับข้อมูลผู้ใช้');
  }
  if (profile.role !== 'teacher') {
    await supaClient.auth.signOut();
    throw new Error('บัญชีนี้ไม่ได้รับสิทธิ์สร้างแบบสอบถาม');
  }

  let isAdmin = false;
  try {
    const { data: adminFlag } = await supaClient.rpc('survey_is_admin');
    isAdmin = Boolean(adminFlag);
    if (!isAdmin) {
      const { data: claimed } = await supaClient.rpc('survey_claim_admin');
      isAdmin = Boolean(claimed);
    }
  } catch { /* SQL may not be applied yet; the app will show a setup message */ }

  const session = makeSession({
    userId: profile.user_id,
    name: profile.display_name || account.display_name || code,
    code: profile.login_code || '',
    teacherId: profile.teacher_id || '',
    orgId: profile.org_id || '',
    isAdmin
  });
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function fetchProfile(userId) {
  const { data, error } = await withTimeout(supa().from('profiles')
    .select('user_id, role, teacher_id, student_id, org_id, login_code, login_name, display_name')
    .eq('user_id', userId)
    .maybeSingle());
  if (error) throw friendlyError(error);
  return data;
}

export async function restoreSession() {
  if (LOCAL_MODE) {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      const db = readLocal();
      const account = db.accounts.find(item => item.userId === saved.userId);
      if (!account) return null;
      return localSessionFromAccount(account);
    } catch {
      return null;
    }
  }

  const supaClient = supa();
  const { data: { session } } = await supaClient.auth.getSession();
  if (!session?.user) return null;
  const profile = await fetchProfile(session.user.id);
  if (!profile || profile.role !== 'teacher') {
    await supaClient.auth.signOut();
    return null;
  }
  let isAdmin = false;
  try {
    const { data } = await supaClient.rpc('survey_is_admin');
    isAdmin = Boolean(data);
    if (!isAdmin) {
      const { data: claimed } = await supaClient.rpc('survey_claim_admin');
      isAdmin = Boolean(claimed);
    }
  } catch { /* noop */ }
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  })();
  return makeSession({
    userId: profile.user_id,
    name: profile.display_name || saved?.name || profile.login_name || '',
    code: profile.login_code || '',
    teacherId: profile.teacher_id || '',
    orgId: profile.org_id || '',
    isAdmin
  });
}

export async function logout() {
  localStorage.removeItem(SESSION_KEY);
  if (LOCAL_MODE) return;
  try { await supa().auth.signOut(); } catch { /* noop */ }
}

export async function changePassword(session, password) {
  const next = String(password || '');
  if (next.length < 4) throw new Error('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
  if (LOCAL_MODE) {
    const db = readLocal();
    const account = db.accounts.find(item => item.userId === session.userId);
    if (!account) throw new Error('ไม่พบบัญชีนี้');
    account.password = next;
    writeLocal(db);
    return;
  }
  await callAccounts({
    action: 'password',
    role: 'teacher',
    id: session.teacherId,
    password: next
  });
}

export async function resetPassword(person, password) {
  const next = String(password || '');
  if (next.length < 4) throw new Error('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
  if (LOCAL_MODE) {
    const db = readLocal();
    const account = db.accounts.find(item => item.userId === person.userId);
    if (!account) throw new Error('ไม่พบบัญชีนี้');
    account.password = next;
    writeLocal(db);
    return;
  }
  if (!person.teacherId) throw new Error('บัญชีนี้ยังไม่พร้อมสำหรับรีเซ็ตรหัสผ่าน');
  await callAccounts({ action: 'password', role: 'teacher', id: person.teacherId, password: next });
}

export async function createAccount(session, { name, code, password }) {
  const cleanName = String(name || '').trim();
  const cleanCode = String(code || '').trim();
  const pass = String(password || '');
  if (cleanName.length < 2) throw new Error('กรุณากรอกชื่อ–นามสกุล');
  if (cleanCode.length < 3) throw new Error('รหัสผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
  if (pass.length < 4) throw new Error('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');

  if (LOCAL_MODE) {
    const db = readLocal();
    if (db.accounts.some(item => item.code.toLowerCase() === cleanCode.toLowerCase())) {
      throw new Error('รหัสผู้ใช้นี้ถูกใช้แล้ว');
    }
    const userId = uid('local_user');
    db.accounts.push({
      userId,
      teacherId: userId,
      name: cleanName,
      code: cleanCode,
      password: pass,
      orgId: session.orgId || 'org_math',
      isAdmin: false,
      createdAt: new Date().toISOString()
    });
    writeLocal(db);
    return { ok: true };
  }

  const people = await listPeople();
  if (people.some(person => person.code.toLowerCase() === cleanCode.toLowerCase())) {
    throw new Error('รหัสผู้ใช้นี้ถูกใช้แล้ว');
  }

  const internalId = `s_${randomSlug(10)}`;
  const result = await callAccounts({
    action: 'sync',
    people: [{
      id: internalId,
      role: 'teacher',
      code: cleanCode,
      name: cleanName,
      password: pass,
      orgId: session.orgId || ''
    }]
  });
  const first = result?.results?.[0];
  if (!first?.ok) throw new Error(first?.error || 'สร้างบัญชีไม่สำเร็จ');
  return { ok: true };
}

async function callAccounts(body) {
  const supaClient = supa();
  const { data: { session } } = await supaClient.auth.getSession();
  if (!session?.access_token) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  const response = await fetch(ACCOUNTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(body)
  });
  let payload = null;
  try { payload = await response.json(); } catch { /* noop */ }
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || 'ดำเนินการกับบัญชีไม่สำเร็จ');
  }
  return payload;
}

export async function listPeople() {
  if (LOCAL_MODE) {
    const db = readLocal();
    const counts = new Map();
    db.forms.forEach(form => counts.set(form.ownerId, (counts.get(form.ownerId) || 0) + 1));
    return db.accounts.map(account => ({
      userId: account.userId,
      teacherId: account.teacherId,
      name: account.name,
      code: account.code,
      orgId: account.orgId,
      isAdmin: db.admins.includes(account.userId),
      formCount: counts.get(account.userId) || 0,
      createdAt: account.createdAt || null
    })).sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name, 'th'));
  }

  const { data, error } = await withTimeout(supa().rpc('survey_people'));
  if (error) throw friendlyError(error);
  return (data || []).map(mapPerson).sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name, 'th'));
}

// ---------------------------------------------------------------------------
// SURVEYS
// ---------------------------------------------------------------------------

export async function listForms() {
  if (LOCAL_MODE) {
    const db = readLocal();
    return db.forms.map(form => ({
      ...form,
      responseCount: db.responses.filter(item => item.surveyId === form.id).length,
      lastResponseAt: db.responses.filter(item => item.surveyId === form.id)
        .map(item => item.submittedAt).sort().pop() || null
    })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  const { data, error } = await withTimeout(supa().rpc('survey_overview'));
  if (error) throw friendlyError(error);
  return (data || []).map(mapForm);
}

export async function getForm(id) {
  if (LOCAL_MODE) {
    const db = readLocal();
    const form = db.forms.find(item => item.id === id);
    if (!form) throw new Error('ไม่พบแบบสอบถามนี้');
    return {
      ...form,
      responseCount: db.responses.filter(item => item.surveyId === form.id).length,
      lastResponseAt: db.responses.filter(item => item.surveyId === form.id)
        .map(item => item.submittedAt).sort().pop() || null
    };
  }
  const { data, error } = await withTimeout(supa().from('surveys')
    .select('*')
    .eq('id', id)
    .maybeSingle());
  if (error) throw friendlyError(error);
  if (!data) throw new Error('ไม่พบแบบสอบถามนี้');
  const { count } = await supa().from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', id);
  return mapForm({ ...data, response_count: count || 0 });
}

export async function createForm(session, form) {
  const payload = {
    slug: form.slug || randomSlug(8),
    owner_id: session.userId,
    owner_name: session.name,
    title: form.title || 'แบบสอบถามใหม่',
    description: form.description || '',
    questions: form.questions || [],
    settings: form.settings || {},
    status: form.status || 'published',
    open_at: form.openAt || null,
    close_at: form.closeAt || null
  };

  if (LOCAL_MODE) {
    const db = readLocal();
    const row = {
      ...payload,
      id: uid('local_form'),
      ownerId: payload.owner_id,
      ownerName: payload.owner_name,
      openAt: payload.open_at,
      closeAt: payload.close_at,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.forms.push(row);
    writeLocal(db);
    return mapForm({ ...row, responseCount: 0 });
  }

  const { data, error } = await withTimeout(supa().from('surveys')
    .insert(payload)
    .select('*')
    .single());
  if (error) throw friendlyError(error);
  return mapForm({ ...data, response_count: 0 });
}

export async function updateForm(id, patch) {
  const payload = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.questions !== undefined) payload.questions = patch.questions;
  if (patch.settings !== undefined) payload.settings = patch.settings;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.openAt !== undefined) payload.open_at = patch.openAt;
  if (patch.closeAt !== undefined) payload.close_at = patch.closeAt;
  payload.updated_at = new Date().toISOString();

  if (LOCAL_MODE) {
    const db = readLocal();
    const form = db.forms.find(item => item.id === id);
    if (!form) throw new Error('ไม่พบแบบสอบถามนี้');
    Object.assign(form, patch, { updatedAt: payload.updated_at });
    if (patch.openAt !== undefined) form.openAt = patch.openAt;
    if (patch.closeAt !== undefined) form.closeAt = patch.closeAt;
    writeLocal(db);
    return mapForm(form);
  }

  const { data, error } = await withTimeout(supa().from('surveys')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single());
  if (error) throw friendlyError(error);
  return mapForm(data);
}

export async function deleteForm(id) {
  if (LOCAL_MODE) {
    const db = readLocal();
    db.forms = db.forms.filter(item => item.id !== id);
    db.responses = db.responses.filter(item => item.surveyId !== id);
    writeLocal(db);
    return;
  }
  const { error } = await withTimeout(supa().from('surveys').delete().eq('id', id));
  if (error) throw friendlyError(error);
}

export async function listResponses(formId) {
  if (LOCAL_MODE) {
    const db = readLocal();
    return db.responses
      .filter(item => item.surveyId === formId)
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  }
  const { data, error } = await withTimeout(supa().from('survey_responses')
    .select('*')
    .eq('survey_id', formId)
    .order('submitted_at', { ascending: false }));
  if (error) throw friendlyError(error);
  return (data || []).map(mapResponse);
}

export async function deleteResponse(formId, responseId) {
  if (LOCAL_MODE) {
    const db = readLocal();
    db.responses = db.responses.filter(item => item.id !== responseId);
    writeLocal(db);
    return;
  }
  const { error } = await withTimeout(supa().from('survey_responses')
    .delete()
    .eq('id', responseId)
    .eq('survey_id', formId));
  if (error) throw friendlyError(error);
}

// ---------------------------------------------------------------------------
// PUBLIC (no login)
// ---------------------------------------------------------------------------

export async function getPublicForm(slug) {
  if (LOCAL_MODE) {
    const db = readLocal();
    const form = db.forms.find(item => item.slug === slug);
    if (!form || form.status === 'draft') return null;
    return {
      slug: form.slug,
      title: form.title,
      description: form.description,
      questions: form.questions,
      settings: form.settings || {},
      openAt: form.openAt,
      closeAt: form.closeAt,
      ownerName: form.ownerName,
      state: publicState(form),
      responseCount: db.responses.filter(item => item.surveyId === form.id).length
    };
  }

  const { data, error } = await withTimeout(supa().rpc('survey_public', { p_slug: slug }));
  if (error) throw friendlyError(error);
  if (!data) return null;
  return {
    slug: data.slug,
    title: data.title,
    description: data.description || '',
    questions: Array.isArray(data.questions) ? data.questions : [],
    settings: data.settings || {},
    openAt: data.openAt ?? data.open_at ?? null,
    closeAt: data.closeAt ?? data.close_at ?? null,
    ownerName: data.ownerName ?? data.owner_name ?? '',
    state: data.state || 'open',
    responseCount: Number(data.responseCount ?? data.response_count ?? 0)
  };
}

function publicState(form) {
  if (form.status === 'draft') return 'draft';
  if (form.status === 'closed') return 'closed';
  const now = Date.now();
  if (form.openAt && now < new Date(form.openAt).getTime()) return 'scheduled';
  if (form.closeAt && now > new Date(form.closeAt).getTime()) return 'closed';
  return 'open';
}

export async function submitResponse(slug, answers) {
  if (LOCAL_MODE) {
    const db = readLocal();
    const form = db.forms.find(item => item.slug === slug);
    if (!form) return { error: 'not_found' };
    const state = publicState(form);
    if (state === 'closed') return { error: 'closed' };
    if (state === 'scheduled') return { error: 'not_open' };
    db.responses.push({
      id: uid('resp'),
      surveyId: form.id,
      answers,
      submittedAt: new Date().toISOString()
    });
    writeLocal(db);
    return { ok: true };
  }

  const { data, error } = await withTimeout(supa().rpc('survey_submit', {
    p_slug: slug,
    p_answers: answers
  }));
  if (error) throw friendlyError(error);
  return data || { error: 'unknown' };
}

export function isLocalMode() {
  return LOCAL_MODE;
}

export { OWNER_NAME };
