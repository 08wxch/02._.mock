import { icon } from '../icons.js';
import {
  e, thaiDate, thaiDateTime, thaiTime, longThaiDate, shortThaiDate,
  formatCountdownWords, formatDuration, formatStopwatch, percent,
  relativeTime, greetingByHour, typeLabel, typeHint,
  initials, formatNumber, makePrintHeader
} from '../utils.js';
import {
  brand, avatar, badge, toast, openModal, closeModal, confirmDialog,
  notificationBell, mountNotificationBell, emptyState, ringScore, mountCopyButtons
} from '../ui.js';
import {
  getDB, findExam, findStudentAttempt, getStudentAttempts, getNotifications, markNoticeRead,
  clearSession, startAttempt, submitAttempt, attemptScore,
  attemptStatusMeta, isAnswered, countAnswered, getAnswerValue, logAntiCheat,
  isCorrect, rankAttempts, currentStudentKey, saveDB, answerText,
  correctAnswerText, isStudentAssigned, studentClassLabel
} from '../store.js';
import { cloudLogout } from '../cloud.js';
import { mathText } from '../math.js';
import { navigate, refreshRoute } from '../router.js';
import { openAccountProfile } from '../profile.js';

function firstName(name = '') {
  return String(name).trim().split(/\s+/)[0] || 'นักเรียน';
}
function currentClassLabel(session) {
  const student = getDB().students.find(s => s.id === currentStudentKey(session));
  return student ? studentClassLabel(student) : (session.class || 'ผู้เข้าสอบ');
}
function examAvailability(exam) {
  const now = Date.now();
  const close = new Date(exam.closeAt).getTime();
  const open = new Date(exam.openAt).getTime();
  if (exam.status !== 'open') return 'closed';
  if (now < open) return 'upcoming';
  if (now > close) return 'expired';
  return 'open';
}
function studentAttemptState(exam, session) {
  const attempt = findStudentAttempt(exam.id, session);
  if (!attempt) return 'not_started';
  if (attempt.status === 'in_progress') return 'in_progress';
  return 'submitted';
}
function buttonForStudent(exam, attempt) {
  if (!attempt) return { href: `#/student/exam/${exam.id}/instructions`, label: 'เข้าสอบ', icon: 'arrow-right' };
  if (attempt.status === 'in_progress') return { href: `#/student/exam/${exam.id}/take`, label: 'ทำต่อ', icon: 'play' };
  if (exam.status === 'announced') return { href: `#/student/exam/${exam.id}/result`, label: 'ดูผลสอบ', icon: 'award' };
  return { href: `#/student/exam/${exam.id}/success`, label: 'ดูสถานะ', icon: 'clock' };
}
function examHeroWindow(exam, attempt) {
  if (attempt?.status === 'in_progress') {
    const remaining = Math.max(0, new Date(attempt.endsAt).getTime() - Date.now());
    const total = exam.duration * 60_000;
    return { remaining, pct: Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) };
  }
  const remaining = Math.max(0, new Date(exam.closeAt).getTime() - Date.now());
  const total = Math.max(1, new Date(exam.closeAt).getTime() - new Date(exam.openAt).getTime());
  return { remaining, pct: Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) };
}
function formatClockParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return { main: `${h} ชม.`, sub: `${m} นาที` };
  if (m > 0) return { main: `${m} นาที`, sub: `${s} วินาที` };
  return { main: `${s} วินาที`, sub: 'เหลือเวลา' };
}

function studentShell(session, { active = 'dashboard', content = '', extraClass = '' } = {}) {
  const notices = getNotifications(session);
  const classLabel = currentClassLabel(session);
  return `<div class="student-app ${extraClass}">
    <header class="student-header">
      <div class="container student-header__inner">
        ${brand({ href: '#/student', subtitle: 'ห้องสอบของฉัน' })}
        <nav class="student-nav" aria-label="เมนูนักเรียน">
          <a href="#/student" class="${active === 'dashboard' ? 'is-active' : ''}">หน้าหลัก</a>
          <a href="#/student/history" class="${active === 'history' ? 'is-active' : ''}">ประวัติการสอบ</a>
        </nav>
        <div class="student-header__right">
          ${notificationBell({ session, items: notices, mode: 'student' })}
          <button class="header-profile header-profile--button" type="button" data-open-student-profile aria-label="เปิดข้อมูลบัญชีของฉัน" title="ดูข้อมูลบัญชี">
            ${avatar(session.name, session.studentId || session.guestId, 'sm')}
            <span class="header-profile__copy"><strong>${e(firstName(session.name))}</strong><span>${e(classLabel)}</span></span>
          </button>
          <button class="icon-btn icon-btn--ghost" type="button" data-logout aria-label="ออกจากระบบ" title="ออกจากระบบ">${icon('logout', 17)}</button>
        </div>
      </div>
    </header>
    ${content}
  </div>`;
}

function mountStudentShell(session) {
  mountNotificationBell(document);
  document.querySelector('[data-open-student-profile]')?.addEventListener('click', () => {
    const student = getDB().students.find(s => s.id === currentStudentKey(session));
    if (!student) {
      toast('บัญชีนี้เข้าสอบด้วยรหัสชุดสอบ จึงยังไม่มีข้อมูลบัญชีถาวร', 'info', 3200);
      return;
    }
    openAccountProfile({ kind: 'student', personId: student.id, session });
  });
  document.querySelector('[data-logout]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'ออกจากระบบ?',
      message: 'คุณสามารถกลับเข้าสู่ระบบได้ใหม่ด้วยบัญชีหรือรหัสเข้าสอบเดิม',
      confirmLabel: 'ออกจากระบบ',
      tone: 'danger',
      iconName: 'logout'
    });
    if (!ok) return;
    await cloudLogout();
    clearSession();
    navigate('/login');
    toast('ออกจากระบบแล้ว', 'info', 2000);
  });
}

function statusForHistory(exam, attempt) {
  if (attempt.status === 'in_progress') return { label: 'กำลังทำ', tone: 'warning', icon: 'timer' };
  if (exam.status === 'announced') return { label: 'ประกาศผลแล้ว', tone: 'success', icon: 'award' };
  return { label: 'รอประกาศผล', tone: 'info', icon: 'clock' };
}

function availableExamCard(exam, session) {
  const attempt = findStudentAttempt(exam.id, session);
  const state = studentAttemptState(exam, session);
  const action = buttonForStudent(exam, attempt);
  const isInProgress = state === 'in_progress';
  const isSubmitted = state === 'submitted';
  const statusBadge = isInProgress
    ? `<span class="badge badge--warning">${icon('timer', 11)} กำลังทำ</span>`
    : isSubmitted
      ? `<span class="badge badge--success">${icon('check-circle', 11)} ส่งแล้ว</span>`
      : `<span class="badge badge--live"><span class="badge__dot"></span> เปิดสอบ</span>`;
  let note = `ปิดรับคำตอบ ${thaiTime(exam.closeAt)} น.`;
  if (isInProgress) note = `ตอบแล้ว ${countAnswered(exam, attempt)} / ${exam.questions.length} ข้อ`;
  if (isSubmitted) note = exam.status === 'announced' ? 'ประกาศผลแล้ว · ดูคะแนนและเฉลย' : 'ส่งคำตอบแล้ว · รอประกาศผล';
  return `<a class="available-exam-card" href="${action.href}">
    <div class="available-exam-card__top">
      <span class="available-exam-card__subject">${icon('book-open', 12)} ${e(exam.subject)}</span>
      ${statusBadge}
    </div>
    <h3>${e(exam.title)}</h3>
    <div class="available-exam-card__meta">
      <span>${icon('file-text', 11)} ${exam.questions.length} ข้อ</span>
      <span>${icon('clock', 11)} ${exam.duration} นาที</span>
      <span>${icon('award', 11)} ${exam.totalPoints} คะแนน</span>
    </div>
    <div class="available-exam-card__foot">
      <span>${e(note)}</span>
      <strong>${action.label} ${icon('arrow-right', 13)}</strong>
    </div>
  </a>`;
}

function latestAnnouncedAttempt(session) {
  const db = getDB();
  const attempts = getStudentAttempts(session);
  const announced = attempts
    .map(a => ({ attempt: a, exam: db.exams.find(x => x.id === a.examId) }))
    .filter(x => x.exam?.status === 'announced' && x.exam.settings?.showScore !== false && x.attempt.status !== 'in_progress')
    .sort((a, b) => new Date(b.exam.publishedAt || 0) - new Date(a.exam.publishedAt || 0));
  return announced[0] || null;
}

