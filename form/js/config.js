// ---------------------------------------------------------------------------
// 02._.form — configuration
// The survey app shares the same Supabase project and account system as
// 02._.mock. Only the anon key is shipped in the browser; every write is
// protected by Row Level Security and SECURITY DEFINER RPCs.
// ---------------------------------------------------------------------------

export const SUPABASE_URL = 'https://hqpbvxmrolxhuexzzxgo.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxcGJ2eG1yb2x4aHVleHp6eGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3Nzc0NjMsImV4cCI6MjEwODM1MzQ2M30.HsBV5_KXdWadINtL17tIIgiHLbi28t_nU6jsJ1qoDD8';

export const ACCOUNTS_URL = `${SUPABASE_URL}/functions/v1/accounts`;

export const APP_NAME = '02._.form';
export const APP_TAGLINE = 'แบบสอบถามออนไลน์';
export const BRAND_TITLE = '02._.form';
export const OWNER_NAME = 'Wich Pitchon';

// Local demo mode: append ?local=1 to the URL. It keeps every survey and
// response in this browser only, which makes it possible to try the whole
// flow before the Supabase tables are created.
export const LOCAL_MODE = new URLSearchParams(location.search).has('local');

export const SESSION_KEY = 'formio_session_v1';
export const LOCAL_DB_KEY = 'formio_local_db_v1';

export const QUESTION_TYPES = [
  { value: 'section', label: 'ส่วน / ขึ้นหน้าใหม่', hint: 'แบ่งแบบสอบถามออกเป็นส่วน ๆ', icon: 'layout-dashboard' },
  { value: 'content', label: 'ข้อความ / รูปภาพ', hint: 'แสดงข้อความหรือรูป โดยไม่ต้องตอบ', icon: 'file-text' },
  { value: 'short', label: 'ข้อความสั้น', hint: 'คำตอบสั้น ๆ บรรทัดเดียว', icon: 'type' },
  { value: 'paragraph', label: 'ข้อความยาว', hint: 'คำตอบหลายบรรทัด', icon: 'align-left' },
  { value: 'radio', label: 'ตัวเลือกเดียว', hint: 'เลือกได้เพียงข้อเดียว', icon: 'circle-dot' },
  { value: 'checkbox', label: 'หลายตัวเลือก', hint: 'เลือกได้มากกว่าหนึ่งข้อ', icon: 'check-square' },
  { value: 'dropdown', label: 'ดรอปดาวน์', hint: 'เลือกจากรายการ', icon: 'list' },
  { value: 'yesno', label: 'ใช่ / ไม่ใช่', hint: 'คำตอบสองทาง', icon: 'toggle-left' },
  { value: 'rating', label: 'ให้คะแนน', hint: 'สเกล 1 ถึง 5', icon: 'star' },
  { value: 'date', label: 'วันที่', hint: 'เลือกวันจากปฏิทิน', icon: 'calendar' },
  { value: 'time', label: 'เวลา', hint: 'เลือกเวลาจากนาฬิกา', icon: 'clock' },
  { value: 'email', label: 'อีเมล', hint: 'ตรวจรูปแบบอีเมลให้', icon: 'mail' },
  { value: 'number', label: 'ตัวเลข', hint: 'คำตอบเป็นจำนวน', icon: 'hash' }
];

export const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES.map(item => [item.value, item.label]));

export const TYPE_ICON = Object.fromEntries(QUESTION_TYPES.map(item => [item.value, item.icon]));
