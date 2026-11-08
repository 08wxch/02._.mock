import { downloadFile } from './utils.js';

export const EXAM_FILE_KIND = 'examio.exam';
export const EXAM_FILE_VERSION = 1;
const MAX_QUESTIONS = 500;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const text = (value, max = 5000) => String(value ?? '').trim().slice(0, max);
const image = value => {
  const src = String(value || '').trim();
  if (!src) return '';
  return /^(https?:\/\/|data:image\/)/i.test(src) ? src : '';
};

function questionForFile(question = {}) {
  const type = ['mcq', 'truefalse', 'short', 'essay'].includes(question.type) ? question.type : 'mcq';
  const accepted = Array.isArray(question.acceptedAnswers)
    ? question.acceptedAnswers.filter(Boolean).join(', ')
    : text(question.acceptedAnswers, 2000);
  return {
    type,
    text: text(question.text, 20000),
    points: Math.max(0.5, Math.min(100, Number(question.points) || 1)),
    options: type === 'mcq'
      ? (Array.isArray(question.options) ? question.options.slice(0, 4) : []).map((option, index) => ({
          id: text(option?.id, 4) || String.fromCharCode(65 + index),
          text: text(option?.text, 5000),
          image: image(option?.image),
          imagePath: text(option?.imagePath, 1000)
        }))
      : undefined,
    correct: type === 'truefalse'
      ? (String(question.correct) === 'false' ? 'false' : 'true')
      : text(question.correct, 100),
    acceptedAnswers: type === 'short' ? accepted : undefined,
    reference: type === 'essay' ? text(question.reference, 20000) : undefined,
    image: image(question.image),
    imagePath: text(question.imagePath, 1000)
  };
}

export function buildExamFile(exam) {
  const questions = (Array.isArray(exam?.questions) ? exam.questions : [])
    .slice(0, MAX_QUESTIONS)
    .map(questionForFile);
  return {
    kind: EXAM_FILE_KIND,
    version: EXAM_FILE_VERSION,
    app: '02._.mock',
    exportedAt: new Date().toISOString(),
    source: {
      title: text(exam?.title, 90),
      code: text(exam?.code, 20),
      teacherName: text(exam?.teacherName, 120)
    },
    exam: {
      title: text(exam?.title, 90),
      subject: text(exam?.subject, 80) || 'คณิตศาสตร์',
      level: text(exam?.level, 60),
      description: text(exam?.description || exam?.topic, 220),
      instructions: text(exam?.instructions, 500),
      duration: Math.max(1, Math.min(180, Number(exam?.duration) || 30)),
      passPercent: Math.max(1, Math.min(100, Number(exam?.passPercent) || 60)),
      shareMode: exam?.shareMode === 'edit' ? 'edit' : 'view',
      questions
    }
  };
}

export function examFileText(exam) {
  return JSON.stringify(buildExamFile(exam), null, 2);
}

export function examFileName(exam) {
  const clean = text(exam?.title || 'ชุดสอบ', 60)
    .replace(/[\\/:*?"<>|\n\r]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'ชุดสอบ';
  const date = new Date().toISOString().slice(0, 10);
  return `02mock-${clean}-${date}.json`;
}

export function downloadExamFile(exam) {
  downloadFile(examFileName(exam), examFileText(exam), 'application/json;charset=utf-8');
}

export function parseExamFile(raw, { maxBytes = MAX_FILE_BYTES } = {}) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'ไฟล์ว่าง หรืออ่านข้อความจากไฟล์ไม่ได้' };
  }
  if (raw.length > maxBytes) {
    return { ok: false, error: 'ไฟล์มีขนาดใหญ่เกิน 15 MB' };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'ไฟล์นี้ไม่ใช่ JSON ที่ถูกต้อง กรุณาเลือกไฟล์ที่ส่งออกจากระบบ' };
  }
  if (Array.isArray(parsed)) parsed = { questions: parsed };
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'ไม่พบข้อมูลชุดสอบในไฟล์นี้' };
  }
  if (parsed.kind && parsed.kind !== EXAM_FILE_KIND) {
    return { ok: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์ชุดสอบของ 02._.mock' };
  }
  const source = parsed.exam && typeof parsed.exam === 'object' ? parsed.exam : parsed;
  const rawQuestions = Array.isArray(source.questions) ? source.questions : [];
  if (!rawQuestions.length) {
    return { ok: false, error: 'ไฟล์นี้ไม่มีข้อสอบให้สร้างชุดใหม่' };
  }
  const questions = rawQuestions
    .slice(0, MAX_QUESTIONS)
    .filter(question => question && typeof question === 'object')
    .map(questionForFile);
  if (!questions.length) {
    return { ok: false, error: 'ไม่พบข้อสอบที่อ่านได้ในไฟล์นี้' };
  }
  return {
    ok: true,
    truncated: rawQuestions.length > MAX_QUESTIONS,
    exam: {
      title: text(source.title, 90),
      subject: text(source.subject, 80) || 'คณิตศาสตร์',
      level: text(source.level, 60),
      description: text(source.description || source.topic, 220),
      instructions: text(source.instructions, 500),
      duration: Math.max(1, Math.min(180, Number(source.duration) || 30)),
      passPercent: Math.max(1, Math.min(100, Number(source.passPercent) || 60)),
      shareMode: source.shareMode === 'edit' ? 'edit' : 'view',
      questions
    }
  };
}