export function studentDashboardView(ctx) {
  const { session } = ctx;
  const db = getDB();
  const stateOrder = { in_progress: 0, not_started: 1, submitted: 2 };
  const activeExams = db.exams
    .filter(ex => examAvailability(ex) === 'open' && isStudentAssigned(ex, session))
    .sort((a, b) => {
      const rank = stateOrder[studentAttemptState(a, session)] - stateOrder[studentAttemptState(b, session)];
      return rank || new Date(a.closeAt) - new Date(b.closeAt);
    });
  const mainExam = activeExams[0] || null;
  const attempt = mainExam ? findStudentAttempt(mainExam.id, session) : null;
  const attempts = getStudentAttempts(session);
  const latest = latestAnnouncedAttempt(session);
  const history = attempts.slice(0, 4);
  const now = new Date();

  let spotlight = `<div class="exam-spotlight">
    <div class="exam-spotlight__top">
      <span class="exam-spotlight__kicker">${icon('calendar', 13)} ยังไม่มีชุดสอบที่เปิดอยู่</span>
      <span class="badge badge--neutral">ว่าง</span>
    </div>
    <div class="exam-spotlight__grid">
      <div>
        <h2>วันนี้ยังไม่มีห้องสอบ</h2>
        <p class="exam-spotlight__sub">เมื่อครูเปิดชุดสอบใหม่ รายการจะปรากฏที่นี่โดยอัตโนมัติ</p>
        <div class="exam-meta-chips">
          <span class="exam-meta-chip">${icon('bell', 12)} ติดตามการแจ้งเตือนจากครู</span>
        </div>
      </div>
    </div>
    <div class="exam-spotlight__bottom">
      <div class="exam-spotlight__note">${icon('book-open', 14)} อ่านทบทวนบทเรียนระหว่างรอได้เลย</div>
      <div class="exam-spotlight__actions"><a class="btn btn--white" href="#/student/history">ดูประวัติการสอบ ${icon('arrow-right', 15)}</a></div>
    </div>
  </div>`;

  if (mainExam) {
    const state = studentAttemptState(mainExam, session);
    const btn = buttonForStudent(mainExam, attempt);
    const windowInfo = examHeroWindow(mainExam, attempt);
    const parts = formatClockParts(windowInfo.remaining);
    const isInProgress = state === 'in_progress';
    const isSubmitted = state === 'submitted';
    const submittedScore = isSubmitted ? attemptScore(mainExam, attempt) : null;
    const closingText = isInProgress ? 'เวลาทำข้อสอบคงเหลือ' : 'ปิดรับคำตอบในอีก';
    const badgeMarkup = isInProgress
      ? `<span class="badge badge--warning">${icon('timer', 11)} กำลังทำข้อสอบ</span>`
      : isSubmitted
        ? `<span class="badge badge--success">${icon('check-circle', 11)} ส่งคำตอบแล้ว</span>`
        : `<span class="badge badge--live"><span class="badge__dot"></span> กำลังเปิดสอบ</span>`;
    spotlight = `<div class="exam-spotlight ${isSubmitted ? 'exam-spotlight--submitted' : ''}">
      <div class="exam-spotlight__top">
        <span class="exam-spotlight__kicker">${icon('calendar', 13)} เปิดสอบ · ${e(mainExam.subject)}</span>
        ${badgeMarkup}
      </div>
      <div class="exam-spotlight__grid">
        <div>
          <h2>${e(mainExam.title)}</h2>
          <p class="exam-spotlight__sub">${e(mainExam.topic || mainExam.description)}</p>
          <div class="exam-meta-chips">
            <span class="exam-meta-chip">${icon('file-text', 12)} ${mainExam.questions.length} ข้อ</span>
            <span class="exam-meta-chip">${icon('clock', 12)} ${mainExam.duration} นาที</span>
            <span class="exam-meta-chip">${icon('award', 12)} ${mainExam.totalPoints} คะแนน</span>
            <span class="exam-meta-chip">${icon('user', 12)} ${e(mainExam.teacherName.split(' ')[0])}</span>
          </div>
        </div>
        <div class="spotlight-clock" style="--value:${windowInfo.pct}">
          <div class="spotlight-clock__inner">
            <span>${closingText}</span>
            <strong data-hero-countdown-main>${parts.main}</strong>
            <small data-hero-countdown-sub>${parts.sub}</small>
          </div>
        </div>
      </div>
      <div class="exam-spotlight__bottom">
        <div class="exam-spotlight__note">
          ${icon(isSubmitted ? 'check-circle' : 'info', 14)}
          ${isSubmitted
            ? (mainExam.status === 'announced' ? 'ครูประกาศผลแล้ว ตรวจดูคะแนนและเฉลยได้เลย' : 'ส่งคำตอบให้ครูแล้ว · รอประกาศผล')
            : isInProgress
              ? `ตอบแล้ว ${countAnswered(mainExam, attempt)} / ${mainExam.questions.length} ข้อ`
              : `เปิดถึง ${thaiTime(mainExam.closeAt)} น. · สอบได้ ${mainExam.attemptsAllowed} ครั้ง`}
        </div>
        <div class="exam-spotlight__actions">
          ${isSubmitted && mainExam.status === 'announced'
            ? `<a class="btn btn--ghost" href="#/student/history">ประวัติ</a><a class="btn btn--white" href="${btn.href}">${icon(btn.icon, 15)} ${btn.label}</a>`
            : `<a class="btn btn--ghost" href="#/student/exam/${mainExam.id}/instructions">รายละเอียด</a><a class="btn btn--white" href="${btn.href}">${icon(btn.icon, 15)} ${btn.label}</a>`}
        </div>
      </div>
      <div class="exam-spotlight__hint">${icon('cloud-check', 11)} คำตอบบันทึกอัตโนมัติทุกครั้ง · ${isSubmitted ? `ใช้เวลา ${formatStopwatch(attempt.timeUsedSec || 0)}` : `คะแนนเต็ม ${mainExam.totalPoints} คะแนน`}</div>
    </div>`;
  }

  const otherExams = activeExams.slice(1);
  const examPicker = otherExams.length ? `<section class="available-exams card">
    <div class="section-heading">
      <div><h2>ชุดสอบอื่นที่ทำได้</h2><p>คุณมีข้อสอบที่เปิดอยู่อีก ${otherExams.length} ชุด · เรียงตามความเร่งด่วนและกำหนดปิดรับ</p></div>
      <span class="badge badge--neutral">${icon('file-text', 11)} ${activeExams.length} ชุดที่ทำได้</span>
    </div>
    <div class="available-exams__grid">${otherExams.map(ex => availableExamCard(ex, session)).join('')}</div>
  </section>` : '';

  const historyRows = attempts.slice(0, 4).map(a => {
    const ex = db.exams.find(x => x.id === a.examId);
    if (!ex) return '';
    const st = statusForHistory(ex, a);
    const sc = attemptScore(ex, a);
    const canSeeScore = ex.status === 'announced' && ex.settings.showScore && a.status !== 'in_progress';
    const href = a.status === 'in_progress'
      ? `#/student/exam/${ex.id}/take`
      : ex.status === 'announced'
        ? `#/student/exam/${ex.id}/result`
        : `#/student/exam/${ex.id}/success`;
    return `<div class="history-row">
      <span class="history-icon">${icon(a.status === 'in_progress' ? 'timer' : ex.status === 'announced' ? 'award' : 'file-text', 18)}</span>
      <div class="history-row__main">
        <strong>${e(ex.title)}</strong>
        <span>${shortThaiDate(a.submittedAt || a.startedAt)} · ${a.status === 'in_progress' ? `ตอบแล้ว ${countAnswered(ex, a)}/${ex.questions.length}` : st.label}</span>
      </div>
      <div class="history-row__status">
        ${badge(st.label, st.tone)}
        ${canSeeScore ? `<div class="history-score"><strong>${formatNumber(sc.total, 1)}</strong><span>จาก ${sc.max}</span></div>` : `<div class="history-score"><strong style="color:var(--muted)">—</strong><span>${a.status === 'in_progress' ? 'ยังไม่ส่ง' : 'รอผล'}</span></div>`}
      </div>
      <a class="history-link" href="${href}" aria-label="ดูรายละเอียด ${e(ex.title)}">${icon('chevron-right', 17)}</a>
    </div>`;
  }).join('');

  let latestPanel = `<div class="quick-panel card">
    <div class="quick-panel__head"><h3>ผลสอบล่าสุด</h3><a href="#/student/history">ทั้งหมด ${icon('chevron-right', 12)}</a></div>
    <div class="empty-state" style="padding:25px 8px 18px">
      <span class="empty-state__icon" style="width:43px;height:43px">${icon('award', 20)}</span>
      <h3 style="font-size:12px">ยังไม่มีผลที่ประกาศ</h3>
      <p style="font-size:10px">คุณจะเห็นคะแนนที่นี่เมื่อครูประกาศผล</p>
    </div>
  </div>`;

  if (latest) {
    const sc = attemptScore(latest.exam, latest.attempt);
    const passed = sc.percent >= latest.exam.passPercent;
    latestPanel = `<div class="quick-panel card">
      <div class="quick-panel__head"><h3>ผลสอบล่าสุด</h3><a href="#/student/history">ทั้งหมด ${icon('chevron-right', 12)}</a></div>
      <a class="result-mini" href="#/student/exam/${latest.exam.id}/result">
        <span class="score-ring ${passed ? 'score-ring--success' : 'score-ring--warning'}" style="--ring-size:58px;--ring-value:${sc.percent}">
          <span class="score-ring__inner"><strong>${sc.percent}<span>%</span></strong></span>
        </span>
        <span class="result-mini__body">
          <small>${e(latest.exam.subject)}</small>
          <strong>${e(latest.exam.title)}</strong>
          <span>${badge(passed ? 'ผ่านเกณฑ์' : 'ต่ำกว่าเกณฑ์', passed ? 'success' : 'warning', false, 'badge--sm')} ${relativeTime(latest.exam.publishedAt)}</span>
        </span>
        <span class="result-mini__score"><strong>${formatNumber(sc.total, 1)}</strong><span>จาก ${sc.max}</span></span>
      </a>
      <div class="quick-links">
        <a class="quick-link" href="#/student/history">
          <span class="quick-link__icon">${icon('list-checks', 16)}</span>
          <span class="quick-link__copy"><strong>ประวัติการสอบ</strong><span>ดูผลย้อนหลังทั้งหมด</span></span>
          ${icon('chevron-right', 15)}
        </a>
        <a class="quick-link" href="#/student/exam/${latest.exam.id}/result">
          <span class="quick-link__icon">${icon('file-text', 16)}</span>
          <span class="quick-link__copy"><strong>ทบทวนคำตอบ</strong><span>ดูเฉลยและคำอธิบาย</span></span>
          ${icon('chevron-right', 15)}
        </a>
      </div>
    </div>`;
  }

  const content = `<main class="student-page">
    <div class="container">
      <div class="dashboard-heading">
        <div>
          <div class="eyebrow">${icon('sparkles', 12)} ${greetingByHour()} · ${thaiDate(now)}</div>
          <h1>สวัสดี, <span>${e(firstName(session.name))}</span></h1>
          <p>${activeExams.length > 1 ? `มีชุดสอบเปิดอยู่ ${activeExams.length} ชุด เลือกทำตามกำหนดปิดรับได้เลย` : activeExams.length ? 'มีชุดสอบเปิดอยู่ รักษาเวลาและสมาธิให้ดีนะ' : 'วันนี้ยังไม่มีกำหนดสอบ พักผ่อนและทบทวนบทเรียนได้เลย'}</p>
        </div>
        <div class="dashboard-date">${icon('calendar', 16)} ${longThaiDate(now)}</div>
      </div>
      <div class="dashboard-grid">
        <div class="stack">
          ${spotlight}
          ${examPicker}
          <section class="history-panel card">
            <div class="section-heading">
              <div><h2>ประวัติการสอบ</h2><p>ผลสอบและสถานะล่าสุดของคุณ</p></div>
              <a class="btn btn--link" href="#/student/history">ดูทั้งหมด ${icon('arrow-right', 14)}</a>
            </div>
            <div class="history-list">
              ${historyRows || emptyState({ iconName: 'clipboard-check', title: 'ยังไม่เคยเข้าสอบ', text: 'เมื่อเข้าสอบแล้ว ประวัติและผลสอบจะแสดงที่นี่' })}
            </div>
          </section>
        </div>
        <aside class="stack">
          ${latestPanel}
          <div class="quick-panel card">
            <div class="quick-panel__head"><h3>ก่อนเข้าสอบ</h3></div>
            <div class="quick-links">
              <a class="quick-link" href="#/student/history">
                <span class="quick-link__icon">${icon('book-open', 16)}</span>
                <span class="quick-link__copy"><strong>ทบทวนผลที่ผ่านมา</strong><span>ดูจุดที่ควรพัฒนา</span></span>
                ${icon('chevron-right', 15)}
              </a>
              <div class="quick-link" style="cursor:default">
                <span class="quick-link__icon">${icon('wifi-off', 16)}</span>
                <span class="quick-link__copy"><strong>เช็กอินเทอร์เน็ต</strong><span>คำตอบถูกบันทึกในเครื่องระหว่างสอบ</span></span>
                <span class="live-dot live-dot--small"><span></span>พร้อม</span>
              </div>
            </div>
          </div>
          <div class="notice-strip notice-strip--info">
            ${icon('info', 16)}
            <span><strong>ไม่เห็นคะแนนทันที?</strong> ระบบจะแสดงผลหลังครูตรวจและกดประกาศผลเท่านั้น</span>
          </div>
        </aside>
      </div>
    </div>
  </main>`;

  let heroTimer = null;
  return {
    html: studentShell(session, { active: 'dashboard', content }),
    mount() {
      mountStudentShell(session);
      document.querySelector('[data-role-btn]')?.setAttribute('aria-selected', 'true');
      if (mainExam) {
        heroTimer = setInterval(() => {
          const a = findStudentAttempt(mainExam.id, session);
          const win = examHeroWindow(mainExam, a);
          const p = formatClockParts(win.remaining);
          const main = document.querySelector('[data-hero-countdown-main]');
          const sub = document.querySelector('[data-hero-countdown-sub]');
          if (main) main.textContent = p.main;
          if (sub) sub.textContent = p.sub;
        }, 30_000);
      }
    },
    cleanup() {
      if (heroTimer) clearInterval(heroTimer);
    }
  };
}

export function instructionsView(ctx) {
  const { session, examId } = ctx;
  const exam = findExam(examId);
  if (!exam) {
    return {
      html: studentShell(session, { active: 'dashboard', content: `<main class="student-page"><div class="container">${emptyState({ iconName: 'file-text', title: 'ไม่พบชุดสอบ', text: 'ลิงก์นี้อาจไม่ถูกต้องหรือชุดสอบถูกลบแล้ว', action: '<a class="btn btn--primary" href="#/student">กลับหน้าหลัก</a>' })}</div></main>` }),
      mount: () => mountStudentShell(session)
    };
  }
  const attempt = findStudentAttempt(exam.id, session);
  if (!attempt && !isStudentAssigned(exam, session)) {
    return {
      html: studentShell(session, {
        active: 'dashboard',
        content: `<div class="instructions-shell">
          <a class="page-back" href="#/student">${icon('arrow-left', 15)} กลับหน้าหลัก</a>
          <div class="card">${emptyState({ iconName: 'lock', title: 'คุณไม่ได้รับสิทธิ์เข้าสอบชุดนี้', text: 'ครูผู้สอนกำหนดรายชื่อผู้เข้าสอบไว้แล้ว กรุณาติดต่อครูหากเข้าใจว่าเป็นความผิดพลาด', action: '<a class="btn btn--primary" href="#/student">กลับหน้าหลัก</a>' })}</div>
        </div>`
      }),
      mount: () => mountStudentShell(session)
    };
  }
  if (attempt?.status === 'in_progress') {
    setTimeout(() => navigate(`/student/exam/${exam.id}/take`), 0);
  } else if (attempt) {
    setTimeout(() => navigate(exam.status === 'announced' ? `/student/exam/${exam.id}/result` : `/student/exam/${exam.id}/success`), 0);
  }
  if (examAvailability(exam) !== 'open') {
    const availability = examAvailability(exam);
    return {
      html: studentShell(session, {
        active: 'dashboard',
        content: `<div class="instructions-shell">
          <a class="page-back" href="#/student">${icon('arrow-left', 15)} กลับหน้าหลัก</a>
          <div class="card">${emptyState({ iconName: 'lock', title: exam.status === 'announced' ? 'ชุดสอบนี้ประกาศผลแล้ว' : availability === 'upcoming' ? 'ชุดสอบยังไม่เปิด' : 'ชุดสอบนี้ปิดรับคำตอบแล้ว', text: 'ไม่สามารถเข้าสอบใหม่ได้ หากมีข้อสงสัยกรุณาติดต่อครูผู้สอน', action: `<a class="btn btn--primary" href="#/student">กลับหน้าหลัก</a>` })}</div>
        </div>`
      }),
      mount: () => mountStudentShell(session)
    };
  }
  const teacherNote = exam.instructions || 'ทำข้อสอบให้ครบทุกข้อ ห้ามเปิดแท็บอื่นระหว่างสอบ';
  const content = `<div class="instructions-shell">
    <a class="page-back" href="#/student">${icon('arrow-left', 15)} กลับหน้าหลัก</a>
    <div class="page-title-row">
      <div>
        <div class="eyebrow">${icon('file-text', 12)} คำชี้แจงก่อนสอบ</div>
        <h1>${e(exam.title)}</h1>
        <p>${mathText(exam.description || exam.topic || '')}</p>
      </div>
      <span class="badge badge--live"><span class="badge__dot"></span> เปิดสอบอยู่</span>
    </div>
    <div class="instructions-grid">
      <section class="instructions-main card">
        <div class="instructions-main__head">
          <span class="instructions-subject-icon">${icon(exam.subject === 'คณิตศาสตร์' ? 'chart' : 'book-open', 25)}</span>
          <div>
            <h1>${e(exam.title)}</h1>
            <p>${mathText(exam.topic || exam.subject)}${exam.level ? ` · ${e(exam.level)}` : ''}</p>
          </div>
        </div>
        <div class="instructions-meta">
          <div class="instruction-stat"><span>${icon('file-text', 11)} จำนวนข้อ</span><strong>${exam.questions.length} <small>ข้อ</small></strong></div>
          <div class="instruction-stat"><span>${icon('clock', 11)} เวลาทำ</span><strong>${exam.duration} <small>นาที</small></strong></div>
          <div class="instruction-stat"><span>${icon('award', 11)} คะแนนเต็ม</span><strong>${exam.totalPoints} <small>คะแนน</small></strong></div>
          <div class="instruction-stat"><span>${icon('rotate-ccw', 11)} สอบได้</span><strong>${exam.attemptsAllowed} <small>ครั้ง</small></strong></div>
        </div>
        <div class="instructions-section">
          <h2>${icon('clipboard-check', 16)} คำชี้แจงจากครู</h2>
          <div class="instruction-note">${mathText(teacherNote)}</div>
        </div>
        <div class="instructions-section">
          <h2>${icon('shield-check', 16)} สิ่งที่ควรรู้ก่อนเริ่ม</h2>
          <ul class="rule-list">
            <li>${icon('check', 14)} เมื่อกดเริ่มทำข้อสอบ ระบบจะเริ่มนับเวลาถอยหลังทันทีและไม่หยุดพัก</li>
            <li>${icon('check', 14)} เลือกคำตอบได้ครั้งละหนึ่งข้อ และเปลี่ยนคำตอบได้จนกว่าจะกดส่ง</li>
            <li>${icon('check', 14)} คำตอบจะถูกบันทึกอัตโนมัติ ไม่ต้องกดบันทึกด้วยตัวเอง</li>
            <li>${icon('check', 14)} เมื่อส่งคำตอบแล้วจะไม่สามารถแก้ไขได้ และต้องรอครูประกาศผล</li>
            <li>${icon('check', 14)} หากหมดเวลา ระบบจะส่งคำตอบที่มีอยู่ให้ครูโดยอัตโนมัติ</li>
          </ul>
        </div>
        <div class="agreement-box" id="agreement-box">
          <label class="check-row">
            <input type="checkbox" id="agree-check">
            <span class="check-box">${icon('check', 13)}</span>
            <span class="check-row__text">ข้าพเจ้ายอมรับข้อตกลงการสอบ และจะไม่เปิดแท็บอื่นหรือใช้อุปกรณ์อื่นช่วยทำข้อสอบ</span>
          </label>
        </div>
        <div class="instructions-actions">
          <button class="btn btn--primary btn--lg btn--wide" type="button" id="start-exam" disabled>${icon('play', 17)} เริ่มทำข้อสอบ</button>
          <div class="instructions-actions__hint">${icon('lock', 10)} ระบบบันทึกเวลาและกิจกรรมการสอบของคุณ</div>
        </div>
      </section>
      <aside class="instructions-side">
        <div class="teacher-card card">
          <div class="teacher-card__top">
            ${avatar(exam.teacherName, exam.teacherName, 'md')}
            <div class="teacher-card__copy"><strong>${e(exam.teacherName)}</strong><span>ครูผู้สอน · ${e(exam.subject)}</span></div>
          </div>
          <div class="teacher-card__quote">“${mathText(teacherNote)}”</div>
        </div>
        <div class="tip-card card">
          <h3>${icon('sparkles', 14)} เคล็ดลับทำคะแนน</h3>
          <ul>
            <li>อ่านโจทย์ให้จบก่อนดูตัวเลือก</li>
            <li>ข้อไหนไม่แน่ใจ ให้กดธงไว้แล้วกลับมาทบทวน</li>
            <li>เช็กเลขข้อที่ยังไม่ได้ตอบก่อนส่งทุกครั้ง</li>
          </ul>
        </div>
        <div class="secure-note">${icon('shield-check', 11)} การสอบของคุณถูกบันทึกอย่างปลอดภัย</div>
      </aside>
    </div>
  </div>`;

  return {
    html: studentShell(session, { active: 'dashboard', content }),
    mount() {
      mountStudentShell(session);
      const check = document.getElementById('agree-check');
      const box = document.getElementById('agreement-box');
      const start = document.getElementById('start-exam');
      if (!check || !start) return;
      check.addEventListener('change', () => {
        start.disabled = !check.checked;
        box.classList.toggle('is-checked', check.checked);
      });
      start.addEventListener('click', () => {
        if (!check.checked) return;
        const created = startAttempt(exam, session);
        if (!created) {
          toast('ชุดสอบนี้ปิดรับคำตอบแล้ว', 'warning');
          refreshRoute();
          return;
        }
        toast('เริ่มจับเวลาแล้ว ขอให้โชคดี!', 'success', 2600);
        navigate(`/student/exam/${exam.id}/take`);
      });
    }
  };
}

function questionTypeIcon(type) {
  return ({ mcq: 'list-checks', truefalse: 'check-circle', short: 'edit', essay: 'file-text' })[type] || 'file-text';
}

function questionMarkup(exam, attempt, idx) {
  const q = exam.questions[idx];
  const entry = attempt.answers?.[q.id] || {};
  const value = entry.value ?? '';
  const selected = value !== '';
  const flagged = Boolean(entry.flagged);
  const last = idx === exam.questions.length - 1;
  let answerArea = '';

  if (q.type === 'mcq') {
    answerArea = `<div class="answer-options" role="group" aria-label="ตัวเลือกคำตอบ">
      ${q.options.map(option => {
        const active = String(value) === String(option.id);
        return `<button type="button" class="answer-option ${active ? 'is-selected' : ''}" data-option="${e(option.id)}" aria-pressed="${active}">
          <span class="answer-option__key">${e(option.id)}</span>
          <span class="answer-option__text">${mathText(option.text)}</span>
          <span class="answer-option__check">${icon('check-circle', 16)}<span>เลือกแล้ว</span></span>
        </button>`;
      }).join('')}
    </div>`;
  } else if (q.type === 'truefalse') {
    answerArea = `<div class="tf-options" role="group" aria-label="เลือกถูกหรือผิด">
      ${[{ v: 'true', label: 'ถูกต้อง', sub: 'ข้อความนี้เป็นจริง', ic: 'check' }, { v: 'false', label: 'ไม่ถูกต้อง', sub: 'ข้อความนี้เป็นเท็จ', ic: 'x' }].map(opt => {
        const active = String(value) === opt.v;
        return `<button type="button" class="tf-option ${active ? 'is-selected' : ''}" data-tf="${opt.v}" aria-pressed="${active}">
          <span class="tf-option__icon">${icon(opt.ic, 21)}</span>
          <strong>${opt.label}</strong>
          <span>${opt.sub}</span>
        </button>`;
      }).join('')}
    </div>`;
  } else if (q.type === 'short') {
    answerArea = `<div class="short-answer-wrap">
      <div class="answer-field-label"><span>คำตอบของคุณ</span><span>กรอกคำตอบให้กระชับ</span></div>
      <input class="input" id="answer-${q.id}" data-answer-input="${q.id}" type="text" placeholder="พิมพ์คำตอบที่นี่..." value="${e(value)}" autocomplete="off" maxlength="120">
    </div>`;
  } else {
    answerArea = `<div class="essay-wrap">
      <div class="answer-field-label"><span>เขียนคำตอบของคุณ</span><span>ครูจะตรวจคำตอบนี้ด้วยตนเอง</span></div>
      <textarea class="textarea" id="answer-${q.id}" data-answer-input="${q.id}" placeholder="อธิบายขั้นตอนและคำตอบของคุณ..." maxlength="1500">${e(value)}</textarea>
      <div class="essay-toolbar"><span>${icon('info', 12)} เขียนให้ครบถ้วนเพื่อคะแนนที่ดีที่สุด</span><span data-char-count="${q.id}">${value.length} / 1500</span></div>
    </div>`;
  }

  return `<article class="question-card" id="question-card" data-qid="${q.id}">
    <div class="question-card__top">
      <div class="question-index">ข้อ <strong>${String(idx + 1).padStart(2, '0')}</strong> <span>/ ${exam.questions.length}</span></div>
      <span class="question-type-badge">${icon(questionTypeIcon(q.type), 13)} ${typeLabel(q.type)}</span>
    </div>
    <div class="question-body">
      <h2 class="question-text">${mathText(q.text)}</h2>
      <div class="question-points">${icon('award', 12)} ${q.points} คะแนน · ${typeHint(q.type)}</div>
      ${answerArea}
    </div>
    <div class="question-foot">
      <button type="button" class="flag-btn ${flagged ? 'is-flagged' : ''}" data-flag aria-pressed="${flagged}">
        ${icon('flag', 16)}<span>${flagged ? 'ทำเครื่องหมายไว้แล้ว' : 'ทำเครื่องหมายข้อนี้ไว้ก่อน'}</span>
      </button>
      <div class="question-nav">
        <button type="button" class="btn btn--ghost" data-prev ${idx === 0 ? 'disabled' : ''}>${icon('arrow-left', 15)} ก่อนหน้า</button>
        <button type="button" class="btn btn--primary" data-next>${last ? `ส่งคำตอบ ${icon('send', 15)}` : `ข้อถัดไป ${icon('arrow-right', 15)}`}</button>
      </div>
    </div>
  </article>`;
}

function mapMarkup(exam, attempt, idx) {
  return exam.questions.map((q, i) => {
    const entry = attempt.answers?.[q.id] || {};
    const answered = entry.value !== undefined && entry.value !== '';
    const flagged = Boolean(entry.flagged);
    const current = i === idx;
    const classes = ['map-num'];
    if (answered) classes.push('is-answered');
    if (flagged) classes.push('is-flagged');
    if (current) classes.push('is-current');
    return `<button type="button" class="${classes.join(' ')}" data-map-index="${i}" aria-label="ไปข้อ ${i + 1}${answered ? ' ตอบแล้ว' : ' ยังไม่ตอบ'}" aria-current="${current ? 'step' : 'false'}">${i + 1}${flagged ? '<span class="map-num__flag"></span>' : ''}</button>`;
  }).join('');
}

function examTimerMarkup() {
  return `<div class="exam-timer" data-exam-timer>
    <span class="exam-timer__icon">${icon('clock', 16)}</span>
    <span class="exam-timer__copy"><span>เวลาคงเหลือ</span><strong data-timer-text>--:--</strong></span>
  </div>`;
}

export function examView(ctx) {
  const { session, examId } = ctx;
  const exam = findExam(examId);
  if (!exam) {
    return {
      html: studentShell(session, { active: 'dashboard', content: `<main class="student-page"><div class="container">${emptyState({ iconName: 'file-text', title: 'ไม่พบชุดสอบ', text: 'ไม่พบข้อมูลชุดสอบนี้', action: '<a class="btn btn--primary" href="#/student">กลับหน้าหลัก</a>' })}</div></main>` }),
      mount: () => mountStudentShell(session)
    };
  }
  let attempt = findStudentAttempt(exam.id, session);
  if (!attempt) {
    setTimeout(() => navigate(`/student/exam/${exam.id}/instructions`), 0);
    return {
      html: studentShell(session, { active: 'dashboard', content: `<div class="success-page"><div class="page-loader"><span class="spinner"></span></div></div>` }),
      mount: () => {},
      cleanup: () => {}
    };
  }
  if (attempt.status !== 'in_progress') {
    setTimeout(() => navigate(exam.status === 'announced' ? `/student/exam/${exam.id}/result` : `/student/exam/${exam.id}/success`), 0);
    return {
      html: studentShell(session, { active: 'dashboard', content: `<div class="success-page"><div class="page-loader"><span class="spinner"></span></div></div>` }),
      mount: () => {},
      cleanup: () => {}
    };
  }
  if (new Date(attempt.endsAt).getTime() <= Date.now()) {
    submitAttempt(attempt, { auto: true });
    setTimeout(() => {
      toast('หมดเวลาสอบ ระบบส่งคำตอบให้แล้ว', 'warning', 4200);
      navigate(`/student/exam/${exam.id}/success`);
    }, 0);
    return {
      html: studentShell(session, { active: 'dashboard', content: `<div class="success-page"><div class="page-loader"><span class="spinner"></span></div></div>` }),
      mount: () => {},
      cleanup: () => {}
    };
  }

  attempt.answers = attempt.answers || {};
  attempt.antiCheat = attempt.antiCheat || [];
  let idx = Math.max(0, Math.min(Number(attempt.lastQuestion) || 0, exam.questions.length - 1));
  const answered = countAnswered(exam, attempt);

  const content = `<div class="exam-app">
    <header class="exam-topbar">
      <div class="exam-topbar__inner">
        <div class="exam-topbar__brand">${brand({ href: '#/student', subtitle: 'ห้องสอบ' })}</div>
        <div class="exam-topbar__title">
          <strong>${e(exam.title)}</strong>
          <span>${icon('user', 10)} ${e(session.name)} · ${e(exam.subject)}</span>
        </div>
        <div class="exam-topbar__center">
          <span class="save-state" data-save-state>${icon('cloud-check', 14)}<span data-save-text>บันทึกแล้ว</span></span>
          ${examTimerMarkup()}
        </div>
        <button class="btn btn--coral exam-topbar__submit" type="button" data-open-submit>${icon('send', 15)} <span class="btn-label">ส่งคำตอบ</span></button>
      </div>
      <div class="exam-topbar__progress"><span data-exam-progress style="width:${percent(answered, exam.questions.length)}%"></span></div>
    </header>
    <main class="exam-layout">
      <section class="exam-main">
        <div id="question-stage">${questionMarkup(exam, attempt, idx)}</div>
        <div class="keyboard-hint">กด <kbd>A</kbd>–<kbd>D</kbd> เพื่อเลือกคำตอบ · <kbd>←</kbd> <kbd>→</kbd> เพื่อเปลี่ยนข้อ · <kbd>F</kbd> เพื่อติดธง</div>
      </section>
      <aside class="exam-side">
        <div class="exam-user-card card">
          ${avatar(session.name, session.studentId || session.guestId, 'md')}
          <div class="exam-user-card__copy">
            <strong>${e(session.name)}</strong>
            <span>${e(currentClassLabel(session))} · ${exam.questions.length} ข้อ</span>
            <small>${icon('shield-check', 10)} อยู่ในโหมดสอบ</small>
          </div>
        </div>
        <div class="exam-map-card card">
          <div class="exam-map-head">
            <div><h3>แผนที่ข้อสอบ</h3><p>คลิกเพื่อข้ามไปข้อนั้น</p></div>
            <span class="exam-map-count" data-map-count>${countAnswered(exam, attempt)} / ${exam.questions.length}</span>
          </div>
          <div class="exam-map-grid" data-map-grid>${mapMarkup(exam, attempt, idx)}</div>
          <div class="exam-map-legend">
            <span class="legend-item"><span class="legend-swatch"></span>ยังไม่ตอบ</span>
            <span class="legend-item"><span class="legend-swatch legend-swatch--answered"></span>ตอบแล้ว</span>
            <span class="legend-item"><span class="legend-swatch legend-swatch--flagged"></span>ทำเครื่องหมาย</span>
            <span class="legend-item"><span class="legend-swatch legend-swatch--current"></span>ข้อปัจจุบัน</span>
          </div>
          <div class="exam-map-actions">
            <button class="btn btn--primary btn--sm btn--wide" type="button" data-open-submit>${icon('send', 14)} ตรวจทานและส่งคำตอบ</button>
          </div>
        </div>
        <div class="exam-side-note">${icon('info', 12)} ระบบบันทึกคำตอบอัตโนมัติทุกครั้งที่คุณเลือก ไม่ต้องกดบันทึก</div>
      </aside>
    </main>
  </div>`;

  return {
    html: `<div class="student-app student-exam">${content}</div>`,
    mount() {
      const stage = document.getElementById('question-stage');
      const mapGrid = document.querySelector('[data-map-grid]');
      const mapCard = document.querySelector('.exam-map-card');
      const timerEl = document.querySelector('[data-exam-timer]');
      const timerText = document.querySelector('[data-timer-text]');
      const saveState = document.querySelector('[data-save-state]');
      const progress = document.querySelector('[data-exam-progress]');
      const mapCount = document.querySelector('[data-map-count]');
      let saveTimer = null;
      let saveStatusTimer = null;
      let submitted = false;
      let shownTimeoutToast = false;

      function setSaveState(state) {
        if (!saveState) return;
        clearTimeout(saveStatusTimer);
        saveState.classList.remove('is-saving', 'is-error');
        if (state === 'saving') {
          saveState.classList.add('is-saving');
          saveState.innerHTML = `${icon('cloud', 14)}<span data-save-text>กำลังบันทึก...</span>`;
          saveStatusTimer = setTimeout(() => {
            saveState.classList.remove('is-saving');
            saveState.innerHTML = `${icon('cloud-check', 14)}<span data-save-text>บันทึกแล้ว</span>`;
          }, 650);
        } else if (state === 'error') {
          saveState.classList.add('is-error');
          saveState.innerHTML = `${icon('alert-circle', 14)}<span data-save-text>บันทึกไม่สำเร็จ</span>`;
        } else {
          saveState.innerHTML = `${icon('cloud-check', 14)}<span data-save-text>บันทึกแล้ว</span>`;
        }
      }

      function persistNow() {
        clearTimeout(saveTimer);
        attempt.updatedAt = new Date().toISOString();
        saveDB();
        setSaveState('saved');
      }

      function queuePersist() {
        setSaveState('saving');
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          attempt.updatedAt = new Date().toISOString();
          saveDB();
          setSaveState('saved');
        }, 280);
      }

      function refreshMap() {
        mapGrid.innerHTML = mapMarkup(exam, attempt, idx);
        const answeredCount = countAnswered(exam, attempt);
        mapCount.textContent = `${answeredCount} / ${exam.questions.length}`;
        progress.style.width = `${percent(answeredCount, exam.questions.length)}%`;
      }

      function refreshChoices() {
        const q = exam.questions[idx];
        const value = getAnswerValue(attempt, q.id);
        stage.querySelectorAll('[data-option]').forEach(btn => {
          const active = btn.dataset.option === String(value);
          btn.classList.toggle('is-selected', active);
          btn.setAttribute('aria-pressed', String(active));
        });
        stage.querySelectorAll('[data-tf]').forEach(btn => {
          const active = btn.dataset.tf === String(value);
          btn.classList.toggle('is-selected', active);
          btn.setAttribute('aria-pressed', String(active));
        });
      }

      function refreshFlagButton() {
        const q = exam.questions[idx];
        const flagged = Boolean(attempt.answers?.[q.id]?.flagged);
        const flag = stage.querySelector('[data-flag]');
        if (flag) {
          flag.classList.toggle('is-flagged', flagged);
          flag.setAttribute('aria-pressed', String(flagged));
          flag.innerHTML = `${icon('flag', 16)}<span>${flagged ? 'ทำเครื่องหมายไว้แล้ว' : 'ทำเครื่องหมายข้อนี้ไว้ก่อน'}</span>`;
        }
      }

      function setAnswer(qid, value) {
        const previous = attempt.answers[qid] || {};
        attempt.answers[qid] = { ...previous, value, answeredAt: new Date().toISOString(), flagged: Boolean(previous.flagged) };
        persistNow();
        refreshChoices();
        refreshMap();
      }

      function toggleFlag() {
        const q = exam.questions[idx];
        const entry = attempt.answers[q.id] || { value: '' };
        attempt.answers[q.id] = { ...entry, flagged: !entry.flagged };
        persistNow();
        refreshFlagButton();
        refreshMap();
      }

      function goTo(index) {
        const safe = Math.max(0, Math.min(index, exam.questions.length - 1));
        if (safe === idx) return;
        clearTimeout(saveTimer);
        idx = safe;
        attempt.lastQuestion = idx;
        persistNow();
        stage.innerHTML = questionMarkup(exam, attempt, idx);
        refreshMap();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function openSubmitModal() {
        const unansweredList = exam.questions.map((q, i) => ({ q, i })).filter(({ q }) => !isAnswered(attempt, q.id));
        const answeredCount = exam.questions.length - unansweredList.length;
        const flaggedCount = exam.questions.filter(q => attempt.answers?.[q.id]?.flagged).length;
        const body = `<div class="submit-summary">
          <span class="submit-summary__icon" style="${unansweredList.length ? 'background:var(--amber-soft);color:#7d5b1e' : ''}">${icon(unansweredList.length ? 'clipboard-check' : 'check-circle', 21)}</span>
          <span class="submit-summary__copy">
            <strong>คุณตอบแล้ว ${answeredCount} / ${exam.questions.length} ข้อ</strong>
            <span>${unansweredList.length ? `เหลืออีก ${unansweredList.length} ข้อที่ยังไม่ได้ตอบ` : 'ยอดเยี่ยม คุณตอบครบทุกข้อแล้ว'}</span>
          </span>
        </div>
        ${unansweredList.length ? `<div class="unanswered-box">
          <div class="unanswered-box__head">${icon('alert-triangle', 15)} ยังไม่ได้ตอบ ${unansweredList.length} ข้อ</div>
          <div class="unanswered-chips">${unansweredList.map(({ i }) => `<span class="unanswered-chip">ข้อ ${i + 1}</span>`).join('')}</div>
        </div>` : `<div class="notice-strip notice-strip--success">${icon('check-circle', 16)}<span>ตรวจทานอีกครั้งก่อนส่ง คำตอบทุกข้อถูกบันทึกเรียบร้อยแล้ว</span></div>`}
        ${flaggedCount ? `<div class="modal-note">${icon('flag', 14)} มี ${flaggedCount} ข้อที่คุณทำเครื่องหมายไว้ อย่าลืมกลับไปตรวจทาน</div>` : ''}
        <div class="modal-note">${icon('lock', 14)} เมื่อยืนยันส่งแล้ว จะไม่สามารถแก้ไขคำตอบได้อีก</div>`;

        openModal({
          title: 'ยืนยันการส่งคำตอบ?',
          eyebrow: 'ตรวจทานครั้งสุดท้าย',
          size: 'sm',
          body,
          footer: `<button class="btn btn--ghost" type="button" data-modal-close>${icon('arrow-left', 15)} กลับไปทำต่อ</button>
            <button class="btn btn--coral" type="button" data-confirm-submit>${icon('send', 15)} ยืนยันส่ง</button>`,
          onMount(overlay) {
            overlay.querySelector('[data-confirm-submit]').addEventListener('click', () => {
              closeModal();
              doSubmit(false);
            });
          }
        });
      }

      function doSubmit(auto = false) {
        if (submitted) return;
        submitted = true;
        clearTimeout(saveTimer);
        clearInterval(timer);
        window.removeEventListener('beforeunload', beforeUnload);
        document.removeEventListener('visibilitychange', onVisibility);
        submitAttempt(attempt, { auto });
        closeModal();
        if (auto) toast('หมดเวลาสอบ ระบบส่งคำตอบของคุณให้ครูแล้ว', 'warning', 5000);
        else toast('ส่งคำตอบเรียบร้อยแล้ว รอครูประกาศผล', 'success', 3500);
        navigate(`/student/exam/${exam.id}/success`);
      }

      // Answer choices
      stage.addEventListener('click', (ev) => {
        const option = ev.target.closest('[data-option]');
        if (option) { setAnswer(exam.questions[idx].id, option.dataset.option); return; }
        const tf = ev.target.closest('[data-tf]');
        if (tf) { setAnswer(exam.questions[idx].id, tf.dataset.tf); return; }
        if (ev.target.closest('[data-flag]')) { toggleFlag(); return; }
        if (ev.target.closest('[data-prev]')) { goTo(idx - 1); return; }
        if (ev.target.closest('[data-next]')) {
          if (idx === exam.questions.length - 1) openSubmitModal();
          else goTo(idx + 1);
        }
      });

      // Typed answers
      stage.addEventListener('input', (ev) => {
        const input = ev.target.closest('[data-answer-input]');
        if (!input) return;
        const qid = input.dataset.answerInput;
        const previous = attempt.answers[qid] || {};
        attempt.answers[qid] = { ...previous, value: input.value, answeredAt: new Date().toISOString(), flagged: Boolean(previous.flagged) };
        const count = stage.querySelector(`[data-char-count="${qid}"]`);
        if (count) count.textContent = `${input.value.length} / 1500`;
        queuePersist();
        refreshMap();
      });
      stage.addEventListener('focusout', (ev) => {
        if (ev.target.closest('[data-answer-input]')) persistNow();
      });

      mapGrid.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-map-index]');
        if (btn) goTo(Number(btn.dataset.mapIndex));
      });
      mapCard.querySelectorAll('[data-open-submit]').forEach(btn => btn.addEventListener('click', openSubmitModal));
      document.querySelectorAll('[data-open-submit]').forEach(btn => {
        if (!btn.closest('.exam-map-card')) btn.addEventListener('click', openSubmitModal);
      });

      // Timer
      function updateTimer() {
        const remaining = new Date(attempt.endsAt).getTime() - Date.now();
        timerText.textContent = formatDuration(remaining);
        timerEl.classList.toggle('is-warning', remaining <= 5 * 60_000);
        if (remaining <= 0) {
          if (!shownTimeoutToast) {
            shownTimeoutToast = true;
            doSubmit(true);
          }
          return;
        }
        if (remaining <= 60_000 && !timerEl.classList.contains('is-final')) {
          timerEl.classList.add('is-final');
        }
      }
      const timer = setInterval(updateTimer, 1000);
      updateTimer();

      // Tab visibility – lightweight anti-cheat logging
      let hiddenLogged = false;
      function onVisibility() {
        if (document.hidden && !hiddenLogged && attempt.status === 'in_progress') {
          hiddenLogged = true;
          logAntiCheat(attempt, 'tab_blur', 'สลับออกจากหน้าสอบ');
        } else if (!document.hidden && hiddenLogged) {
          hiddenLogged = false;
          toast('ระบบบันทึกการออกจากหน้าสอบไว้แล้ว', 'warning', 2800);
        }
      }
      document.addEventListener('visibilitychange', onVisibility);

      function beforeUnload(ev) {
        if (attempt.status === 'in_progress' && !submitted) {
          ev.preventDefault();
          ev.returnValue = '';
          return '';
        }
      }
      window.addEventListener('beforeunload', beforeUnload);

      // Keyboard shortcuts
      function onKeydown(ev) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
        if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
        const q = exam.questions[idx];
        const key = ev.key.toUpperCase();
        if (q.type === 'mcq' && ['A', 'B', 'C', 'D'].includes(key)) {
          const choice = q.options.find(o => o.id === key);
          if (choice) { ev.preventDefault(); setAnswer(q.id, key); }
        } else if (q.type === 'truefalse' && (key === '1' || key === '2')) {
          ev.preventDefault(); setAnswer(q.id, key === '1' ? 'true' : 'false');
        } else if (ev.key === 'ArrowRight') {
          ev.preventDefault();
          if (idx < exam.questions.length - 1) goTo(idx + 1);
          else openSubmitModal();
        } else if (ev.key === 'ArrowLeft') {
          ev.preventDefault(); goTo(idx - 1);
        } else if (key === 'F') {
          ev.preventDefault(); toggleFlag();
        }
      }
      document.addEventListener('keydown', onKeydown);

      // Make sure state is retained on navigation / refresh
      window.addEventListener('pagehide', persistNow, { once: true });

      return () => {
        clearInterval(timer);
        clearTimeout(saveTimer);
        clearTimeout(saveStatusTimer);
        document.removeEventListener('visibilitychange', onVisibility);
        document.removeEventListener('keydown', onKeydown);
        window.removeEventListener('beforeunload', beforeUnload);
        if (!submitted) persistNow();
      };
    },
    cleanup: null
  };
}

export function successView(ctx) {
  const { session, examId } = ctx;
  const exam = findExam(examId);
  const attempt = exam ? findStudentAttempt(exam.id, session) : null;
  if (!exam || !attempt) {
    setTimeout(() => navigate('/student'), 0);
    return { html: studentShell(session, { active: 'dashboard', content: '' }), mount: () => {} };
  }
  if (attempt.status === 'in_progress') {
    setTimeout(() => navigate(`/student/exam/${exam.id}/take`), 0);
    return { html: studentShell(session, { active: 'dashboard', content: '' }), mount: () => {} };
  }
  const answered = countAnswered(exam, attempt);
  const submittedAt = attempt.submittedAt || new Date().toISOString();
  const isAnnounced = exam.status === 'announced';
  const used = attempt.timeUsedSec || Math.max(1, Math.round((new Date(attempt.submittedAt) - new Date(attempt.startedAt)) / 1000));
  const content = `<main class="success-page">
    <div class="success-card">
      <div class="success-card__content">
        <div class="success-mark">${icon('check', 36)}</div>
        <h1>${attempt.autoSubmitted ? 'หมดเวลาสอบ' : 'ส่งคำตอบสำเร็จ'}</h1>
        <p>${attempt.autoSubmitted
          ? 'ระบบส่งคำตอบที่มีอยู่ให้ครูโดยอัตโนมัติแล้ว<br>คำตอบที่บันทึกไว้ก่อนหมดเวลาถูกจัดเก็บครบถ้วน'
          : 'คำตอบของคุณถูกส่งถึงครูแล้ว<br>ผลสอบจะแสดงให้เห็นเมื่อครูประกาศผล'}</p>
        ${attempt.autoSubmitted ? `<div class="notice-strip notice-strip--info success-auto-note">${icon('clock', 15)}<span>ใช้เวลาจนครบ ${exam.duration} นาที · ระบบส่งอัตโนมัติ</span></div>` : ''}
        <div class="success-receipt">
          <div class="success-receipt__row"><span>วิชา</span><strong>${e(exam.title)}</strong></div>
          <div class="success-receipt__row"><span>ส่งเมื่อ</span><strong>${thaiDateTime(submittedAt)}</strong></div>
          <div class="success-receipt__row"><span>คำตอบที่ส่ง</span><strong>${answered} / ${exam.questions.length} ข้อ</strong></div>
          <div class="success-receipt__row"><span>เวลาที่ใช้</span><strong>${formatStopwatch(used)}</strong></div>
        </div>
        <div class="success-pending">
          ${icon(isAnnounced ? 'award' : 'clock', 20)}
          <span><strong>${isAnnounced ? 'ครูประกาศผลแล้ว' : 'สถานะ: รอประกาศผล'}</strong><span>${isAnnounced ? 'ตรวจดูคะแนนและเฉลยของคุณได้เลย' : 'คุณจะได้รับการแจ้งเตือนเมื่อครูประกาศผลสอบ'}</span></span>
        </div>
        <div class="success-card__actions">
          <a class="btn btn--ghost" href="#/student">กลับหน้าหลัก</a>
          ${isAnnounced
            ? `<a class="btn btn--primary" href="#/student/exam/${exam.id}/result">${icon('award', 16)} ดูผลสอบ</a>`
            : `<a class="btn btn--primary" href="#/student/history">${icon('list-checks', 16)} ดูประวัติการสอบ</a>`}
        </div>
      </div>
    </div>
  </main>`;
  return {
    html: studentShell(session, { active: 'dashboard', content }),
    mount: () => mountStudentShell(session)
  };
}

export function resultView(ctx) {
  const { session, examId } = ctx;
  const exam = findExam(examId);
  const attempt = exam ? findStudentAttempt(exam.id, session) : null;
  if (!exam || !attempt) {
    setTimeout(() => navigate('/student'), 0);
    return { html: studentShell(session, { active: 'dashboard', content: '' }), mount: () => {} };
  }
  if (attempt.status === 'in_progress') {
    setTimeout(() => navigate(`/student/exam/${exam.id}/take`), 0);
    return { html: studentShell(session, { active: 'dashboard', content: '' }), mount: () => {} };
  }
  if (exam.status !== 'announced') {
    const content = `<main class="student-page"><div class="container">
      <a class="page-back" href="#/student">${icon('arrow-left', 15)} กลับหน้าหลัก</a>
      <div class="card">${emptyState({
        iconName: 'clock',
        title: 'ยังไม่ประกาศผลสอบ',
        text: 'ครูยังไม่ได้กดประกาศผลสำหรับชุดสอบนี้ คุณจะเห็นคะแนนทันทีเมื่อครูเปิดเผยผล',
        action: `<a class="btn btn--primary" href="#/student">กลับหน้าหลัก</a>`
      })}</div>
    </div></main>`;
    return { html: studentShell(session, { active: 'dashboard', content }), mount: () => mountStudentShell(session) };
  }

  markNoticeRead(session, `pub-${exam.id}`);
  const score = attemptScore(exam, attempt);
  const pending = score.pending.length > 0;
  const passed = score.percent >= exam.passPercent;
  const showScore = exam.settings?.showScore !== false;
  const showSolutions = exam.settings?.showSolutions !== false;
  const showRank = Boolean(exam.settings?.showRank);
  const essayPoints = exam.questions.filter(q => q.type === 'essay').reduce((sum, q) => sum + q.points, 0);
  const objectivePoints = score.max - essayPoints;
  const used = attempt.timeUsedSec || Math.max(1, Math.round((new Date(attempt.submittedAt) - new Date(attempt.startedAt)) / 1000));
  const ranking = rankAttempts(exam);
  const rank = ranking.findIndex(r => r.attempt.id === attempt.id) + 1;
  const dialValue = showScore ? score.percent : 0;

  const reviewItems = exam.questions.map((q, i) => {
    const value = getAnswerValue(attempt, q.id);
    const manual = attempt.manualScores?.[q.id];
    let status = 'wrong';
    let statusLabel = 'ตอบผิด';
    let pointsLabel = '';
    if (q.type === 'essay') {
      if (!manual) { status = 'pending'; statusLabel = 'รอตรวจ'; }
      else if (Number(manual.score) >= q.points * 0.6) { status = 'correct'; statusLabel = 'ผ่าน'; }
      else { status = 'wrong'; statusLabel = 'ควรปรับปรุง'; }
      pointsLabel = showScore ? (manual ? `${formatNumber(manual.score, 1)} / ${q.points} คะแนน` : `รอตรวจ · ${q.points} คะแนน`) : '—';
    } else {
      const ok = isCorrect(q, value);
      status = ok ? 'correct' : 'wrong';
      statusLabel = ok ? 'ถูกต้อง' : 'ตอบผิด';
      pointsLabel = showScore ? `${ok ? q.points : 0} / ${q.points} คะแนน` : '—';
    }
    const iconName = status === 'correct' ? 'check' : status === 'wrong' ? 'x' : 'clock';
    const detail = showSolutions ? `<div class="review-detail">
      <div class="review-detail__q">${mathText(q.text)}</div>
      <div class="answer-line"><span>คำตอบของคุณ</span><strong>${mathText(answerText(q, value))}</strong></div>
      ${status !== 'correct' && q.type !== 'essay' ? `<div class="answer-line answer-line--solution"><span>คำตอบที่ถูก</span><strong>${mathText(correctAnswerText(q))}</strong></div>` : ''}
      ${q.type === 'essay' ? `<div class="answer-line answer-line--solution"><span>แนวคำตอบ</span><strong>${mathText(q.reference || '—')}</strong></div>` : ''}
      ${q.type === 'essay' && manual?.comment ? `<div class="teacher-comment"><strong>${icon('message-circle', 12)} ความคิดเห็นจากครู</strong>${e(manual.comment)}</div>` : ''}
      ${q.explanation ? `<div class="answer-explanation">${icon('info', 13)}<span>${mathText(q.explanation)}</span></div>` : ''}
      <div class="answer-line" style="margin-top:6px"><span>คะแนนข้อนี้</span><strong>${pointsLabel}</strong></div>
    </div>` : '';
    return `<details class="review-item">
      <summary>
        <span class="review-status review-status--${status}">${icon(iconName, 13)}</span>
        <span class="review-summary"><strong>ข้อ ${i + 1} · ${statusLabel}</strong><span>${e(typeLabel(q.type))} · ${mathText(q.text)}</span></span>
        <span class="review-mark">${pointsLabel}</span>
        ${icon('chevron-down', 14)}
      </summary>
      ${detail}
    </details>`;
  }).join('');

  const teacherComments = exam.questions
    .filter(q => q.type === 'essay' && attempt.manualScores?.[q.id]?.comment)
    .map(q => `<div class="answer-explanation" style="margin-top:8px">${icon('message-circle', 13)}<span>${e(attempt.manualScores[q.id].comment)}</span></div>`)
    .join('');

  const content = `<main class="result-shell result-page">
    ${makePrintHeader(`ผลสอบ ${exam.title}`, `${session.name} · ${thaiDate(exam.publishedAt || new Date())}`)}
    <a class="page-back no-print" href="#/student">${icon('arrow-left', 15)} กลับหน้าหลัก</a>
    <section class="result-hero">
      <div class="result-hero__main">
        <div class="result-hero__eyebrow">${icon('award', 13)} ผลการสอบ · ${e(exam.subject)}</div>
        <h1>${e(exam.title)}</h1>
        <div class="result-hero__meta">
          <span>${icon('user', 11)} ${e(session.name)}</span>
          <span>${icon('calendar', 11)} ${thaiDate(exam.publishedAt || new Date())}</span>
          <span>${icon('clock', 11)} ใช้เวลา ${formatStopwatch(used)}</span>
        </div>
        ${!showScore
          ? `<div class="result-status result-status--pending">${icon('award', 15)} ประกาศผลแล้ว · ครูเลือกไม่แสดงคะแนน</div>`
          : pending
            ? `<div class="result-status result-status--pending">${icon('clock', 15)} ประกาศผลแล้ว · รอตรวจข้ออัตนัย</div>`
            : `<div class="result-status ${passed ? 'result-status--pass' : 'result-status--fail'}">${icon(passed ? 'check-circle' : 'alert-circle', 15)} ${passed ? `ผ่านเกณฑ์ (เกณฑ์ผ่าน ${exam.passPercent}%)` : `ต่ำกว่าเกณฑ์ (เกณฑ์ผ่าน ${exam.passPercent}%)`}</div>`}
      </div>
      <div class="result-score">
        ${showScore ? `<div class="score-dial ${pending ? '' : passed ? 'score-dial--pass' : 'score-dial--fail'}" style="--value:${dialValue}"><div class="score-dial__inner"><strong>${formatNumber(score.total, 1)}</strong><span>จาก ${score.max} คะแนน</span><small>${score.percent}%</small></div></div>
        <div class="result-hero__date">${e(session.studentCode || '')}</div>` : `<div class="score-dial" style="--value:0"><div class="score-dial__inner"><strong>—</strong><span>ไม่เปิดเผยคะแนน</span></div></div>`}
      </div>
    </section>
    <div class="result-toolbar no-print">
      <div class="result-toolbar__left">${icon('shield-check', 14)} ผลสอบได้รับการยืนยันจากครูแล้ว ${pending ? '· คะแนนอัตนัยอาจเปลี่ยนแปลง' : ''}</div>
      <div class="result-toolbar__actions">
        <a class="btn btn--ghost btn--sm" href="#/student/history">${icon('list-checks', 14)} ประวัติการสอบ</a>
        <button class="btn btn--primary btn--sm" type="button" data-print>${icon('download', 14)} ดาวน์โหลด PDF</button>
      </div>
    </div>
    <div class="result-grid">
      <div class="result-main">
        <section class="result-card card">
          <div class="result-card__head">
            <div><h2>รายละเอียดคำตอบ</h2><p>${showSolutions ? 'ตรวจทานคำตอบและคำอธิบายรายข้อ' : 'ครูเลือกไม่แสดงเฉลยสำหรับชุดสอบนี้'}</p></div>
            ${showScore ? `<span class="badge ${passed ? 'badge--success' : 'badge--warning'}">${formatNumber(score.total, 1)} / ${score.max} คะแนน</span>` : ''}
          </div>
          ${showSolutions ? `<div class="review-list">${reviewItems}</div>` : `<div class="solution-hidden">${icon('lock', 16)} ครูยังไม่เปิดให้ดูเฉลยรายข้อสำหรับการสอบครั้งนี้</div>`}
        </section>
      </div>
      <aside class="result-side">
        <div class="card result-rank-card">
          <h3>สรุปคะแนน</h3>
          ${showScore ? `
          <div class="result-summary-line"><span>ปรนัย + เติมคำ</span><strong>${formatNumber(score.auto, 1)} / ${objectivePoints}</strong></div>
          ${essayPoints ? `<div class="result-summary-line"><span>ข้ออัตนัย</span><strong>${formatNumber(score.manual, 1)} / ${essayPoints}</strong></div>` : ''}
          <div class="result-summary-line"><span>รวมทั้งหมด</span><strong>${formatNumber(score.total, 1)} / ${score.max}</strong></div>
          <div class="result-summary-line"><span>เกณฑ์ผ่าน</span><strong>${exam.passPercent}%</strong></div>
          ${score.overridden ? `<div class="result-summary-line"><span>หมายเหตุ</span><strong>ครูปรับคะแนนแล้ว</strong></div>` : ''}`
          : `<div class="notice-strip notice-strip--info">${icon('lock', 14)}<span>ครูเลือกไม่แสดงคะแนนสำหรับชุดสอบนี้</span></div>`}
          <div class="result-summary-line"><span>ตอบแล้ว</span><strong>${countAnswered(exam, attempt)} / ${exam.questions.length} ข้อ</strong></div>
          ${teacherComments ? `<div class="result-summary-line" style="display:block"><span style="display:block;margin-bottom:5px">ความคิดเห็นจากครู</span>${teacherComments}</div>` : ''}
        </div>
        ${showRank && showScore && rank > 0 ? `<div class="card result-rank-card">
          <h3>อันดับในห้อง</h3>
          <div class="rank-big"><strong>${rank}</strong><span>/ ${ranking.length} คน</span></div>
          <div class="rank-note">อันดับคำนวณจากคะแนนรวมของผู้เข้าสอบทุกคนในชุดสอบนี้</div>
        </div>` : ''}
        <div class="card">
          <h3>ข้อมูลการสอบ</h3>
          <div class="result-summary-line"><span>ส่งเมื่อ</span><strong>${thaiTime(attempt.submittedAt)} น.</strong></div>
          <div class="result-summary-line"><span>ประกาศผล</span><strong>${thaiDate(exam.publishedAt || new Date())}</strong></div>
          <div class="result-summary-line"><span>ผู้สอน</span><strong>${e(exam.teacherName.split(' ')[0])}</strong></div>
          <div class="result-share-note">${icon('info', 12)} ${pending ? 'ข้ออัตนัยอยู่ระหว่างการตรวจ คะแนนอาจเปลี่ยนแปลง' : 'หากมีข้อสงสัยเกี่ยวกับผลสอบ กรุณาติดต่อครูผู้สอน'}</div>
        </div>
      </aside>
    </div>
  </main>`;
  return {
    html: studentShell(session, { active: 'dashboard', content }),
    mount() {
      mountStudentShell(session);
      const openAllReviews = () => {
        document.querySelectorAll('.review-item:not([open])').forEach(item => {
          item.dataset.printOpened = '1';
          item.open = true;
        });
      };
      const restoreReviews = () => {
        document.querySelectorAll('.review-item[data-print-opened="1"]').forEach(item => {
          item.open = false;
          delete item.dataset.printOpened;
        });
      };
      const printButton = document.querySelector('[data-print]');
      const onPrint = () => {
        openAllReviews();
        toast('กำลังเปิดหน้าต่างพิมพ์ — เลือก “บันทึกเป็น PDF” ได้เลย', 'info', 3200);
        setTimeout(() => window.print(), 300);
      };
      printButton?.addEventListener('click', onPrint);
      window.addEventListener('beforeprint', openAllReviews);
      window.addEventListener('afterprint', restoreReviews);
      return () => {
        printButton?.removeEventListener('click', onPrint);
        window.removeEventListener('beforeprint', openAllReviews);
        window.removeEventListener('afterprint', restoreReviews);
      };
    }
  };
}

function shorten(text = '', length = 60) {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function historyView(ctx) {
  const { session } = ctx;
  const db = getDB();
  const attempts = getStudentAttempts(session);
  const items = attempts.map(a => ({ attempt: a, exam: db.exams.find(e => e.id === a.examId) })).filter(x => x.exam);
  const graded = items.filter(x => x.exam.status === 'announced' && x.exam.settings?.showScore !== false && x.attempt.status !== 'in_progress');
  const averages = graded.map(x => attemptScore(x.exam, x.attempt).percent);
  const avg = averages.length ? Math.round(averages.reduce((a, b) => a + b, 0) / averages.length) : 0;
  const best = averages.length ? Math.max(...averages) : 0;

  const rows = items.map(({ attempt: a, exam: ex }) => {
    const st = statusForHistory(ex, a);
    const sc = attemptScore(ex, a);
    const canSee = ex.status === 'announced' && ex.settings.showScore && a.status !== 'in_progress';
    const href = a.status === 'in_progress'
      ? `#/student/exam/${ex.id}/take`
      : ex.status === 'announced'
        ? `#/student/exam/${ex.id}/result`
        : `#/student/exam/${ex.id}/success`;
    return `<a class="history-exam-card" href="${href}">
      <span class="history-exam-card__icon">${icon(a.status === 'in_progress' ? 'timer' : ex.status === 'announced' ? 'award' : 'file-text', 20)}</span>
      <div class="history-exam-card__main">
        <strong>${e(ex.title)}</strong>
        <span>${badge(st.label, st.tone, false, 'badge--sm')} <i></i> ${a.status === 'in_progress' ? `ตอบแล้ว ${countAnswered(ex, a)}/${ex.questions.length}` : thaiDateTime(a.submittedAt)}</span>
      </div>
      <div class="history-exam-card__score">
        <strong>${canSee ? `${formatNumber(sc.total, 1)}/${sc.max}` : '—'}</strong>
        <span>${canSee ? `${sc.percent}%` : a.status === 'in_progress' ? 'กำลังทำ' : 'รอประกาศ'}</span>
      </div>
      <span class="history-exam-card__action">${icon('chevron-right', 18)}</span>
    </a>`;
  }).join('');

  const content = `<main class="history-page">
    <a class="page-back" href="#/student">${icon('arrow-left', 15)} กลับหน้าหลัก</a>
    <div class="page-title-row">
      <div><div class="eyebrow">${icon('list-checks', 12)} บันทึกของฉัน</div><h1>ประวัติการสอบ</h1><p>ผลคะแนนและสถานะการสอบย้อนหลังทั้งหมด</p></div>
    </div>
    <div class="history-summary">
      <div class="history-stat"><span>${icon('clipboard-check', 11)} การสอบทั้งหมด</span><strong>${items.length} <small>ครั้ง</small></strong></div>
      <div class="history-stat"><span>${icon('bar-chart', 11)} คะแนนเฉลี่ย (ที่ประกาศผล)</span><strong>${avg} <small>%</small></strong></div>
      <div class="history-stat"><span>${icon('award', 11)} คะแนนสูงสุด</span><strong>${best} <small>%</small></strong></div>
    </div>
    <div class="section-heading" style="margin-bottom:12px"><div><h2 style="font-size:16px">รายการสอบ</h2></div><span class="badge badge--neutral">${items.length} รายการ</span></div>
    <div class="history-card-list">
      ${rows || `<div class="card">${emptyState({ iconName: 'clipboard-check', title: 'ยังไม่มีประวัติการสอบ', text: 'เข้าสอบชุดแรกของคุณได้จากหน้าหลัก', action: '<a class="btn btn--primary" href="#/student">กลับหน้าหลัก</a>' })}</div>`}
    </div>
  </main>`;
  return {
    html: studentShell(session, { active: 'history', content }),
    mount: () => mountStudentShell(session)
  };
}
