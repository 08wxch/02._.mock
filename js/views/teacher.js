import { icon } from '../icons.js';
import { cloudSetPassword, cloudGetPassword } from '../cloud.js';
import {
  e, thaiDate, thaiDateTime, thaiTime, shortThaiDate, longThaiDate,
  relativeTime, formatNumber, formatStopwatch, percent, clamp,
  typeLabel, downloadFile, csvCell, makePrintHeader, statusMeta, copyText
} from '../utils.js';
import {
  brand, avatar, badge, toast, openModal, closeModal, confirmDialog,
  notificationBell, mountNotificationBell, mountCopyButtons, emptyState,
  searchInput, mountPrintButtons, ringScore
} from '../ui.js';
import {
  getDB, findExam, participantRows, examMetrics, totalPendingReview,
  attemptScore, attemptStatusMeta, questionStats, scoreDistribution,
  rankAttempts, getNotifications, saveDB, addNotice, getExamAttempts,
  pendingEssayQuestions, answerText, correctAnswerText, getAnswerValue,
  isCorrect, clearSession, currentStudentKey, submitAttempt,
  addStudent, removeStudent, deleteExam, addClass, addClassAcrossOrganizations, renameClass, deleteClass,
  setStudentClasses, classIdsOf, classCodesOf, studentsInClass,
  currentTeacher, isOwnerTeacher, visibleExams, canViewExam, canManageExam,
  canEditExam, canViewExamStats, isManagerStaff, visibleStaff, visibleStudents,
  visibleClasses, canAccessStudent, findOrganization,
  organizationName, addOrganization, updateOrganization, deleteOrganization, creatorOfExam,
  updateStudentOrg, addTeacher, nextTeacherCode, generateStudentCode,
  generateStudentPassword, staffCodePrefix, updateTeacherOrg, removeTeacher,
  examOrganizationName, examOrganizationId, examOrganizationIds, setTeacherPassword, setTeacherCode, setStudentCode, setTeacherRole,
  hasAllOrganizationAccess, canManageOrganizations, organizationAccessLevel
} from '../store.js';
import { cloudLogout } from '../cloud.js';
import { mathText } from '../math.js';
import { questionImageHTML, optionImageHTML } from '../questionMedia.js';
import { navigate, refreshRoute } from '../router.js';
import { openAccountProfile } from '../profile.js';

export function teacherShell(session, { active = 'dashboard', crumb = 'ภาพรวม', content = '' } = {}) {
  const db = getDB();
  const teacher = currentTeacher(session) || db.teacher;
  const owner = Boolean(teacher?.isOwner);
  const pending = totalPendingReview(session);
  const notices = getNotifications(session);
  const activeExam = visibleExams(session, db).find(x => x.status === 'open' && x.teacherId === session.teacherId);
  const navItems = [
    { key: 'dashboard', href: '#/teacher', icon: 'layout-dashboard', label: 'ภาพรวม' },
    { key: 'analytics', href: '#/teacher/analytics', icon: 'chart', label: 'สถิติรวม' },
    { key: 'exams', href: '#/teacher/exams', icon: 'file-text', label: 'ชุดสอบทั้งหมด' },
    { key: 'review', href: '#/teacher/review', icon: 'clipboard-check', label: 'ตรวจคำตอบ', badge: pending },
    { key: 'students', href: '#/teacher/students', icon: 'users', label: 'นักเรียน' },
    { key: 'staff', href: '#/teacher/staff', icon: 'school', label: 'ครูและบุคลากร' }
  ];
  return `<div class="teacher-app">
    <div class="sidebar-backdrop" data-sidebar-close></div>
    <aside class="teacher-sidebar" id="teacher-sidebar">
      <div class="sidebar__brand">
        ${brand({ href: '#/teacher', variant: 'light', subtitle: 'สำหรับครูและผู้จัดการ' })}
      </div>
      <div class="sidebar__label">พื้นที่ทำงาน</div>
      <nav class="side-nav" aria-label="เมนูครู">
        ${navItems.map(item => `<a href="${item.href}" class="${active === item.key ? 'is-active' : ''}">
          ${icon(item.icon, 18)}<span>${item.label}</span>
          ${item.badge ? `<span class="side-nav__badge">${item.badge > 99 ? '99+' : item.badge}</span>` : ''}
        </a>`).join('')}
      </nav>
      <div class="sidebar__divider"></div>
      <div class="sidebar__label">ทางลัด</div>
      <nav class="side-nav">
        <a href="#/teacher/create">${icon('plus', 18)}<span>สร้างชุดสอบใหม่</span></a>
        <a href="#/teacher/review">${icon('chart', 18)}<span>คิวตรวจคำตอบ</span></a>
      </nav>
      ${activeExam ? `<div class="sidebar-quick">
        <div class="sidebar-quick__top"><span>กำลังเปิดสอบ</span><span class="live-dot live-dot--small live-dot--light"><span></span>Live</span></div>
        <h3>${e(activeExam.title)}</h3>
        <div class="sidebar-quick__meta"><span>${icon('users', 10)} ${examMetrics(activeExam).submitted} ส่งแล้ว</span><span>${icon('clock', 10)} ${activeExam.duration} นาที</span></div>
        <a class="btn" href="#/teacher/exam/${activeExam.id}/students">${icon('monitor', 12)} ดูความคืบหน้า</a>
      </div>` : `<div class="sidebar-quick">
        <div class="sidebar-quick__top"><span>ห้องสอบ</span></div>
        <h3>ยังไม่มีการทดสอบต่อไป</h3>
        <div class="sidebar-quick__meta"><span>${icon('info', 10)} เฉพาะชุดสอบที่คุณสร้างเอง</span></div>
        <a class="btn" href="#/teacher/create">${icon('plus', 12)} สร้างชุดสอบ</a>
      </div>`}
      <div class="sidebar-profile">
        ${avatar(teacher.name, teacher.id, 'sm')}
        <button class="sidebar-profile__copy" type="button" data-open-teacher-profile aria-label="เปิดข้อมูลบัญชีของฉัน" title="ดูข้อมูลบัญชี"><strong>${e(teacher.name)}</strong><span>${e(teacher.school || 'ไม่ระบุโรงเรียน')}</span></button>
        <div class="sidebar-profile__actions">
          <button class="icon-btn" type="button" data-logout title="ออกจากระบบ" aria-label="ออกจากระบบ">${icon('logout', 14)}</button>
        </div>
      </div>
    </aside>
    <div class="teacher-main">
      <header class="teacher-topbar">
        <button class="icon-btn teacher-topbar__menu" type="button" data-sidebar-toggle aria-label="เปิดเมนู">${icon('menu', 19)}</button>
        <div class="breadcrumb">
          <a href="#/teacher">${icon('layout-dashboard', 13)} หลังบ้านครู</a>
          ${icon('chevron-right', 11)}
          <strong>${e(crumb)}</strong>
        </div>
        <div class="teacher-topbar__right">
          ${notificationBell({ session, items: notices, mode: 'teacher' })}
          <a class="icon-btn" href="#/teacher/create" aria-label="สร้างชุดสอบใหม่" title="สร้างชุดสอบใหม่">${icon('plus', 18)}</a>
        </div>
      </header>
      <div class="teacher-content">${content}</div>
    </div>
  </div>`;
}

export function mountTeacherShell(session) {
  mountNotificationBell(document);
  mountCopyButtons(document);
  mountPrintButtons(document);
  document.querySelector('[data-open-teacher-profile]')?.addEventListener('click', () => {
    openAccountProfile({ kind: 'teacher', personId: session.teacherId, session });
  });
  document.querySelectorAll('[data-sidebar-toggle]').forEach(btn => btn.addEventListener('click', () => document.body.classList.toggle('sidebar-open')));
  document.querySelectorAll('[data-sidebar-close]').forEach(el => el.addEventListener('click', () => document.body.classList.remove('sidebar-open')));
  document.querySelectorAll('[data-logout]').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'ออกจากระบบ?',
      message: 'คุณจะกลับไปยังหน้าเข้าสู่ระบบ',
      confirmLabel: 'ออกจากระบบ',
      tone: 'danger',
      iconName: 'logout'
    });
    if (!ok) return;
    await cloudLogout();
    clearSession();
    navigate('/login');
    toast('ออกจากระบบแล้ว', 'info', 2000);
  }));
  document.querySelectorAll('.side-nav a').forEach(link => link.addEventListener('click', () => document.body.classList.remove('sidebar-open')));
}

function examBadge(status) {
  const meta = statusMeta(status);
  return badge(meta.label, meta.tone, Boolean(meta.dot));
}

function examAccessDenied(session, title = 'คุณไม่มีสิทธิ์ดูชุดสอบนี้') {
  return {
    html: teacherShell(session, {
      active: 'exams',
      crumb: 'ไม่มีสิทธิ์เข้าถึง',
      content: `<div class="teacher-card">${emptyState({
        iconName: 'lock',
        title,
        text: 'ฉบับร่างจะเห็นได้เฉพาะครูผู้สร้างและ Wich Pitchon เท่านั้น',
        action: '<a class="btn btn--primary" href="#/teacher/exams">กลับชุดสอบทั้งหมด</a>'
      })}</div>`
    }),
    mount: () => mountTeacherShell(session)
  };
}

function metricCard({ iconName, label, value, unit = '', foot = '', accent = false, dark = false, dot = false }) {
  return `<div class="metric-card ${accent ? 'metric-card--accent' : ''} ${dark ? 'metric-card--dark' : ''}">
    ${dot ? '<span class="metric-card__dot"></span>' : ''}
    <div class="metric-card__top"><span class="metric-card__icon">${icon(iconName, 17)}</span>${accent ? `<span class="live-dot live-dot--small"><span></span>ใหม่</span>` : ''}</div>
    <div class="metric-card__label">${e(label)}</div>
    <div class="metric-card__value">${value}${unit ? `<small>${e(unit)}</small>` : ''}</div>
    ${foot ? `<div class="metric-card__foot">${foot}</div>` : ''}
  </div>`;
}

function activeExamCard(exam) {
  if (!exam) {
    return `<div class="teacher-active-exam">
      <div class="teacher-active-exam__top"><span class="badge badge--neutral">ว่าง</span></div>
      <h2>ยังไม่มีการทดสอบต่อไป</h2>
      <p>สร้างชุดสอบแรก แล้วแจกรหัสให้นักเรียนได้ทันที</p>
      <div class="teacher-active-exam__foot"><a class="btn btn--white" href="#/teacher/create">${icon('plus', 13)} สร้างชุดสอบ</a></div>
    </div>`;
  }
  const metrics = examMetrics(exam);
  const started = metrics.submitted + metrics.inProgress;
  const progress = metrics.total ? Math.round((started / metrics.total) * 100) : 0;
  return `<div class="teacher-active-exam">
    <div class="teacher-active-exam__top">
      <span class="badge badge--live"><span class="badge__dot"></span> กำลังเปิดสอบ</span>
      <span style="font-size:8.5px;color:rgba(242,242,242,.42)">${icon('clock', 10)} ${exam.duration} นาที</span>
    </div>
    <h2>${e(exam.title)}</h2>
    <p>${e(exam.topic || exam.description)}</p>
    <div class="active-exam-progress">
      <div class="active-exam-progress__labels"><span>ความคืบหน้าห้องสอบ</span><span>${started} / ${metrics.total} คน</span></div>
      <div class="active-exam-progress__bar"><span style="width:${progress}%"></span></div>
    </div>
    <div class="active-exam-stats">
      <div class="active-exam-stat"><strong>${metrics.submitted}</strong><span>ส่งคำตอบแล้ว</span></div>
      <div class="active-exam-stat"><strong>${metrics.inProgress}</strong><span>กำลังทำ</span></div>
      <div class="active-exam-stat"><strong style="color:#e0b15d">${metrics.pendingReview}</strong><span>รอตรวจ</span></div>
    </div>
    <div class="teacher-active-exam__foot">
      <a class="btn btn--white" href="#/teacher/exam/${exam.id}/students">${icon('users', 12)} ดูผู้เข้าสอบ</a>
      <a class="btn btn--ghost" href="#/teacher/exam/${exam.id}/grading">${icon('clipboard-check', 12)} ตรวจคำตอบ</a>
    </div>
  </div>`;
}

function recentSubmissionRows(attempts, limit = 6, linkable = true) {
  const db = getDB();
  return attempts.slice(0, limit).map(a => {
    const exam = db.exams.find(e => e.id === a.examId);
    if (!exam) return '';
    const inner = `${avatar(a.studentName, a.studentId, 'sm')}
      <span class="submission-row__main"><span class="row-title"><strong>${e(a.studentName)}</strong>${!a.reviewed ? badge('ใหม่', 'live', false, 'badge--sm') : ''}</span><span>${e(exam.title)} · ${relativeTime(a.submittedAt)}</span></span>
      <span class="submission-row__time">${thaiTime(a.submittedAt)} น.</span>
      <span class="submission-row__arrow">${linkable ? icon('chevron-right', 16) : icon('eye', 15)}</span>`;
    return linkable
      ? `<a class="submission-row" href="#/teacher/exam/${exam.id}/answer/${a.id}">${inner}</a>`
      : `<div class="submission-row submission-row--readonly">${inner}</div>`;
  }).join('');
}

export function teacherDashboardView(ctx) {
  const { session } = ctx;
  const db = getDB();
  const teacher = currentTeacher(session) || db.teacher;
  const visible = visibleExams(session, db);
  const manageable = visible.filter(exam => canManageExam(exam, session));
  const manageableIds = new Set(manageable.map(exam => exam.id));
  const active = manageable.find(e => e.status === 'open') || null;
  const allSubmitted = db.attempts
    .filter(a => a.status !== 'in_progress' && manageableIds.has(a.examId))
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const pending = totalPendingReview(session);
  const metrics = active ? examMetrics(active) : null;
  const average = active ? metrics.averagePercent : 0;
  const today = new Date();
  const unreviewed = db.attempts
    .filter(a => {
      if (a.status === 'in_progress' || !manageableIds.has(a.examId)) return false;
      const exam = db.exams.find(x => x.id === a.examId);
      return !a.reviewed || (exam && pendingEssayQuestions(exam, a).length > 0);
    })
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const recent = allSubmitted.slice(0, 6);
  const quickReview = unreviewed.slice(0, 3).map(a => {
    const exam = db.exams.find(e => e.id === a.examId);
    return `<a class="quick-review" href="#/teacher/exam/${a.examId}/answer/${a.id}">
      ${avatar(a.studentName, a.studentId, 'xs')}
      <span class="quick-review__copy"><strong>${e(a.studentName)}</strong><span>${e(exam?.shortTitle || exam?.title || '')} · ${relativeTime(a.submittedAt)}</span></span>
      <span class="btn btn--soft btn--sm">ตรวจ ${icon('arrow-right', 11)}</span>
    </a>`;
  }).join('');

  const content = `<div class="teacher-page-head">
    <div>
      <div class="eyebrow">${icon('sparkles', 12)} ภาพรวมวันนี้ · ${thaiDate(today)}</div>
      <h1>สวัสดี, ${e(teacher.name)}</h1>
      <p>ทุกห้องสอบของคุณเป็นไปด้วยดี มีคำตอบใหม่ที่รอการตรวจ ${pending} รายการ</p>
    </div>
    <div class="teacher-page-head__actions">
      <a class="btn btn--ghost" href="#/teacher/review">${icon('clipboard-check', 15)} คิวตรวจ</a>
      <a class="btn btn--primary" href="#/teacher/create">${icon('plus', 16)} สร้างชุดสอบ</a>
    </div>
  </div>
  <div class="metric-grid">
    ${metricCard({ iconName: 'monitor', label: 'ชุดสอบที่เปิดอยู่', value: manageable.filter(e => e.status === 'open').length, unit: 'ชุด', foot: `<span class="up">${icon('trending-up', 10)} กำลังดำเนินการ</span>` })}
    ${metricCard({ iconName: 'clipboard-check', label: 'คำตอบรอตรวจ', value: pending, unit: 'รายการ', foot: `<span style="color:var(--coral-dark);font-weight:500">${icon('dot', 8)} ต้องตรวจก่อนประกาศผล</span>`, accent: true, dot: pending > 0 })}
    ${metricCard({ iconName: 'users', label: 'ผู้เข้าสอบทั้งหมด', value: active ? metrics.total : 0, unit: 'คน', foot: `<span class="up">${icon('user', 10)} ${active ? metrics.inProgress : 0} คนกำลังทำ</span>` })}
    ${metricCard({ iconName: 'bar-chart', label: 'คะแนนเฉลี่ยห้อง', value: average, unit: '%', foot: `<span class="up">${icon('trending-up', 10)} ${active ? `จาก ${active.shortTitle}` : 'ยังไม่มีข้อมูล'}</span>`, dark: true })}
  </div>
  <div class="teacher-dashboard-grid">
    <div class="stack" style="display:grid;gap:16px">
      <section class="teacher-card">
        <div class="teacher-card__head">
          <div><h2>คำตอบที่ส่งเข้ามาล่าสุด</h2><p>อัปเดตแบบเรียลไทม์จากทุกชุดสอบ</p></div>
          <a class="teacher-card__link" href="#/teacher/review">ดูทั้งหมด ${icon('arrow-right', 12)}</a>
        </div>
        <div class="submission-list">${recent.length ? recentSubmissionRows(recent) : emptyState({ iconName: 'inbox', title: 'ยังไม่มีคำตอบใหม่', text: 'เมื่อนักเรียนส่งคำตอบ รายการจะปรากฏที่นี่' })}</div>
      </section>
      <section class="teacher-card">
        <div class="teacher-card__head">
          <div><h2>ต้องตรวจวันนี้</h2><p>เปิดดูคำตอบและให้คะแนนได้ทันที</p></div>
          <span class="badge badge--warning">${pending} รอตรวจ</span>
        </div>
        ${quickReview ? `<div class="quick-review-list">${quickReview}</div>` : `<div style="padding:0 19px 17px">${emptyState({ iconName: 'check-circle', title: 'ตรวจครบแล้ว', text: 'ไม่มีคำตอบที่ค้างอยู่ในขณะนี้' })}</div>`}
      </section>
    </div>
    <aside class="stack" style="display:grid;gap:16px">
      ${activeExamCard(active)}
      <div class="teacher-card" style="padding:17px">
        <div class="overview-panel__head" style="margin-bottom:12px"><div><h2>สถานะห้องสอบ</h2><p>${active ? e(active.shortTitle) : 'ยังไม่มีห้องสอบ'}</p></div>${active ? `<span class="live-dot live-dot--small"><span></span>Live</span>` : ''}</div>
        ${active ? `<div class="progress-breakdown">
          <div class="progress-line"><span>ส่งแล้ว</span><span class="progress-line__bar"><span style="width:${percent(metrics.submitted, metrics.total)}%"></span></span><strong>${metrics.submitted} คน</strong></div>
          <div class="progress-line"><span>กำลังทำ</span><span class="progress-line__bar progress-line__bar--amber"><span style="width:${percent(metrics.inProgress, metrics.total)}%"></span></span><strong>${metrics.inProgress} คน</strong></div>
          <div class="progress-line"><span>ยังไม่เริ่ม</span><span class="progress-line__bar progress-line__bar--gray"><span style="width:${percent(metrics.notStarted, metrics.total)}%"></span></span><strong>${metrics.notStarted} คน</strong></div>
        </div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
          <a class="btn btn--ghost btn--sm btn--wide" href="#/teacher/exam/${active.id}/students">${icon('users', 13)} จัดการผู้เข้าสอบ</a>
        </div>` : `<div class="notice-strip notice-strip--info">${icon('info', 14)}<span>สร้างชุดสอบเพื่อเริ่มติดตามสถานะห้องสอบ</span></div>`}
      </div>
      <div class="notice-strip" style="background:var(--green-soft);border-color:#cfe6d9;color:#175c43">
        ${icon('shield-check', 15)}<span><strong>ตรวจก่อนประกาศ</strong> นักเรียนจะเห็นคะแนนก็ต่อเมื่อคุณกด “ประกาศผล” เท่านั้น</span>
      </div>
    </aside>
  </div>`;
  return {
    html: teacherShell(session, { active: 'dashboard', crumb: 'ภาพรวม', content }),
    mount: () => mountTeacherShell(session)
  };
}

export function teacherExamsView(ctx) {
  const { session } = ctx;
  const db = getDB();
  const owner = hasAllOrganizationAccess(session);
  const exams = [...visibleExams(session, db)].sort((a, b) => {
    const order = { open: 0, saved: 1, draft: 2, closed: 3, announced: 4 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || new Date(b.createdAt) - new Date(a.createdAt);
  });
  const counts = {
    all: exams.length,
    open: exams.filter(e => e.status === 'open').length,
    saved: exams.filter(e => e.status === 'saved').length,
    draft: exams.filter(e => e.status === 'draft').length,
    closed: exams.filter(e => e.status === 'closed').length,
    announced: exams.filter(e => e.status === 'announced').length
  };
  const cards = exams.map(exam => {
    const metrics = examMetrics(exam);
    const meta = statusMeta(exam.status);
    const manage = canManageExam(exam, session);
    const canEdit = canEditExam(exam, session);
    const statsVisible = canViewExamStats(exam, session);
    const creator = creatorOfExam(exam, db);
    const draftNote = exam.status === 'draft'
      ? `<span class="exam-admin-card__privacy">${icon('lock', 10)} ฉบับร่าง · เห็นเฉพาะเจ้าของ ผู้จัดการหน่วยงาน และ Wich</span>`
      : '';
    const examOrg = examOrganizationName(exam, db);
    const examOrgIds = examOrganizationIds(exam, db);
    return `<article class="exam-admin-card" data-exam-status="${exam.status}" data-exam-orgs="${e(examOrgIds.join(' '))}">
      <div class="exam-admin-card__top">
        <span class="exam-admin-card__subject"><span class="subject-dot" style="background:${exam.status === 'open' ? 'var(--coral)' : exam.status === 'announced' ? 'var(--green)' : 'var(--mint-strong)'}"></span>${e(exam.subject)}</span>
        ${badge(meta.label, meta.tone, Boolean(meta.dot))}
      </div>
      <h3><a href="#/teacher/exam/${exam.id}/overview">${e(exam.title)}</a></h3>
      <p class="exam-admin-card__desc">${e(exam.topic || exam.description || '')}</p>
      <div class="exam-admin-card__creator">
        ${avatar(creator.name, creator.id || creator.name, 'xs')}
        <span><strong>สร้างโดย ${e(creator.name)}</strong><small>${e(examOrg)}${creator.isOwner ? ' · ผู้ดูแลระบบ' : ''}</small></span>
        ${!canEdit ? `<span class="exam-admin-card__readonly">${icon('eye', 10)} ดูอย่างเดียว</span>` : !manage ? `<span class="exam-admin-card__readonly">${icon('edit', 10)} แก้ไขร่วม</span>` : ''}
      </div>
      <div class="exam-admin-card__meta">
        <span>${icon('file-text', 11)} ${exam.questions.length} ข้อ</span>
        <span>${icon('clock', 11)} ${exam.duration} นาที</span>
        <span>${icon('users', 11)} ${metrics.total} คน</span>
      </div>
      ${draftNote}
      ${statsVisible ? `<div class="exam-admin-card__progress">
        <span><span>ส่งคำตอบแล้ว ${metrics.submitted}/${metrics.total}</span><span>${metrics.total ? percent(metrics.submitted, metrics.total) : 0}%</span></span>
        <div class="progress-mini"><span style="width:${metrics.total ? percent(metrics.submitted, metrics.total) : 0}%"></span></div>
      </div>` : `<div class="exam-admin-card__locked">${icon('lock', 10)} สถิติจะแสดงเมื่อปิดสอบ</div>`}
      <div class="exam-admin-card__foot">
        <span class="exam-admin-card__code">${icon('hash', 11)} <strong>${e(exam.code)}</strong></span>
        <div class="exam-admin-card__actions">
          <a class="icon-btn" href="#/teacher/exam/${exam.id}/overview" title="ดูข้อมูลชุดสอบ" aria-label="ดู ${e(exam.title)}">${icon('eye', 14)}</a>
          ${canEdit ? `<a class="icon-btn" href="#/teacher/exam/${exam.id}/edit" title="แก้ไขชุดสอบ" aria-label="แก้ไข ${e(exam.title)}">${icon('edit', 14)}</a>` : ''}
          ${manage ? `<button class="icon-btn icon-btn--danger" type="button" data-delete-exam="${exam.id}" title="ลบชุดสอบ" aria-label="ลบ ${e(exam.title)}">${icon('trash', 14)}</button>` : ''}
          <button class="icon-btn" type="button" data-copy="${exam.code}" title="คัดลอกรหัสสอบ" aria-label="คัดลอกรหัสสอบ">${icon('copy', 14)}</button>
          <a class="btn btn--ghost" href="${canEdit ? `#/teacher/exam/${exam.id}/edit` : `#/teacher/exam/${exam.id}/overview`}">${canEdit ? 'แก้ไข' : 'ดูข้อมูล'} ${icon('arrow-right', 11)}</a>
        </div>
      </div>
    </article>`;
  }).join('');

  const visibleOrgs = owner ? db.organizations : db.organizations.filter(org => org.id === currentTeacher(session)?.orgId);
  const orgFilter = `<select class="select exam-org-filter" data-exam-org-filter aria-label="กรองชุดสอบตามหน่วยงาน">
    <option value="all">ทุกหน่วยงาน (${exams.length})</option>
    ${visibleOrgs.map(org => {
      const count = exams.filter(exam => examOrganizationIds(exam, db).includes(org.id)).length;
      return `<option value="${e(org.id)}">${e(org.name)} (${count})</option>`;
    }).join('')}
  </select>`;
  const content = `<div class="teacher-page-head">
    <div>
      <div class="eyebrow">${icon('file-text', 12)} คลังข้อสอบ</div>
      <h1>ชุดสอบทั้งหมด</h1>
      <p>${owner ? 'คุณเห็นชุดสอบทุกชุดของทุกหน่วยงาน · เลือกกรองตามโรงเรียนหรือหน่วยงานได้' : `ชุดสอบใน ${e(findOrganization(currentTeacher(session)?.orgId, db)?.name || 'หน่วยงานของคุณ')} เท่านั้น · ต่างหน่วยงานจะมองไม่เห็น`} · ${counts.all} ชุด</p>
    </div>
    <div class="teacher-page-head__actions">
      <button class="btn btn--ghost" type="button" data-print>${icon('printer', 15)} พิมพ์รายการ</button>
      <a class="btn btn--primary" href="#/teacher/create">${icon('plus', 16)} สร้างชุดสอบ</a>
    </div>
  </div>
  <div class="exam-filter-row">
    <div class="chip-select" data-exam-filters>
      ${[['all', 'ทั้งหมด', counts.all], ['open', 'กำลังสอบ', counts.open], ['saved', 'บันทึกแล้ว', counts.saved], ['draft', 'ฉบับร่าง', counts.draft], ['closed', 'ปิดสอบ', counts.closed], ['announced', 'ประกาศผล', counts.announced]].map(([key, label, count], i) => `<button type="button" class="chip ${i === 0 ? 'is-active' : ''}" data-filter="${key}">${label} <span>${count}</span></button>`).join('')}
    </div>
    ${owner ? orgFilter : ''}
  </div>
  ${exams.length ? `<div class="exam-card-grid" data-exam-list>${cards}</div>` : `<div class="card">${emptyState({ iconName: 'file-text', title: 'ยังไม่มีชุดสอบ', text: 'สร้างชุดสอบแรก แล้วกำหนดวันเริ่มและวันปิดรับ', action: '<a class="btn btn--primary" href="#/teacher/create">สร้างชุดสอบ</a>' })}</div>`}
  <div class="table-empty" data-exam-empty style="display:none">ไม่พบชุดสอบในสถานะนี้</div>`;
  return {
    html: teacherShell(session, { active: 'exams', crumb: 'ชุดสอบทั้งหมด', content }),
    mount() {
      mountTeacherShell(session);
      bindDeleteExamButtons(session);
      const filters = document.querySelector('[data-exam-filters]');
      const orgSelect = document.querySelector('[data-exam-org-filter]');
      const applyFilters = () => {
        const status = filters?.querySelector('[data-filter].is-active')?.dataset.filter || 'all';
        const orgId = orgSelect?.value || 'all';
        let visibleCount = 0;
        document.querySelectorAll('[data-exam-status]').forEach(card => {
          const orgs = String(card.dataset.examOrgs || '').split(' ').filter(Boolean);
          const show = (status === 'all' || card.dataset.examStatus === status)
            && (orgId === 'all' || orgs.includes(orgId));
          card.classList.toggle('hidden', !show);
          if (show) visibleCount += 1;
        });
        const empty = document.querySelector('[data-exam-empty]');
        if (empty) empty.style.display = visibleCount ? 'none' : 'block';
      };
      filters?.addEventListener('click', ev => {
        const btn = ev.target.closest('[data-filter]');
        if (!btn) return;
        filters.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('is-active', b === btn));
        applyFilters();
      });
      orgSelect?.addEventListener('change', applyFilters);
    }
  };
}

function examHeader(exam, metrics, { tab = 'overview', canManage = false, canEdit = false, canViewStats = false } = {}) {
  const meta = statusMeta(exam.status);
  const creator = creatorOfExam(exam);
  const shareLabel = exam.shareMode === 'edit' ? 'ครูอื่นแก้ไขได้' : 'ครูอื่นดูอย่างเดียว';
  return `<a class="page-back" href="#/teacher/exams">${icon('arrow-left', 15)} กลับชุดสอบทั้งหมด</a>
  <div class="exam-admin-head">
    <div class="exam-admin-head__main">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">
        ${badge(meta.label, meta.tone, Boolean(meta.dot))}
        ${!canEdit ? badge('อ่านอย่างเดียว', 'neutral') : !canManage ? badge('แก้ไขร่วม', 'info') : ''}
        <span class="exam-code-card">${icon('hash', 11)} <strong>${e(exam.code)}</strong><button class="icon-btn" type="button" data-copy="${exam.code}" aria-label="คัดลอกรหัสสอบ" title="คัดลอกรหัสสอบ">${icon('copy', 12)}</button></span>
      </div>
      <h1>${e(exam.title)}</h1>
      <div class="exam-admin-head__meta">
        <span>${icon('book-open', 12)} ${e(exam.subject)}</span><span class="dot"></span>
        ${exam.level ? `<span>${icon('graduation-cap', 12)} ${e(exam.level)}</span><span class="dot"></span>` : ''}
        <span>${icon('file-text', 12)} ${exam.questions.length} ข้อ</span><span class="dot"></span>
        <span>${icon('clock', 12)} ${exam.duration} นาที</span><span class="dot"></span>
        <span>${icon('award', 12)} ${exam.totalPoints} คะแนน</span><span class="dot"></span>
        <span>${icon(exam.shareMode === 'edit' ? 'edit' : 'eye', 12)} ${shareLabel}</span>
      </div>
      <div class="exam-admin-head__creator">
        ${avatar(creator.name, creator.id || creator.name, 'xs')}
        <span>สร้างโดย <strong>${e(creator.name)}</strong> · ${e(examOrganizationName(exam, getDB()))}</span>
        ${creator.isOwner ? badge('ผู้ดูแลระบบ', 'draft') : ''}
      </div>
    </div>
    <div class="exam-admin-head__actions">
      ${canEdit ? `<a class="icon-btn" href="#/teacher/exam/${exam.id}/edit" title="แก้ไขชุดสอบ" aria-label="แก้ไขชุดสอบ">${icon('edit', 15)}</a>` : ''}
      ${canManage ? `<button class="icon-btn icon-btn--danger" type="button" data-delete-exam="${exam.id}" title="ลบชุดสอบ" aria-label="ลบชุดสอบ">${icon('trash', 15)}</button>` : ''}
      ${!canEdit ? `<span class="exam-readonly-note">${icon('eye', 13)} ดูข้อมูลจากเจ้าของชุดสอบ</span>` : !canManage ? `<span class="exam-readonly-note">${icon('edit', 13)} แก้ไขร่วม · เปลี่ยนสถานะไม่ได้</span>` : exam.status === 'draft'
        ? `<button class="btn btn--ghost" type="button" data-publish-exam>${icon('users', 15)} เผยแพร่ให้ครูเห็น</button>
           <button class="btn btn--primary" type="button" data-open-exam>${icon('play', 15)} เปิดสอบ</button>`
        : exam.status === 'saved'
          ? `<button class="btn btn--primary" type="button" data-open-exam>${icon('play', 15)} เปิดสอบ</button>`
          : exam.status === 'open'
            ? `<button class="btn btn--ghost" type="button" data-close-exam>${icon('lock', 15)} ปิดสอบ</button>
               <button class="btn btn--primary" type="button" data-announce>${icon('award', 15)} ประกาศผล</button>`
            : exam.status === 'closed'
              ? `<button class="btn btn--ghost" type="button" data-open-exam>${icon('refresh', 15)} เปิดสอบอีกครั้ง</button>
                 <button class="btn btn--primary" type="button" data-announce>${icon('award', 15)} ประกาศผล</button>`
              : `<button class="btn btn--ghost" type="button" data-announce>${icon('settings', 15)} ตั้งค่าการแสดงผล</button>
                 <button class="btn btn--primary" type="button" data-export-exam>${icon('download', 15)} ส่งออก Excel</button>`}
    </div>
  </div>
  <div class="exam-tabs">
    <a class="exam-tab ${tab === 'overview' ? 'is-active' : ''}" href="#/teacher/exam/${exam.id}/overview">${icon('layout-dashboard', 13)} ภาพรวม</a>
    ${canManage ? `<a class="exam-tab ${tab === 'students' ? 'is-active' : ''}" href="#/teacher/exam/${exam.id}/students">${icon('users', 13)} ผู้เข้าสอบ <span class="exam-tab__count">${metrics.total}</span></a>
    <a class="exam-tab ${tab === 'grading' ? 'is-active' : ''}" href="#/teacher/exam/${exam.id}/grading">${icon('clipboard-check', 13)} ตรวจคำตอบ ${metrics.pendingReview ? `<span class="exam-tab__count exam-tab__count--alert">${metrics.pendingReview}</span>` : ''}</a>` : ''}
    ${canViewStats ? `<a class="exam-tab ${tab === 'stats' ? 'is-active' : ''}" href="#/teacher/exam/${exam.id}/stats">${icon('chart', 13)} สถิติ</a>` : ''}
  </div>
  ${!canViewStats ? `<div class="exam-stats-locked">${icon('lock', 13)} ชุดสอบนี้ตั้งค่าให้ครูท่านอื่นดูได้อย่างเดียว · สถิติจะเปิดให้ดูเมื่อปิดสอบแล้ว</div>` : ''}`;
}

function overviewTab(exam, metrics, canManage = false, canViewStats = true) {
  const db = getDB();
  const statsLocked = !canViewStats;
  const recent = statsLocked ? [] : getExamAttempts(exam.id)
    .filter(a => a.status !== 'in_progress')
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 5);
  const started = metrics.submitted + metrics.inProgress;
  const statusRows = [
    { label: 'ส่งแล้ว', value: metrics.submitted, tone: 'blue' },
    { label: 'กำลังทำ', value: metrics.inProgress, tone: 'amber' },
    { label: 'ยังไม่เริ่ม', value: metrics.notStarted, tone: 'gray' }
  ];
  const mainContent = statsLocked
    ? `<div class="overview-metrics">
        <div class="overview-metric"><span>${icon('users', 11)} ผู้เข้าสอบ</span><strong>${metrics.total} <small>คน</small></strong></div>
      </div>
      <section class="overview-panel card exam-overview-locked">
        ${emptyState({ iconName: 'lock', title: 'สถิติถูกซ่อนไว้', text: 'ชุดสอบนี้แชร์แบบดูอย่างเดียว · สถิติและรายละเอียดคำตอบจะเปิดให้ดูเมื่อปิดรับคำตอบแล้ว', action: `<a class="btn btn--ghost btn--sm" href="#/teacher/exams">กลับชุดสอบทั้งหมด</a>` })}
      </section>`
    : `<div class="overview-metrics">
        <div class="overview-metric"><span>${icon('users', 11)} ผู้เข้าสอบ</span><strong>${metrics.total} <small>คน</small></strong></div>
        <div class="overview-metric"><span>${icon('send', 11)} ส่งแล้ว</span><strong>${metrics.submitted} <small>คน</small></strong></div>
        <div class="overview-metric"><span>${icon('clipboard-check', 11)} รอตรวจ</span><strong style="color:var(--coral-dark)">${metrics.pendingReview} <small>คน</small></strong></div>
        <div class="overview-metric"><span>${icon('bar-chart', 11)} คะแนนเฉลี่ย</span><strong>${metrics.averagePercent} <small>%</small></strong></div>
      </div>
      <section class="overview-panel card">
        <div class="overview-panel__head"><div><h2>ความคืบหน้าห้องสอบ</h2><p>อัปเดตสถานะของผู้เข้าสอบทุกคน</p></div>${exam.status === 'open' ? `<span class="live-dot live-dot--small"><span></span>Live</span>` : badge(exam.status === 'announced' ? 'ประกาศผลแล้ว' : exam.status === 'draft' ? 'ฉบับร่าง' : exam.status === 'saved' ? 'บันทึกแล้ว' : 'ปิดรับคำตอบ', exam.status === 'announced' ? 'success' : 'neutral')}</div>
        <div class="progress-breakdown">
          ${statusRows.map(row => `<div class="progress-line"><span>${row.label}</span><span class="progress-line__bar ${row.tone === 'gray' ? 'progress-line__bar--gray' : `progress-line__bar--${row.tone}`}"><span style="width:${metrics.total ? percent(row.value, metrics.total) : 0}%"></span></span><strong>${row.value} คน</strong></div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:13px;border-top:1px solid var(--line)">
          <span style="font-size:9.5px;color:var(--muted)">เริ่มสอบแล้ว ${started} จาก ${metrics.total} คน</span>
          ${canManage ? `<a class="btn btn--soft btn--sm" href="#/teacher/exam/${exam.id}/students">ดูรายชื่อทั้งหมด ${icon('arrow-right', 12)}</a>` : `<span class="exam-readonly-note">${icon('eye', 11)} อ่านข้อมูลเท่านั้น</span>`}
        </div>
      </section>
      <section class="teacher-card">
        <div class="teacher-card__head"><div><h2>คำตอบล่าสุด</h2><p>เปิดตรวจคำตอบของนักเรียนแต่ละคน</p></div>${canManage ? `<a class="teacher-card__link" href="#/teacher/exam/${exam.id}/grading">ไปหน้าตรวจ ${icon('arrow-right', 12)}</a>` : ''}</div>
        <div class="submission-list">${recent.length ? recentSubmissionRows(recent, 5, canManage) : `<div style="padding:0 19px 19px">${emptyState({ iconName: 'inbox', title: 'ยังไม่มีคำตอบ', text: 'รอให้นักเรียนส่งคำตอบเข้ามา' })}</div>`}</div>
      </section>`;
  return `<div class="exam-overview-grid">
    <div class="exam-overview-main">
      ${mainContent}
    </div>
    <aside class="exam-overview-side">
      <div class="overview-code">
        <h3>รหัสเข้าสอบ</h3>
        <div class="overview-code__digits"><strong>${e(exam.code)}</strong><button class="icon-btn" type="button" data-copy="${exam.code}" aria-label="คัดลอกรหัส">${icon('copy', 14)}</button></div>
        <p>นักเรียนใช้รหัสนี้เพื่อเข้าสอบโดยไม่ต้องมีบัญชี</p>
        <div class="overview-code__actions">
          <button class="btn btn--white" type="button" data-copy="${exam.code}" data-copy-label="1">${icon('copy', 12)} คัดลอกรหัส</button>
          <button class="btn btn--ghost" type="button" data-copy-link>${icon('link', 12)} คัดลอกลิงก์</button>
        </div>
      </div>
      <div class="overview-panel card">
        <div class="overview-panel__head"><div><h2>ข้อมูลชุดสอบ</h2></div></div>
        <div class="overview-info-list">
          <div class="overview-info-row"><span>${icon('book-open', 11)} วิชา</span><strong>${e(exam.subject)}</strong></div>
          <div class="overview-info-row"><span>${icon('file-text', 11)} จำนวนข้อ</span><strong>${exam.questions.length} ข้อ</strong></div>
          <div class="overview-info-row"><span>${icon('clock', 11)} เวลาทำ</span><strong>${exam.duration} นาที</strong></div>
          <div class="overview-info-row"><span>${icon('award', 11)} คะแนนเต็ม</span><strong>${exam.totalPoints} คะแนน</strong></div>
          <div class="overview-info-row"><span>${icon('check-circle', 11)} เกณฑ์ผ่าน</span><strong>${exam.passPercent}%</strong></div>
          <div class="overview-info-row"><span>${icon('calendar', 11)} เริ่มสอบ</span><strong>${thaiDateTime(exam.openAt)}</strong></div>
          <div class="overview-info-row"><span>${icon('timer', 11)} ปิดรับ</span><strong>${thaiDateTime(exam.closeAt)}</strong></div>
          <div class="overview-info-row"><span>${icon(exam.shareMode === 'edit' ? 'edit' : 'eye', 11)} สิทธิ์ครูอื่น</span><strong>${exam.shareMode === 'edit' ? 'แก้ไขได้' : 'ดูอย่างเดียว'}</strong></div>
        </div>
      </div>
      <div class="overview-panel card">
        <div class="overview-panel__head"><div><h2>การแสดงผลให้นักเรียน</h2></div>${canManage ? `<button class="btn btn--link" style="font-size:9px" type="button" data-announce>แก้ไข</button>` : ''}</div>
        <div class="overview-settings">
          ${badge(exam.settings.showScore ? 'แสดงคะแนน' : 'ซ่อนคะแนน', exam.settings.showScore ? 'success' : 'neutral')}
          ${badge(exam.settings.showSolutions ? 'แสดงเฉลย' : 'ซ่อนเฉลย', exam.settings.showSolutions ? 'info' : 'neutral')}
          ${badge(exam.settings.showRank ? 'แสดงอันดับ' : 'ไม่แสดงอันดับ', exam.settings.showRank ? 'warning' : 'neutral')}
        </div>
        ${exam.status === 'announced' ? `<p style="font-size:9px;color:var(--muted);margin-top:9px">ประกาศผลเมื่อ ${thaiDateTime(exam.publishedAt)}</p>` : `<p style="font-size:9px;color:var(--muted);margin-top:9px">นักเรียนจะไม่เห็นคะแนนจนกว่าจะประกาศผล</p>`}
      </div>
      <div class="overview-panel card">
        <div class="overview-panel__head"><div><h2>ผู้สอน</h2></div></div>
        <div style="display:flex;align-items:center;gap:10px">${avatar(creatorOfExam(exam, db).name, exam.teacherId, 'sm')}<div><strong style="display:block;font-size:10.5px;font-weight:500">${e(creatorOfExam(exam, db).name)}</strong><span style="font-size:8.5px;color:var(--muted)">${e(creatorOfExam(exam, db).school || 'ไม่ระบุโรงเรียน')}</span></div></div>
      </div>
    </aside>
  </div>`;
}

function studentsTab(exam, metrics) {
  const rows = metrics.rows;
  const rowStatusKey = row => {
    if (!row.attempt) return 'not_started';
    if (row.attempt.status === 'in_progress') return 'in_progress';
    return attemptStatusMeta(exam, row.attempt).key;
  };
  const counts = {
    all: rows.length,
    not_started: rows.filter(r => rowStatusKey(r) === 'not_started').length,
    in_progress: rows.filter(r => rowStatusKey(r) === 'in_progress').length,
    submitted: rows.filter(r => rowStatusKey(r) === 'submitted').length,
    graded: rows.filter(r => rowStatusKey(r) === 'graded').length
  };
  const rowMarkup = rows.map(({ student, attempt }, i) => {
    let status = { key: 'not_started', label: 'ยังไม่เริ่ม', tone: 'neutral' };
    let score = null;
    let actions = `<button class="btn btn--ghost" type="button" data-remind="${student.id}" data-student-name="${e(student.name)}">${icon('bell', 12)} เตือน</button>`;
    if (attempt) {
      if (attempt.status === 'in_progress') {
        status = { key: 'in_progress', label: 'กำลังทำ', tone: 'warning' };
        actions = `<button class="btn btn--ghost" type="button" data-remind="${student.id}" data-student-name="${e(student.name)}">${icon('bell', 12)} เตือน</button>
          <button class="btn btn--outline-danger" type="button" data-force-submit="${attempt.id}">${icon('send', 12)} บังคับส่ง</button>`;
      } else {
        const st = attemptStatusMeta(exam, attempt);
        status = { key: st.key, label: st.label, tone: st.tone };
        score = attemptScore(exam, attempt);
        actions = `<a class="btn btn--primary" href="#/teacher/exam/${exam.id}/answer/${attempt.id}">${icon('eye', 12)} ดูคำตอบ</a>`;
      }
    }
    return `<tr data-student-row data-status="${status.key}" data-name="${e(student.name.toLowerCase())}" data-code="${e(student.code)}">
      <td><span class="table-number" style="color:var(--muted);font-size:9.5px">${String(i + 1).padStart(2, '0')}</span></td>
      <td><div class="table-person">${avatar(student.name, student.id, 'sm')}<span class="table-person__copy"><strong>${e(student.name)}</strong><span>${e(student.code)} · ${e(student.class)}</span></span></div></td>
      <td>${badge(status.label, status.tone)}</td>
      <td><span style="font-size:9.5px;color:var(--muted)">${attempt?.submittedAt ? thaiTime(attempt.submittedAt) + ' น.' : attempt?.startedAt ? 'เริ่ม ' + thaiTime(attempt.startedAt) + ' น.' : '—'}</span></td>
      <td>${score ? `<strong class="table-number" style="font-size:11px">${formatNumber(score.total, 1)}</strong><span style="color:var(--muted);font-size:8.5px"> / ${score.max}</span>` : `<span style="color:var(--muted)">—</span>`}</td>
      <td>${attempt ? `<span style="font-size:9px;color:${attempt.antiCheat?.length ? 'var(--amber)' : 'var(--muted)'}">${attempt.antiCheat?.length ? `${attempt.antiCheat.length} กิจกรรม` : 'ปกติ'}</span>` : '—'}</td>
      <td><div class="table-actions">${actions}</div></td>
    </tr>`;
  }).join('');

  return `<section class="teacher-card">
    <div class="table-toolbar">
      <div class="table-toolbar__left">
        <label class="search-field">${icon('search', 17)}<input type="search" placeholder="ค้นหาชื่อหรือรหัสนักเรียน..." data-student-search></label>
        <select class="select" data-student-status style="min-height:42px;width:auto;font-size:10.5px;padding:7px 28px 7px 11px">
          <option value="all">ทุกสถานะ (${counts.all})</option>
          <option value="not_started">ยังไม่เริ่ม (${counts.not_started})</option>
          <option value="in_progress">กำลังทำ (${counts.in_progress})</option>
          <option value="submitted">รอตรวจ (${counts.submitted})</option>
          <option value="graded">ตรวจแล้ว (${counts.graded})</option>
        </select>
      </div>
      <div class="table-toolbar__left">
        <button class="btn btn--ghost btn--sm" type="button" data-remind-all>${icon('bell', 13)} เตือนคนที่ยังไม่ส่ง</button>
        <span class="table-caption" data-student-count>${rows.length} คน</span>
      </div>
    </div>
    <div class="scroll-x">
      <table class="data-table">
        <thead><tr><th>#</th><th>นักเรียน</th><th>สถานะ</th><th>เวลาส่ง</th><th>คะแนน</th><th>ความเรียบร้อย</th><th style="text-align:right">การกระทำ</th></tr></thead>
        <tbody data-student-rows>${rowMarkup}</tbody>
      </table>
      <div data-student-empty style="display:none" class="table-empty">ไม่พบนักเรียนที่ตรงกับตัวกรอง</div>
    </div>
  </section>`;
}

function gradingTab(exam, metrics) {
  const essayQuestions = exam.questions.filter(q => q.type === 'essay');
  const submissions = getExamAttempts(exam.id)
    .filter(a => a.status !== 'in_progress')
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  const totalEssaySlots = submissions.length * essayQuestions.length;
  const gradedSlots = submissions.reduce((sum, a) => sum + essayQuestions.filter(q => a.manualScores?.[q.id] !== undefined).length, 0);
  const pendingSlots = totalEssaySlots - gradedSlots;
  if (!essayQuestions.length) {
    return `<div class="teacher-card">${emptyState({
      iconName: 'check-circle',
      title: 'ชุดสอบนี้ตรวจอัตโนมัติทั้งหมด',
      text: 'ไม่มีข้ออัตนัยที่ต้องตรวจด้วยมือ คะแนนถูกคำนวณให้เรียบร้อยแล้ว',
      action: `<a class="btn btn--primary" href="#/teacher/exam/${exam.id}/stats">${icon('chart', 15)} ดูสถิติผลสอบ</a>`
    })}</div>`;
  }

  const sections = essayQuestions.map((q, qi) => {
    const qIndex = exam.questions.findIndex(x => x.id === q.id) + 1;
    const entries = submissions.map(a => {
      const manual = a.manualScores?.[q.id];
      const value = getAnswerValue(a, q.id);
      return `<article class="grading-entry ${manual ? 'is-graded' : ''}" data-grade-status="${manual ? 'graded' : 'pending'}" data-attempt-id="${a.id}" data-question-id="${q.id}">
        <div class="grading-entry__top">
          <div class="grading-entry__student">
            ${avatar(a.studentName, a.studentId, 'sm')}
            <div><strong>${e(a.studentName)}</strong><span>${e(a.studentCode)} · ส่งเมื่อ ${thaiTime(a.submittedAt)} น.</span></div>
          </div>
          <div style="text-align:right">
            <span class="grading-entry__auto">ปรนัย ${formatNumber(attemptScore(exam, a).auto, 1)} คะแนน</span>
            ${manual ? badge('ตรวจแล้ว', 'success', false, 'badge--sm') : badge('รอตรวจ', 'warning', false, 'badge--sm')}
          </div>
        </div>
        <div class="student-answer-quote ${value ? '' : 'is-empty'}"><p>${value ? e(value) : 'นักเรียนไม่ได้เขียนคำตอบ'}</p></div>
        <div class="grading-form">
          <div class="field grading-score-field">
            <label>คะแนน / ${q.points}</label>
            <input class="input" type="number" min="0" max="${q.points}" step="0.5" value="${manual ? manual.score : ''}" placeholder="0" data-grade-score>
          </div>
          <div class="field">
            <label>ความคิดเห็น (ไม่บังคับ)</label>
            <input class="input" type="text" value="${e(manual?.comment || '')}" placeholder="เช่น อธิบายขั้นตอนได้ชัดเจน" data-grade-comment>
          </div>
          <button class="btn btn--primary" type="button" data-save-grade>${icon('save', 13)} บันทึกคะแนน</button>
        </div>
        ${manual ? `<div class="grading-saved">${icon('check-circle', 13)} บันทึกเมื่อ ${thaiDateTime(manual.gradedAt)} · <strong>${manual.score}/${q.points} คะแนน</strong></div>` : ''}
      </article>`;
    }).join('');
    return `<section class="grading-section" data-grade-section="${q.id}">
      <div class="grading-section__head"><h3>${icon('edit', 14)} ข้อ ${qIndex} · ${mathText(q.text)} <span>${submissions.length} คำตอบ</span></h3><span class="badge badge--neutral">${q.points} คะแนน</span></div>
      ${questionImageHTML(q, 'question-figure question-figure--grading')}
      <div class="grading-list">${entries || `<div class="teacher-card">${emptyState({ iconName: 'inbox', title: 'ยังไม่มีคำตอบให้ตรวจ', text: 'เมื่อนักเรียนส่งคำตอบแล้ว จะแสดงที่นี่' })}</div>`}</div>
    </section>`;
  }).join('');

  return `<div class="grading-status-card">
    <span class="grading-status-card__icon">${icon('clipboard-check', 21)}</span>
    <div class="grading-status-card__copy">
      <h2>${pendingSlots ? `มีคำตอบอัตนัยรอตรวจ ${pendingSlots} รายการ` : 'ตรวจข้ออัตนัยครบแล้ว'}</h2>
      <p>${pendingSlots ? 'ให้คะแนนพร้อมความคิดเห็น แล้วกดบันทึกเพื่ออัปเดตผลของนักเรียนทันที' : 'คะแนนของนักเรียนทุกคนพร้อมสำหรับการประกาศผล'}</p>
    </div>
    <div class="grading-status-card__progress">
      <span>${gradedSlots} / ${totalEssaySlots}</span>
      <div class="progress-mini"><span style="width:${totalEssaySlots ? percent(gradedSlots, totalEssaySlots) : 100}%"></span></div>
    </div>
    <div class="chip-select" style="margin-left:8px">
      <button class="chip is-active" type="button" data-grade-filter="pending">ต้องตรวจ (${pendingSlots})</button>
      <button class="chip" type="button" data-grade-filter="all">ทั้งหมด (${submissions.length})</button>
    </div>
  </div>
  <div data-grading-sections>
    ${sections}
    <div class="graded-all teacher-card" data-graded-all ${pendingSlots ? 'hidden' : ''}>
      <span class="graded-all__icon">${icon('check-circle', 25)}</span>
      <h3>ยอดเยี่ยม ตรวจครบทุกข้อแล้ว</h3>
      <p>คุณสามารถประกาศผลให้นักเรียนเห็นคะแนนและเฉลยได้เลย</p>
      <button class="btn btn--primary" type="button" data-announce style="margin-top:12px">${icon('award', 14)} ไปที่การประกาศผล</button>
    </div>
  </div>`;
}

function exportExamExcel(exam) {
  const metrics = examMetrics(exam);
  const rows = metrics.rows.map(({ student, attempt }, i) => {
    let status = 'ยังไม่เริ่ม';
    let score = '';
    let submitted = '';
    if (attempt) {
      const st = attemptStatusMeta(exam, attempt);
      status = st.label;
      submitted = attempt.submittedAt ? thaiDateTime(attempt.submittedAt) : '';
      score = formatNumber(attemptScore(exam, attempt).total, 1);
    }
    return `<tr><td>${i + 1}</td><td>${e(student.name)}</td><td>${e(student.code)}</td><td>${e(student.class)}</td><td>${status}</td><td>${submitted}</td><td>${score}</td><td>${attempt?.antiCheat?.length || 0}</td></tr>`;
  }).join('');
  const qstats = questionStats(exam).map((s, i) => `<tr><td>${i + 1}</td><td>${e(typeLabel(s.q.type))}</td><td>${s.correct}</td><td>${s.total}</td><td>${s.correctPercent}%</td></tr>`).join('');
  const html = `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;font-family:Tahoma}th{background:#111111;color:#fff}</style></head><body>
    <h2>${e(exam.title)}</h2>
    <p>รหัสเข้าสอบ: ${e(exam.code)} · ครูผู้สอน: ${e(exam.teacherName)} · จำนวน ${metrics.total} คน</p>
    <table><thead><tr><th>#</th><th>ชื่อ–นามสกุล</th><th>รหัสนักเรียน</th><th>class</th><th>สถานะ</th><th>เวลาส่ง</th><th>คะแนน</th><th>กิจกรรมผิดปกติ</th></tr></thead><tbody>${rows}</tbody></table>
    <br><h3>สถิติรายข้อ</h3><table><thead><tr><th>ข้อ</th><th>ประเภท</th><th>ตอบถูก</th><th>ตอบทั้งหมด</th><th>ร้อยละ</th></tr></thead><tbody>${qstats}</tbody></table>
    <p>คะแนนเฉลี่ย ${metrics.averagePercent}% · คะแนนสูงสุด ${metrics.highest}/${exam.totalPoints} · ผ่านเกณฑ์ ${metrics.passed}/${metrics.submitted} คน</p>
  </body></html>`;
  downloadFile(`02mock-${exam.code}-results.xls`, html, 'application/vnd.ms-excel;charset=utf-8');
}

function statsTab(exam, metrics) {
  const distribution = scoreDistribution(exam);
  const qstats = questionStats(exam);
  const ranking = rankAttempts(exam);
  const maxBin = Math.max(...distribution.map(d => d.count), 1);
  const subjectiveTotal = exam.questions.filter(q => q.type === 'essay').reduce((s, q) => s + q.points, 0);
  return `<div class="print-area">
    ${makePrintHeader(`รายงานผลสอบ ${exam.title}`, `ครู ${exam.teacherName} · ข้อมูล ณ ${thaiDateTime(new Date())}`)}
    <div class="stats-grid-top">
      <div class="overview-metric"><span>${icon('bar-chart', 11)} คะแนนเฉลี่ย</span><strong>${metrics.averagePercent} <small>%</small></strong></div>
      <div class="overview-metric"><span>${icon('trending-up', 11)} คะแนนสูงสุด</span><strong>${formatNumber(metrics.highest, 1)} <small>/ ${exam.totalPoints}</small></strong></div>
      <div class="overview-metric"><span>${icon('award', 11)} ผ่านเกณฑ์</span><strong>${metrics.passRate} <small>%</small></strong></div>
    </div>
    <div class="stats-two-col">
      <div class="stats-panel">
        <div class="stats-panel__head"><div><h2>การกระจายของคะแนน</h2><p>สัดส่วนผู้เข้าสอบตามช่วงคะแนน</p></div><div class="stats-actions no-print"><button class="btn btn--ghost btn--sm" type="button" data-export-exam>${icon('download', 12)} Excel</button><button class="btn btn--ghost btn--sm" type="button" data-print>${icon('printer', 12)} พิมพ์</button></div></div>
        <div class="distribution-chart">
          ${distribution.map(d => `<div class="distribution-row"><span>${d.label}</span><span class="distribution-row__bar"><span style="width:${maxBin ? Math.max(3, (d.count / maxBin) * 100) : 3}%"></span></span><strong>${d.count} คน</strong></div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px">
          <div class="overview-metric"><span>${icon('clipboard-check', 10)} ส่งแล้ว</span><strong>${metrics.submitted} <small>คน</small></strong></div>
          <div class="overview-metric"><span>${icon('users', 10)} ทั้งหมด</span><strong>${metrics.total} <small>คน</small></strong></div>
        </div>
      </div>
      <div class="stats-panel">
        <div class="stats-panel__head"><div><h2>อันดับคะแนน</h2><p>เรียงจากคะแนนรวมสูงสุด</p></div><span class="badge badge--neutral">Top ${Math.min(8, ranking.length)}</span></div>
        <div class="rank-list">
          ${ranking.slice(0, 8).map((r, i) => `<div class="rank-row"><span class="rank-index ${i < 3 ? 'rank-index--top' : ''}">${i + 1}</span>${avatar(r.student.name, r.student.id, 'xs')}<div class="rank-row__copy"><strong>${e(r.student.name)}</strong><span>${scoreToneLabel(r.score.percent, exam.passPercent)}</span></div><span class="rank-row__score">${formatNumber(r.score.total, 1)}/${r.score.max}</span></div>`).join('') || `<div class="table-empty">ยังไม่มีผลสอบ</div>`}
        </div>
      </div>
    </div>
    <div class="stats-two-col" style="margin-top:16px">
      <div class="stats-panel">
        <div class="stats-panel__head"><div><h2>ความแม่นยำรายข้อ</h2><p>ข้อใดที่นักเรียนตอบถูกน้อยที่สุด</p></div><span class="badge badge--neutral">${qstats.length} ข้อ</span></div>
        <div class="accuracy-list">
          ${qstats.map(s => `<div class="accuracy-row"><span class="accuracy-num">${s.index + 1}</span><div class="accuracy-copy"><strong>${mathText(s.q.text)}</strong><div class="progress-mini"><span style="width:${s.type === 'essay' ? (s.q.points ? Math.round((s.average / s.q.points) * 100) : 0) : s.correctPercent}%"></span></div></div><div class="accuracy-value">${s.type === 'essay' ? formatNumber(s.average, 1) + '/' + s.q.points : s.correctPercent + '%'}<small>${s.type === 'essay' ? 'เฉลี่ย' : `ตอบถูก ${s.correct}/${s.total}`}</small></div></div>`).join('')}
        </div>
      </div>
      <div class="stats-panel">
        <div class="stats-panel__head"><div><h2>สรุปภาพรวม</h2><p>ภาพรวมผลการประเมิน</p></div></div>
        <div class="result-summary-line"><span>คะแนนต่ำสุด</span><strong>${formatNumber(metrics.lowest, 1)} / ${exam.totalPoints}</strong></div>
        <div class="result-summary-line"><span>คะแนนสูงสุด</span><strong>${formatNumber(metrics.highest, 1)} / ${exam.totalPoints}</strong></div>
        <div class="result-summary-line"><span>ผ่านเกณฑ์</span><strong>${metrics.passed} / ${metrics.submitted} คน</strong></div>
        <div class="result-summary-line"><span>อัตราผ่าน</span><strong>${metrics.passRate}%</strong></div>
        <div class="result-summary-line"><span>คะแนนอัตนัยเต็ม</span><strong>${subjectiveTotal} คะแนน</strong></div>
        <div class="result-summary-line"><span>ตรวจแล้ว</span><strong>${metrics.graded} / ${metrics.submitted} คน</strong></div>
        <div class="notice-strip notice-strip--info" style="margin-top:14px">${icon('info', 14)}<span>สถิติคำนวณจากคำตอบที่ส่งแล้ว ${metrics.submitted} คน และอัปเดตทันทีเมื่อมีการตรวจหรือแก้คะแนน</span></div>
      </div>
    </div>
  </div>`;
}

function scoreToneLabel(percentValue, passPercent) {
  if (percentValue >= 80) return 'ยอดเยี่ยม';
  if (percentValue >= passPercent) return 'ผ่านเกณฑ์';
  return 'ควรพัฒนา';
}

function openAnnounceModal(exam) {
  const metrics = examMetrics(exam);
  const already = exam.status === 'announced';
  const optionRow = (key, title, desc) => `<div class="switch-row">
    <div class="switch-row__copy"><strong>${title}</strong><span>${desc}</span></div>
    <button class="switch" type="button" role="switch" data-setting="${key}" aria-checked="${Boolean(exam.settings?.[key])}"></button>
  </div>`;
  openModal({
    title: already ? 'ตั้งค่าการแสดงผลให้นักเรียน' : 'ประกาศผลสอบ?',
    eyebrow: already ? 'อัปเดตการมองเห็น' : 'ขั้นตอนสุดท้าย',
    size: 'md',
    body: `<div class="submit-summary">
      <span class="submit-summary__icon">${icon('award', 21)}</span>
      <span class="submit-summary__copy"><strong>${e(exam.title)}</strong><span>${metrics.total} คนในห้อง · ส่งแล้ว ${metrics.submitted} คน · ตรวจครบ ${Math.max(0, metrics.submitted - metrics.pendingReview)}/${metrics.submitted}</span></span>
    </div>
    ${metrics.pendingReview ? `<div class="notice-strip" style="margin-bottom:8px">${icon('alert-triangle', 15)}<span>ยังมีคำตอบรอตรวจ ${metrics.pendingReview} รายการ คุณยังสามารถประกาศผลได้ และกลับมาแก้คะแนนภายหลัง</span></div>` : `<div class="notice-strip notice-strip--success" style="margin-bottom:8px">${icon('check-circle', 15)}<span>คำตอบทั้งหมดได้รับการตรวจแล้ว พร้อมประกาศผล</span></div>`}
    <div style="margin-top:9px">
      ${optionRow('showScore', 'แสดงคะแนน', 'ให้นักเรียนเห็นคะแนนรวมและคะแนนรายข้อ')}
      ${optionRow('showSolutions', 'แสดงเฉลยรายข้อ', 'เปิดให้ดูคำตอบที่ถูกและคำอธิบาย')}
      ${optionRow('showRank', 'แสดงอันดับในห้อง', 'แสดงลำดับคะแนนเมื่อเทียบกับเพื่อน')}
    </div>
    ${!already ? `<div class="modal-note">${icon('info', 14)} เมื่อประกาศผลแล้ว ชุดสอบจะปิดรับคำตอบ และนักเรียนทุกคนที่มีคำตอบจะเห็นผลทันที</div>` : ''}`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-close>ยกเลิก</button>
      <button class="btn btn--primary" type="button" data-confirm-announce>${icon(already ? 'save' : 'award', 15)} ${already ? 'บันทึกการตั้งค่า' : 'ประกาศผลเลย'}</button>`,
    onMount(overlay) {
      overlay.querySelectorAll('[data-setting]').forEach(btn => btn.addEventListener('click', () => {
        btn.setAttribute('aria-checked', btn.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
      }));
      overlay.querySelector('[data-confirm-announce]').addEventListener('click', () => {
        ['showScore', 'showSolutions', 'showRank'].forEach(key => {
          const btn = overlay.querySelector(`[data-setting="${key}"]`);
          exam.settings[key] = btn?.getAttribute('aria-checked') === 'true';
        });
        if (!already) {
          exam.status = 'announced';
          exam.publishedAt = new Date().toISOString();
        }
        saveDB();
        closeModal();
        toast(already ? 'อัปเดตการแสดงผลแล้ว' : 'ประกาศผลสอบแล้ว นักเรียนจะเห็นคะแนนทันที', 'success', 3600);
        refreshRoute();
      });
    }
  });
}

function bindDeleteExamButtons(session) {
  document.querySelectorAll('[data-delete-exam]').forEach(btn => btn.addEventListener('click', () => confirmDeleteExam(btn.dataset.deleteExam, session)));
}

async function confirmDeleteExam(examId, session) {
  const exam = findExam(examId);
  if (!exam) return;
  const attempts = getExamAttempts(examId).length;
  const ok = await confirmDialog({
    title: 'ลบชุดสอบนี้?',
    message: `“${exam.title}” จะถูกลบออกจากระบบ${attempts ? ` พร้อมคำตอบและผลสอบ ${attempts} รายการ` : ''} การลบนี้ย้อนกลับไม่ได้`,
    confirmLabel: 'ลบชุดสอบ',
    tone: 'danger',
    iconName: 'trash'
  });
  if (!ok) return;
  const result = deleteExam(examId, session);
  if (!result.ok) {
    toast(result.error || 'ไม่สามารถลบชุดสอบได้', 'error');
    return;
  }
  toast(`ลบ “${result.title}” แล้ว`, 'success');
  if (window.location.hash.includes(`/exam/${examId}`)) navigate('/teacher/exams');
  else refreshRoute();
}

function bindExamActions(exam, session) {
  bindDeleteExamButtons(session);
  document.querySelectorAll('[data-publish-exam]').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'เผยแพร่ชุดสอบให้ครูทุกคนเห็น?',
      message: 'ชุดสอบจะออกจากสถานะฉบับร่าง ครูทุกคนจะเห็นข้อมูลและผู้สร้าง แต่ยังไม่เปิดให้นักเรียนเข้าสอบ',
      confirmLabel: 'เผยแพร่',
      iconName: 'users'
    });
    if (!ok) return;
    exam.status = 'saved';
    exam.savedAt = new Date().toISOString();
    saveDB();
    toast('เผยแพร่แล้ว ครูทุกคนเห็นชุดสอบนี้ได้', 'success');
    refreshRoute();
  }));
  document.querySelectorAll('[data-open-exam]').forEach(btn => btn.addEventListener('click', async () => {
    const openingDraft = exam.status === 'draft' || exam.status === 'saved';
    const ok = await confirmDialog({
      title: openingDraft ? 'เปิดสอบชุดนี้?' : 'เปิดสอบอีกครั้ง?',
      message: `นักเรียนจะสามารถใช้รหัส ${exam.code} เพื่อเข้าสอบได้ตามวันและเวลาที่กำหนด`,
      confirmLabel: 'เปิดสอบ',
      iconName: 'play'
    });
    if (!ok) return;
    exam.status = 'open';
    if (!openingDraft) exam.openAt = new Date().toISOString();
    if (!exam.openAt) exam.openAt = new Date().toISOString();
    if (!exam.closeAt || new Date(exam.closeAt).getTime() <= Date.now()) {
      exam.closeAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    }
    saveDB();
    toast('เปิดสอบแล้ว แจกรหัสให้นักเรียนได้เลย', 'success');
    refreshRoute();
  }));
  document.querySelectorAll('[data-close-exam]').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'ปิดสอบตอนนี้?',
      message: 'นักเรียนจะไม่สามารถเข้าสอบใหม่ได้ แต่ผู้ที่กำลังทำอยู่จะยังทำต่อจนหมดเวลาหรือส่งคำตอบ',
      confirmLabel: 'ปิดสอบ',
      tone: 'danger',
      iconName: 'lock'
    });
    if (!ok) return;
    exam.status = 'closed';
    saveDB();
    toast('ปิดรับคำตอบแล้ว คุณยังสามารถตรวจและประกาศผลได้', 'warning');
    refreshRoute();
  }));
  document.querySelectorAll('[data-announce]').forEach(btn => btn.addEventListener('click', () => openAnnounceModal(exam)));
  document.querySelectorAll('[data-export-exam]').forEach(btn => btn.addEventListener('click', () => {
    exportExamExcel(exam);
    toast('ดาวน์โหลดไฟล์ Excel แล้ว', 'success');
  }));
  document.querySelectorAll('[data-copy-link]').forEach(btn => btn.addEventListener('click', async () => {
    const base = `${window.location.origin}${window.location.pathname}`;
    await copyText(`${base}#/login?code=${exam.code}&fresh=1`);
    toast('คัดลอกลิงก์เข้าสอบแล้ว', 'success');
    btn.innerHTML = `${icon('check', 12)} คัดลอกแล้ว`;
  }));
}

function bindStudentsTab(exam, metrics) {
  const search = document.querySelector('[data-student-search]');
  const select = document.querySelector('[data-student-status]');
  const rows = [...document.querySelectorAll('[data-student-row]')];
  const count = document.querySelector('[data-student-count]');
  const empty = document.querySelector('[data-student-empty]');
  function filter() {
    const query = (search?.value || '').trim().toLowerCase();
    const status = select?.value || 'all';
    let visible = 0;
    rows.forEach(row => {
      const matchQuery = !query || row.dataset.name.includes(query) || row.dataset.code.toLowerCase().includes(query);
      const matchStatus = status === 'all' || row.dataset.status === status;
      const show = matchQuery && matchStatus;
      row.classList.toggle('hidden', !show);
      if (show) visible += 1;
    });
    if (count) count.textContent = `${visible} คน`;
    if (empty) empty.style.display = visible ? 'none' : 'block';
  }
  search?.addEventListener('input', filter);
  select?.addEventListener('change', filter);

  document.querySelectorAll('[data-force-submit]').forEach(btn => btn.addEventListener('click', async () => {
    const attempt = getDB().attempts.find(a => a.id === btn.dataset.forceSubmit);
    if (!attempt) return;
    const ok = await confirmDialog({
      title: 'บังคับส่งคำตอบ?',
      message: 'ระบบจะส่งคำตอบที่มีอยู่ของนักเรียนคนนี้ทันที และนักเรียนจะไม่สามารถแก้ไขได้อีก',
      confirmLabel: 'บังคับส่ง',
      tone: 'danger',
      iconName: 'send'
    });
    if (!ok) return;
    submitAttempt(attempt, { forced: true });
    toast(`บังคับส่งคำตอบของ ${attempt.studentName} แล้ว`, 'success');
    refreshRoute();
  }));

  document.querySelectorAll('[data-remind]').forEach(btn => btn.addEventListener('click', () => {
    const studentName = btn.dataset.studentName;
    addNotice({
      target: `student:${btn.dataset.remind}`,
      title: 'ครูส่งสัญญาณเตือน',
      body: 'กรุณาตรวจสอบเวลาสอบและส่งคำตอบก่อนหมดเวลา',
      kind: 'warning',
      href: `#/student/exam/${exam.id}/instructions`
    });
    toast(`ส่งการแจ้งเตือนถึง ${studentName} แล้ว`, 'success', 2600);
  }));

  document.querySelector('[data-remind-all]')?.addEventListener('click', () => {
    const targets = metrics.rows.filter(r => !r.attempt || r.attempt.status === 'in_progress');
    targets.forEach(r => {
      addNotice({
        target: `student:${r.student.id}`,
        title: 'ครูส่งสัญญาณเตือน',
        body: 'กรุณาตรวจสอบเวลาสอบและส่งคำตอบก่อนหมดเวลา',
        kind: 'warning',
        href: `#/student/exam/${exam.id}/instructions`
      });
    });
    toast(`ส่งการแจ้งเตือนถึง ${targets.length} คนแล้ว`, 'success');
  });
}

function bindGradingTab(exam) {
  const filters = document.querySelectorAll('[data-grade-filter]');
  const entries = [...document.querySelectorAll('.grading-entry')];
  function applyFilter(mode) {
    entries.forEach(entry => {
      entry.classList.toggle('hidden', mode === 'pending' && entry.dataset.gradeStatus === 'graded');
    });
    document.querySelectorAll('[data-grade-section]').forEach(section => {
      const visible = [...section.querySelectorAll('.grading-entry')].some(en => !en.classList.contains('hidden'));
      section.classList.toggle('hidden', !visible);
    });
    const all = document.querySelector('[data-graded-all]');
    if (all) all.hidden = mode !== 'pending' || entries.some(e => e.dataset.gradeStatus === 'pending');
  }
  filters.forEach(btn => btn.addEventListener('click', () => {
    filters.forEach(b => b.classList.toggle('is-active', b === btn));
    applyFilter(btn.dataset.gradeFilter);
  }));
  applyFilter('pending');

  document.querySelectorAll('[data-save-grade]').forEach(btn => btn.addEventListener('click', () => {
    const card = btn.closest('.grading-entry');
    const attempt = getDB().attempts.find(a => a.id === card.dataset.attemptId);
    const question = exam.questions.find(q => q.id === card.dataset.questionId);
    if (!attempt || !question) return;
    const scoreRaw = card.querySelector('[data-grade-score]').value.trim();
    const score = Number(scoreRaw);
    if (scoreRaw === '' || Number.isNaN(score) || score < 0 || score > question.points) {
      toast(`กรุณาให้คะแนนระหว่าง 0–${question.points}`, 'error');
      card.querySelector('[data-grade-score]').focus();
      return;
    }
    const comment = card.querySelector('[data-grade-comment]').value.trim();
    attempt.manualScores = attempt.manualScores || {};
    attempt.manualScores[question.id] = { score, comment, gradedAt: new Date().toISOString() };
    attempt.reviewed = true;
    attempt.status = pendingEssayQuestions(exam, attempt).length ? 'submitted' : 'graded';
    if (attempt.status === 'graded') attempt.gradedAt = new Date().toISOString();
    saveDB();
    toast(`บันทึกคะแนนของ ${attempt.studentName} แล้ว`, 'success');
    refreshRoute();
  }));
}

export function teacherExamView(ctx) {
  const { session } = ctx;
  const exam = findExam(ctx.examId);
  if (!exam) {
    return {
      html: teacherShell(session, { active: 'exams', crumb: 'ไม่พบชุดสอบ', content: `<div class="teacher-card">${emptyState({ iconName: 'file-text', title: 'ไม่พบชุดสอบ', text: 'ชุดสอบนี้อาจถูกลบหรือลิงก์ไม่ถูกต้อง', action: '<a class="btn btn--primary" href="#/teacher/exams">กลับชุดสอบทั้งหมด</a>' })}</div>` }),
      mount: () => mountTeacherShell(session)
    };
  }
  if (!canViewExam(exam, session)) return examAccessDenied(session);
  const canManage = canManageExam(exam, session);
  const canEdit = canEditExam(exam, session);
  const canViewStats = canViewExamStats(exam, session);
  const requested = ['overview', 'students', 'grading', 'stats'].includes(ctx.tab) ? ctx.tab : 'overview';
  const allowed = requested === 'overview'
    || ((requested === 'students' || requested === 'grading') && canManage)
    || (requested === 'stats' && canViewStats);
  const tab = allowed ? requested : 'overview';
  const metrics = examMetrics(exam);
  let tabContent = '';
  if (tab === 'students') tabContent = studentsTab(exam, metrics);
  else if (tab === 'grading') tabContent = gradingTab(exam, metrics);
  else if (tab === 'stats') tabContent = statsTab(exam, metrics);
  else tabContent = overviewTab(exam, metrics, canManage, canViewStats);
  const content = `${examHeader(exam, metrics, { tab, canManage, canEdit, canViewStats })}
    <div data-tab-content>${tabContent}</div>`;
  return {
    html: teacherShell(session, { active: 'exams', crumb: exam.shortTitle || exam.title, content }),
    mount() {
      mountTeacherShell(session);
      if (canManage) {
        bindExamActions(exam, session);
        if (tab === 'students') bindStudentsTab(exam, metrics);
        if (tab === 'grading') bindGradingTab(exam);
      } else {
        document.querySelectorAll('[data-copy-link]').forEach(btn => btn.addEventListener('click', async () => {
          const base = `${window.location.origin}${window.location.pathname}`;
          await copyText(`${base}#/login?code=${exam.code}&fresh=1`);
          toast('คัดลอกลิงก์เข้าสอบแล้ว', 'success');
          btn.innerHTML = `${icon('check', 12)} คัดลอกแล้ว`;
        }));
        document.querySelectorAll('[data-export-exam]').forEach(btn => btn.addEventListener('click', () => {
          exportExamExcel(exam);
          toast('ดาวน์โหลดไฟล์ Excel แล้ว', 'success');
        }));
      }
    }
  };
}

export function teacherAnswerView(ctx) {
  const { session } = ctx;
  const exam = findExam(ctx.examId);
  const attempt = exam ? getDB().attempts.find(a => a.id === ctx.attemptId && a.examId === exam.id) : null;
  if (!exam || !attempt) {
    return {
      html: teacherShell(session, { active: 'review', crumb: 'ไม่พบคำตอบ', content: `<div class="teacher-card">${emptyState({ iconName: 'file-text', title: 'ไม่พบคำตอบนี้', text: 'คำตอบอาจถูกลบหรือลิงก์ไม่ถูกต้อง', action: '<a class="btn btn--primary" href="#/teacher/review">กลับคิวตรวจ</a>' })}</div>` }),
      mount: () => mountTeacherShell(session)
    };
  }
  if (!canManageExam(exam, session)) {
    return {
      html: teacherShell(session, { active: 'review', crumb: 'อ่านอย่างเดียว', content: `<div class="teacher-card">${emptyState({ iconName: 'lock', title: 'เฉพาะเจ้าของชุดสอบและ Wich', text: 'คุณดูข้อมูลชุดสอบได้ แต่ไม่มีสิทธิ์เปิดตรวจหรือให้คะแนนคำตอบของครูท่านอื่น', action: `<a class="btn btn--primary" href="#/teacher/exam/${exam.id}/overview">ดูภาพรวมชุดสอบ</a>` })}</div>` }),
      mount: () => mountTeacherShell(session)
    };
  }
  if (attempt.status === 'in_progress') {
    return {
      html: teacherShell(session, { active: 'review', crumb: 'กำลังทำข้อสอบ', content: `<div class="teacher-card">${emptyState({ iconName: 'timer', title: 'นักเรียนยังทำข้อสอบไม่เสร็จ', text: `${attempt.studentName} ยังอยู่ในห้องสอบ หากต้องการดูคำตอบที่มีอยู่ ให้บังคับส่งจากหน้ารายชื่อผู้เข้าสอบ`, action: `<a class="btn btn--primary" href="#/teacher/exam/${exam.id}/students">ไปที่รายชื่อผู้เข้าสอบ</a>` })}</div>` }),
      mount: () => mountTeacherShell(session)
    };
  }
  if (!attempt.reviewed) {
    attempt.reviewed = true;
    saveDB();
  }
  const score = attemptScore(exam, attempt);
  const st = attemptStatusMeta(exam, attempt);
  const used = attempt.timeUsedSec || Math.max(1, Math.round((new Date(attempt.submittedAt) - new Date(attempt.startedAt)) / 1000));
  const antiCheat = attempt.antiCheat || [];

  const answerCards = exam.questions.map((q, i) => {
    const value = getAnswerValue(attempt, q.id);
    const manual = attempt.manualScores?.[q.id];
    let statusClass = 'wrong';
    let statusText = 'ตอบผิด';
    if (q.type === 'essay') {
      statusClass = manual ? 'correct' : 'pending';
      statusText = manual ? `ให้ ${formatNumber(manual.score, 1)}/${q.points}` : 'รอตรวจ';
    } else if (isCorrect(q, value)) {
      statusClass = 'correct';
      statusText = 'ถูกต้อง';
    }
    return `<article class="answer-review-card answer-review-card--${statusClass}">
      <div class="answer-review-card__head">
        <span class="answer-review-card__num">${i + 1}</span>
        <div class="answer-review-card__title">
          <strong>${mathText(q.text)}</strong>
          <span>${typeLabel(q.type)} · ${q.points} คะแนน</span>
        </div>
        <span class="answer-review-card__status answer-review-card__status--${statusClass}">${icon(statusClass === 'correct' ? 'check-circle' : statusClass === 'wrong' ? 'x-circle' : 'clock', 13)} ${statusText}</span>
      </div>
      <div class="answer-review-card__body">
        ${questionImageHTML(q, 'answer-review-card__image')}
        ${q.type === 'essay'
          ? `<div class="answer-review-essay ${value ? '' : 'is-empty'}">${value ? e(value) : 'นักเรียนไม่ได้เขียนคำตอบ'}</div>
             <div class="answer-review-line"><span>แนวคำตอบ</span><strong>${mathText(q.reference || '—')}</strong></div>
             <div class="grade-inline">
               <div class="field score-input"><label>คะแนน / ${q.points}</label><input class="input" type="number" min="0" max="${q.points}" step="0.5" value="${manual ? manual.score : ''}" placeholder="0" data-detail-score="${q.id}"></div>
               <div class="field"><label>ความคิดเห็น</label><input class="input" type="text" value="${e(manual?.comment || '')}" placeholder="ความคิดเห็นถึงนักเรียน" data-detail-comment="${q.id}"></div>
               <button class="btn btn--primary" type="button" data-save-detail-grade="${q.id}">${icon('save', 12)} บันทึก</button>
             </div>
             ${manual ? `<div class="grading-saved" style="margin-top:7px">${icon('check-circle', 12)} ตรวจเมื่อ ${thaiTime(manual.gradedAt)} น.</div>` : ''}`
          : `<div class="answer-review-line"><span>คำตอบของนักเรียน</span><strong class="${isCorrect(q, value) ? 'is-correct' : 'is-wrong'}">${mathText(answerText(q, value))}</strong>${optionImageHTML(q.type === 'mcq' ? q.options.find(o => o.id === String(value)) : null, 'answer-review-line__image')}</div>
             ${!isCorrect(q, value) ? `<div class="answer-review-line"><span>คำตอบที่ถูก</span><strong class="is-correct">${mathText(correctAnswerText(q))}</strong>${optionImageHTML(q.type === 'mcq' ? q.options.find(o => o.id === String(q.correct)) : null, 'answer-review-line__image')}</div>` : ''}
             ${q.explanation ? `<div class="answer-explanation" style="margin-top:4px">${icon('info', 12)}<span>${mathText(q.explanation)}</span></div>` : ''}`}
      </div>
    </article>`;
  }).join('');

  const content = `<div class="answer-detail-shell print-area">
    ${makePrintHeader(`คำตอบของ ${attempt.studentName}`, `${exam.title} · ${attempt.submittedAt ? thaiDateTime(attempt.submittedAt) : ''}`)}
    <a class="page-back no-print" href="#/teacher/exam/${exam.id}/students">${icon('arrow-left', 15)} กลับรายชื่อผู้เข้าสอบ</a>
    <div class="answer-student-hero">
      <div class="answer-student-hero__main">
        ${avatar(attempt.studentName, attempt.studentId, 'lg')}
        <div><h2>${e(attempt.studentName)}</h2><p>${e(attempt.studentCode)} · ${e(attempt.studentClass)} · ${e(exam.title)}</p></div>
      </div>
      <div class="answer-student-hero__score">
        <strong>${formatNumber(score.total, 1)}<span> / ${score.max}</span></strong>
        <p>${score.percent}% · ${score.percent >= exam.passPercent ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}</p>
      </div>
      <div class="exam-admin-head__actions no-print">
        <button class="btn btn--ghost btn--sm" type="button" data-override-open>${icon('edit', 13)} ปรับคะแนน</button>
        <button class="btn btn--ghost btn--sm" type="button" data-print>${icon('printer', 13)} พิมพ์</button>
      </div>
    </div>
    <div class="answer-meta-strip">
      <span>${badge(st.label, st.tone)}</span>
      <span>${icon('calendar', 11)} ส่งเมื่อ ${thaiDateTime(attempt.submittedAt)}</span>
      <span>${icon('clock', 11)} ใช้เวลา ${formatStopwatch(used)}</span>
      <span>${icon('clipboard-check', 11)} ตอบแล้ว ${exam.questions.filter(q => getAnswerValue(attempt, q.id) !== '').length}/${exam.questions.length} ข้อ</span>
      ${antiCheat.length ? `<span style="color:#8a641f">${icon('alert-triangle', 11)} พบกิจกรรม ${antiCheat.length} ครั้ง</span>` : `<span class="ok">${icon('shield-check', 11)} ไม่พบกิจกรรมผิดปกติ</span>`}
    </div>
    <div class="answer-detail-grid">
      <div class="answer-detail-list">${answerCards}</div>
      <aside class="answer-side">
        <div class="card">
          <h3>สรุปคะแนน</h3>
          <div class="result-summary-line"><span>ปรนัย + เติมคำ</span><strong>${formatNumber(score.auto, 1)} คะแนน</strong></div>
          <div class="result-summary-line"><span>อัตนัย (ตรวจมือ)</span><strong>${formatNumber(score.manual, 1)} คะแนน</strong></div>
          <div class="result-summary-line"><span>รวม</span><strong>${formatNumber(score.total, 1)} / ${score.max}</strong></div>
          <div class="result-summary-line"><span>เกณฑ์ผ่าน</span><strong>${exam.passPercent}%</strong></div>
          ${score.overridden ? `<div class="result-summary-line"><span>ปรับคะแนนโดยครู</span><strong style="color:var(--coral-dark)">${formatNumber(score.total, 1)} คะแนน</strong></div>
             <div style="margin-top:9px" class="notice-strip notice-strip--info">${icon('info', 13)}<span>${e(attempt.overrideNote || 'ครูปรับคะแนนด้วยตนเอง')} <button type="button" data-override-clear style="border:0;background:none;color:var(--blue);font-size:9px;padding:0;text-decoration:underline">ยกเลิกการปรับ</button></span></div>` : ''}
        </div>
        <div class="card">
          <h3>ความเรียบร้อยในการสอบ</h3>
          ${antiCheat.length ? `<div class="integrity-box is-warning">${icon('alert-triangle', 16)}<span>พบการสลับหน้าจอ ${antiCheat.length} ครั้ง ระบบบันทึกไว้เพื่อประกอบการพิจารณา</span></div>` : `<div class="integrity-box">${icon('shield-check', 16)}<span>ไม่พบกิจกรรมที่ผิดปกติระหว่างการสอบ</span></div>`}
          ${antiCheat.length ? `<div class="integrity-events">${antiCheat.map(ev => `<div class="integrity-event">${icon('dot', 8)}<span>${e(ev.label || 'สลับออกจากหน้าสอบ')} · ${thaiTime(ev.at, true)} น.</span></div>`).join('')}</div>` : ''}
        </div>
        <div class="card">
          <h3>ข้อมูลการสอบ</h3>
          <div class="result-summary-line"><span>รหัสชุดสอบ</span><strong>${e(exam.code)}</strong></div>
          <div class="result-summary-line"><span>เริ่มสอบ</span><strong>${thaiTime(attempt.startedAt)} น.</strong></div>
          <div class="result-summary-line"><span>ส่งคำตอบ</span><strong>${thaiTime(attempt.submittedAt)} น.</strong></div>
          ${attempt.autoSubmitted ? `<div class="result-summary-line"><span>การส่ง</span><strong style="color:var(--amber)">ระบบส่งอัตโนมัติ</strong></div>` : ''}
          ${attempt.forced ? `<div class="result-summary-line"><span>การส่ง</span><strong style="color:var(--red)">ครูบังคับส่ง</strong></div>` : ''}
        </div>
        <div class="notice-strip notice-strip--success">${icon('check-circle', 14)}<span>เปิดดูคำตอบแล้ว สถานะ “รอตรวจ” ของรายการนี้จะถูกอัปเดต</span></div>
      </aside>
    </div>
  </div>`;

  return {
    html: teacherShell(session, { active: 'review', crumb: `คำตอบ · ${attempt.studentName}`, content }),
    mount() {
      mountTeacherShell(session);
      document.querySelectorAll('[data-save-detail-grade]').forEach(btn => btn.addEventListener('click', () => {
        const qid = btn.dataset.saveDetailGrade;
        const q = exam.questions.find(x => x.id === qid);
        const input = document.querySelector(`[data-detail-score="${qid}"]`);
        const comment = document.querySelector(`[data-detail-comment="${qid}"]`).value.trim();
        const raw = input.value.trim();
        const value = Number(raw);
        if (raw === '' || Number.isNaN(value) || value < 0 || value > q.points) {
          toast(`กรุณาให้คะแนนระหว่าง 0–${q.points}`, 'error');
          input.focus();
          return;
        }
        attempt.manualScores = attempt.manualScores || {};
        attempt.manualScores[qid] = { score: value, comment, gradedAt: new Date().toISOString() };
        attempt.reviewed = true;
        attempt.status = pendingEssayQuestions(exam, attempt).length ? 'submitted' : 'graded';
        if (attempt.status === 'graded') attempt.gradedAt = new Date().toISOString();
        saveDB();
        toast('บันทึกคะแนนข้อนี้แล้ว', 'success');
        refreshRoute();
      }));

      document.querySelector('[data-override-open]')?.addEventListener('click', () => {
        openModal({
          title: 'ปรับคะแนนรวม',
          eyebrow: 'Teacher override',
          size: 'sm',
          body: `<div class="notice-strip notice-strip--info" style="margin-bottom:14px">${icon('info', 14)}<span>ใช้เมื่อต้องการแก้ไขคะแนนที่ระบบคำนวณไว้ คะแนนที่ปรับจะใช้แทนคะแนนรวมทั้งหมด</span></div>
            <div class="field"><label for="override-score">คะแนนรวมใหม่ (เต็ม ${exam.totalPoints})</label><input class="input input--lg" id="override-score" type="number" min="0" max="${exam.totalPoints}" step="0.5" value="${Number.isFinite(Number(attempt.overrideScore)) ? attempt.overrideScore : score.total}" autofocus></div>
            <div class="field" style="margin-top:12px"><label for="override-note">เหตุผลในการปรับ</label><textarea class="textarea" id="override-note" style="min-height:80px" placeholder="เช่น ตรวจทานคำตอบข้อ 20 ใหม่">${e(attempt.overrideNote || '')}</textarea></div>
            <div class="form-error" data-override-error style="margin-top:10px">${icon('alert-circle', 14)}<span></span></div>`,
          footer: `<button class="btn btn--ghost" type="button" data-modal-close>ยกเลิก</button><button class="btn btn--primary" type="button" data-save-override>${icon('save', 14)} บันทึกคะแนน</button>`,
          onMount(overlay) {
            overlay.querySelector('[data-save-override]').addEventListener('click', () => {
              const raw = overlay.querySelector('#override-score').value.trim();
              const val = Number(raw);
              const error = overlay.querySelector('[data-override-error]');
              if (raw === '' || Number.isNaN(val) || val < 0 || val > exam.totalPoints) {
                error.querySelector('span').textContent = `กรุณากรอกคะแนนระหว่าง 0–${exam.totalPoints}`;
                error.classList.add('is-visible');
                return;
              }
              attempt.overrideScore = val;
              attempt.overrideNote = overlay.querySelector('#override-note').value.trim() || 'ครูปรับคะแนนด้วยตนเอง';
              attempt.overrideAt = new Date().toISOString();
              attempt.reviewed = true;
              saveDB();
              closeModal();
              toast('ปรับคะแนนรวมแล้ว', 'success');
              refreshRoute();
            });
          }
        });
      });
      document.querySelector('[data-override-clear]')?.addEventListener('click', () => {
        delete attempt.overrideScore;
        delete attempt.overrideNote;
        delete attempt.overrideAt;
        saveDB();
        toast('คืนค่าคะแนนที่ระบบคำนวณแล้ว', 'info');
        refreshRoute();
      });
    }
  };
}

export function teacherReviewView(ctx) {
  const { session } = ctx;
  const db = getDB();
  const all = db.attempts
    .filter(a => a.status !== 'in_progress')
    .map(a => ({ attempt: a, exam: db.exams.find(x => x.id === a.examId) }))
    .filter(x => x.exam && canManageExam(x.exam, session))
    .sort((a, b) => new Date(b.attempt.submittedAt) - new Date(a.attempt.submittedAt));
  const needsReview = ({ attempt, exam }) => !attempt.reviewed || pendingEssayQuestions(exam, attempt).length > 0;
  const pending = all.filter(needsReview).length;
  const rows = all.map(({ attempt: a, exam }) => {
    const score = attemptScore(exam, a);
    const status = needsReview({ attempt: a, exam }) ? { label: 'รอตรวจ', tone: 'warning' } : { label: 'ตรวจแล้ว', tone: 'success' };
    return `<tr data-review-row data-review-status="${needsReview({ attempt: a, exam }) ? 'pending' : 'reviewed'}" data-name="${e(a.studentName.toLowerCase())}" data-exam="${e(exam.title.toLowerCase())}">
      <td><div class="table-person">${avatar(a.studentName, a.studentId, 'sm')}<span class="table-person__copy"><strong>${e(a.studentName)}</strong><span>${e(a.studentCode)}</span></span></div></td>
      <td><span class="exam-pill"><span class="subject-dot"></span>${e(exam.shortTitle || exam.title)}</span></td>
      <td><span style="font-size:9.5px;color:var(--muted)">${thaiTime(a.submittedAt)} น. · ${relativeTime(a.submittedAt)}</span></td>
      <td>${badge(status.label, status.tone)}</td>
      <td><strong class="table-number">${formatNumber(score.total, 1)}</strong><span style="font-size:8.5px;color:var(--muted)"> / ${score.max}</span></td>
      <td><div class="table-actions"><a class="btn btn--primary" href="#/teacher/exam/${exam.id}/answer/${a.id}">${icon('eye', 12)} ตรวจคำตอบ</a></div></td>
    </tr>`;
  }).join('');

  const content = `<div class="teacher-page-head">
    <div><div class="eyebrow">${icon('clipboard-check', 12)} คิวงานครู</div><h1>ตรวจคำตอบ</h1><p>รวมคำตอบจากชุดสอบที่คุณดูแล เรียงจากใหม่ไปเก่า</p></div>
    <div class="teacher-page-head__actions"><a class="btn btn--ghost" href="#/teacher/exams">${icon('file-text', 15)} ไปที่ชุดสอบ</a></div>
  </div>
  <div class="metric-grid" style="grid-template-columns:repeat(3,1fr)">
    ${metricCard({ iconName: 'clipboard-check', label: 'รอตรวจ', value: pending, unit: 'รายการ', accent: true, dot: pending > 0, foot: 'เปิดดูเพื่อเคลียร์คิว' })}
    ${metricCard({ iconName: 'check-circle', label: 'ตรวจแล้ว', value: all.length - pending, unit: 'รายการ', foot: 'พร้อมประกาศผล' })}
    ${metricCard({ iconName: 'file-text', label: 'ชุดสอบที่มีคำตอบ', value: new Set(all.map(x => x.exam.id)).size, unit: 'ชุด', foot: 'จากทุกวิชา' })}
  </div>
  <section class="teacher-card">
    <div class="table-toolbar">
      <div class="table-toolbar__left">
        <label class="search-field">${icon('search', 17)}<input type="search" placeholder="ค้นหาชื่อนักเรียนหรือชุดสอบ..." data-review-search></label>
        <div class="chip-select" data-review-filters>
          <button class="chip is-active" type="button" data-review-filter="pending">รอตรวจ (${pending})</button>
          <button class="chip" type="button" data-review-filter="reviewed">ตรวจแล้ว (${all.length - pending})</button>
          <button class="chip" type="button" data-review-filter="all">ทั้งหมด (${all.length})</button>
        </div>
      </div>
      <span class="table-caption" data-review-count>${pending} รายการ</span>
    </div>
    <div class="scroll-x">
      <table class="data-table review-queue-table">
        <thead><tr><th>นักเรียน</th><th>ชุดสอบ</th><th>เวลาส่ง</th><th>สถานะ</th><th>คะแนน</th><th style="text-align:right">การกระทำ</th></tr></thead>
        <tbody data-review-rows>${rows}</tbody>
      </table>
      <div data-review-empty style="display:none" class="table-empty">ไม่พบรายการที่ตรงกับตัวกรอง</div>
    </div>
  </section>`;

  return {
    html: teacherShell(session, { active: 'review', crumb: 'ตรวจคำตอบ', content }),
    mount() {
      mountTeacherShell(session);
      let currentFilter = 'pending';
      const rowsEls = [...document.querySelectorAll('[data-review-row]')];
      const search = document.querySelector('[data-review-search]');
      const count = document.querySelector('[data-review-count]');
      const empty = document.querySelector('[data-review-empty]');
      function apply() {
        const q = (search?.value || '').trim().toLowerCase();
        let visible = 0;
        rowsEls.forEach(row => {
          const match = (currentFilter === 'all' || row.dataset.reviewStatus === currentFilter)
            && (!q || row.dataset.name.includes(q) || row.dataset.exam.includes(q));
          row.classList.toggle('hidden', !match);
          if (match) visible++;
        });
        count.textContent = `${visible} รายการ`;
        empty.style.display = visible ? 'none' : 'block';
      }
      document.querySelectorAll('[data-review-filter]').forEach(btn => btn.addEventListener('click', () => {
        currentFilter = btn.dataset.reviewFilter;
        document.querySelectorAll('[data-review-filter]').forEach(b => b.classList.toggle('is-active', b === btn));
        apply();
      }));
      search?.addEventListener('input', apply);
      apply();
    }
  };
}

function exportStudentsExcel(students = getDB().students, session = null) {
  const db = getDB();
  const allowedExamIds = session
    ? new Set(visibleExams(session, db).filter(exam => canViewExamStats(exam, session)).map(exam => exam.id))
    : null;
  const rows = students.map((student, i) => {
    const attempts = db.attempts.filter(a => a.studentId === student.id && a.status !== 'in_progress' && (!allowedExamIds || allowedExamIds.has(a.examId)));
    const scores = attempts.map(a => {
      const exam = db.exams.find(x => x.id === a.examId);
      return exam ? attemptScore(exam, a).percent : 0;
    });
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : '';
    const last = [...attempts].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
    return `<tr><td>${i + 1}</td><td>${e(student.name)}</td><td>${e(student.code)}</td><td>${e(organizationName(student.orgId, db))}</td><td>${e(student.class)}</td><td>${attempts.length}</td><td>${avg === '' ? '-' : avg + '%'}</td><td>${last ? thaiDateTime(last.submittedAt) : '-'}</td></tr>`;
  }).join('');
  const html = `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;font-family:Tahoma}th{background:#111111;color:#fff}</style></head><body><h2>ทะเบียนนักเรียน</h2><table><thead><tr><th>#</th><th>ชื่อ–นามสกุล</th><th>รหัสนักเรียน</th><th>หน่วยงาน</th><th>class</th><th>จำนวนการสอบ</th><th>คะแนนเฉลี่ย</th><th>สอบล่าสุด</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  downloadFile('02mock-students.xls', html, 'application/vnd.ms-excel;charset=utf-8');
}

function classCheckboxList(selectedIds = [], { name = 'classIds', classes = null } = {}) {
  const db = getDB();
  const list = classes || db.classes;
  if (!list.length) {
    return `<div class="class-option-empty">${icon('graduation-cap', 18)}<span>ยังไม่มี class ในหน่วยงานนี้ · Wich สร้าง class ใหม่ได้</span></div>`;
  }
  const selected = new Set(selectedIds);
  return `<div class="class-option-list">
    ${list.map(cls => `<label class="class-option">
      <input type="checkbox" name="${e(name)}" value="${e(cls.id)}" ${selected.has(cls.id) ? 'checked' : ''}>
      <span class="class-option__copy"><strong>${e(cls.code)}</strong><small>${studentsInClass(cls.id, db).length} คน</small></span>
    </label>`).join('')}
  </div>`;
}

function openStudentClassesModal(studentId) {
  const db = getDB();
  const student = db.students.find(s => s.id === studentId);
  if (!student) return;
  const org = findOrganization(student.orgId, db);
  const classes = db.classes.filter(cls => cls.orgId === student.orgId);
  const selected = classIdsOf(student);
  openModal({
    title: 'class ของนักเรียน',
    eyebrow: 'ทะเบียนนักเรียน',
    size: 'sm',
    body: `<div class="student-class-modal">
      <div class="student-class-modal__person">
        ${avatar(student.name, student.id, 'sm')}
        <div><strong>${e(student.name)}</strong><span>${e(student.code)} · ${e(org?.name || '')}</span></div>
      </div>
      <div class="field">
        <div class="field__label-row"><span class="field__label">เลือก class ที่นักเรียนอยู่</span><span class="field__hint">เลือกได้มากกว่า 1 class</span></div>
        ${classCheckboxList(selected, { classes })}
        <span class="field__hint">การเปลี่ยน class ไม่กระทบประวัติการสอบหรือสิทธิ์ในชุดสอบเดิม</span>
      </div>
      <div class="form-error" data-student-class-error>${icon('alert-circle', 15)}<span></span></div>
    </div>`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-close>ยกเลิก</button>
      <button class="btn btn--primary" type="button" data-save-student-classes>${icon('check', 15)} บันทึก class</button>`,
    onMount(overlay) {
      const error = overlay.querySelector('[data-student-class-error]');
      overlay.querySelector('[data-save-student-classes]').addEventListener('click', () => {
        const ids = [...overlay.querySelectorAll('input[name="classIds"]:checked')].map(input => input.value);
        const result = setStudentClasses(student.id, ids);
        if (!result.ok) {
          error.querySelector('span').textContent = result.error;
          error.classList.add('is-visible');
          return;
        }
        closeModal();
        toast(`อัปเดต class ของ ${student.name} เป็น ${result.student.class} แล้ว`, 'success');
        refreshRoute();
      });
      overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => closeModal());
    }
  });
}

function openClassManager(session, initialOrgId = '') {
  const db = getDB();
  const org = findOrganization(initialOrgId, db) || db.organizations.find(o => o.id === currentTeacher(session)?.orgId) || db.organizations[0];
  if (!org) { toast('ยังไม่มีหน่วยงาน', 'error'); return; }
  const classes = db.classes.filter(cls => cls.orgId === org.id);
  const counts = new Map(classes.map(cls => [cls.id, studentsInClass(cls.id, db).length]));
  openModal({
    title: 'จัดการ class',
    eyebrow: `เฉพาะ Wich · ${org.name}`,
    size: 'md',
    body: `<div class="class-manager">
      <div class="form-grid" style="margin-bottom:12px">
        <div class="field" style="margin:0"><label for="class-org-select">หน่วยงานของ class</label>
          <select class="select" id="class-org-select" data-class-org-select>
            ${db.organizations.map(o => `<option value="${e(o.id)}" ${o.id === org.id ? 'selected' : ''}>${e(o.name)} · ${e(o.shortName)}</option>`).join('')}
          </select>
        </div>
      </div>
      <label class="class-manager__scope">
        <input type="checkbox" data-class-all-orgs>
        <span><strong>สร้างพร้อมกันทุกหน่วยงาน</strong><small>สร้าง class รหัสเดียวกันในทั้ง ${db.organizations.length} หน่วยงาน และข้ามหน่วยงานที่มี class นี้อยู่แล้ว</small></span>
      </label>
      <div class="class-manager__add">
        <div class="field" style="margin:0;flex:1"><label for="new-class-code" data-class-add-label>สร้าง class ใหม่ใน ${e(org.name)}</label><input class="input" id="new-class-code" data-new-class-code maxlength="32" placeholder="เช่น CSCA-C, TAS-A1 หรือ รหัสที่คุณใช้จริง"></div>
        <button class="btn btn--primary" type="button" data-add-class>${icon('plus', 14)} เพิ่ม class</button>
      </div>
      <div class="class-manager__list">
        ${classes.length ? classes.map(cls => {
          const count = counts.get(cls.id) || 0;
          return `<div class="class-manager__row" data-class-row="${e(cls.id)}">
            <span class="class-manager__hash">#</span>
            <input class="input input--sm" value="${e(cls.code)}" data-class-name="${e(cls.id)}" aria-label="ชื่อ class ${e(cls.code)}">
            <span class="class-manager__count">${count} คน</span>
            <button class="icon-btn" type="button" data-save-class="${e(cls.id)}" title="บันทึกชื่อ class" aria-label="บันทึกชื่อ class">${icon('check', 14)}</button>
            <button class="icon-btn icon-btn--danger" type="button" data-delete-class="${e(cls.id)}" title="${count ? 'ย้ายนักเรียนออกก่อน' : 'ลบ class'}" aria-label="ลบ class" ${count ? 'disabled' : ''}>${icon('trash', 14)}</button>
          </div>`;
        }).join('') : `<div class="class-manager__empty">${icon('graduation-cap', 20)}<span>ยังไม่มี class ในหน่วยงานนี้ สร้างรหัสแรกได้เลย</span></div>`}
      </div>
      <div class="form-error" data-class-error>${icon('alert-circle', 15)}<span></span></div>
      <div class="modal-note">${icon('info', 14)} class ผูกกับหน่วยงาน · นักเรียน 1 คนอยู่ได้หลาย class ในหน่วยงานเดียวกัน · ลบ class ได้เมื่อไม่มีสมาชิกอยู่</div>
    </div>`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-close>ปิด</button>`,
    onMount(overlay) {
      const input = overlay.querySelector('[data-new-class-code]');
      const error = overlay.querySelector('[data-class-error]');
      const showError = message => {
        error.querySelector('span').textContent = message;
        error.classList.add('is-visible');
      };
      const reopen = message => {
        if (message) toast(message, 'success');
        refreshRoute();
        closeModal();
        setTimeout(() => openClassManager(session, org.id), 30);
      };
      overlay.querySelector('[data-class-org-select]')?.addEventListener('change', ev => {
        closeModal();
        setTimeout(() => openClassManager(session, ev.target.value), 30);
      });
      const allOrgs = overlay.querySelector('[data-class-all-orgs]');
      const orgSelect = overlay.querySelector('[data-class-org-select]');
      const addLabel = overlay.querySelector('[data-class-add-label]');
      const syncScope = () => {
        const all = Boolean(allOrgs?.checked);
        if (orgSelect) orgSelect.disabled = all;
        if (addLabel) addLabel.textContent = all ? `สร้าง class ใหม่ในทุกหน่วยงาน (${db.organizations.length})` : `สร้าง class ใหม่ใน ${org.name}`;
      };
      allOrgs?.addEventListener('change', syncScope);
      syncScope();
      const add = () => {
        if (allOrgs?.checked) {
          const result = addClassAcrossOrganizations(input.value, session);
          if (!result.ok) { showError(result.error); input.focus(); return; }
          const skipped = result.skipped.length ? ` · ข้าม ${result.skipped.length} หน่วยงานที่มีอยู่แล้ว` : '';
          reopen(`เพิ่ม class ${result.created[0].class.code} ใน ${result.created.length} หน่วยงาน${skipped}`);
          return;
        }
        const result = addClass(input.value, session, org.id);
        if (!result.ok) { showError(result.error); input.focus(); return; }
        reopen(`เพิ่ม class ${result.class.code} ใน ${org.name} แล้ว`);
      };
      overlay.querySelector('[data-add-class]').addEventListener('click', add);
      input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); add(); } });

      overlay.querySelectorAll('[data-save-class]').forEach(btn => btn.addEventListener('click', () => {
        const id = btn.dataset.saveClass;
        const value = overlay.querySelector(`[data-class-name="${id}"]`)?.value;
        const result = renameClass(id, value, session);
        if (!result.ok) { showError(result.error); return; }
        reopen(`เปลี่ยนชื่อ class เป็น ${result.class.code} แล้ว`);
      }));
      overlay.querySelectorAll('[data-delete-class]').forEach(btn => btn.addEventListener('click', () => {
        const result = deleteClass(btn.dataset.deleteClass, session);
        if (!result.ok) { showError(result.error); return; }
        reopen(`ลบ class ${result.code} แล้ว`);
      }));
      overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => closeModal());
    }
  });
}

function studentCodeDefaults(org, db) {
  const code = generateStudentCode(db, org);
  return { code, password: generateStudentPassword(code) };
}

function openAddStudentModal(session, defaultOrgId = '') {
  const db = getDB();
  const owner = hasAllOrganizationAccess(session);
  const defaultOrg = owner
    ? (findOrganization(defaultOrgId, db) || findOrganization(currentTeacher(session)?.orgId, db) || db.organizations[0])
    : findOrganization(currentTeacher(session)?.orgId, db);
  if (!defaultOrg) { toast('ยังไม่มีหน่วยงานสำหรับเพิ่มนักเรียน', 'error'); return; }
  let passwordTouched = false;
  const initial = studentCodeDefaults(defaultOrg, db);
  let classes = db.classes.filter(cls => cls.orgId === defaultOrg.id);
  let selectedClassIds = classes[0] ? [classes[0].id] : [];
  openModal({
    title: 'เพิ่มรายชื่อนักเรียน',
    eyebrow: owner ? 'Wich · เลือกหน่วยงานได้' : `นักเรียนใหม่จะอยู่ใน ${defaultOrg.name}`,
    size: 'sm',
    body: `<form id="add-student-form" novalidate>
      <div class="field">
        <label for="new-student-name">ชื่อ–นามสกุล <span style="color:var(--coral)">*</span></label>
        <input class="input input--lg" id="new-student-name" name="name" placeholder="เช่น สมชาย ใจดี" autocomplete="off" autofocus>
      </div>
      <div class="field">
        <label for="new-student-org">หน่วยงาน / โรงเรียน <span style="color:var(--coral)">*</span></label>
        ${owner ? `<select class="select input--lg" id="new-student-org" name="orgId">
          ${db.organizations.map(org => `<option value="${e(org.id)}" ${org.id === defaultOrg.id ? 'selected' : ''}>${e(org.name)} · ${e(org.shortName)}</option>`).join('')}
        </select>` : `<div class="fixed-field">${icon('school', 15)}<strong>${e(defaultOrg.name)}</strong><span>${e(defaultOrg.shortName)}</span></div>`}
        <span class="field__hint">${owner ? 'Wich เลือกหน่วยงานให้นักเรียนได้' : 'ครูสร้างนักเรียนในหน่วยงานของตนเองอัตโนมัติ ไม่ต้องเลือกโรงเรียน'}</span>
      </div>
      <div class="field">
        <label for="new-student-code">รหัสนักเรียน</label>
        <div class="code-generate-row">
          <input class="input input--lg" id="new-student-code" name="code" placeholder="เช่น SAT1001" autocomplete="off" value="${e(initial.code)}">
          <button class="btn btn--ghost" type="button" data-generate-student-code>${icon('key', 14)} สร้างรหัส</button>
        </div>
        <span class="field__hint">ค่าเริ่มต้น = ชื่อย่อหน่วยงาน + เลข 4 หลัก เช่น SAT1001 · แก้ไขได้</span>
      </div>
      <div class="field">
        <label for="new-student-password">รหัสผ่านเริ่มต้น</label>
        <input class="input input--lg" id="new-student-password" name="password" value="${e(initial.password)}" autocomplete="off">
        <span class="field__hint">ค่าเริ่มต้น = รหัสนักเรียน · แก้ไขได้ และนักเรียนเปลี่ยนเองได้ภายหลัง</span>
      </div>
      <div class="field">
        <div class="field__label-row"><span class="field__label">class ของนักเรียน *</span><span class="field__hint">เลือกได้มากกว่า 1 class</span></div>
        <div data-student-class-options>${classCheckboxList(selectedClassIds, { classes })}</div>
        <span class="field__hint">${owner ? 'นักเรียนอยู่ได้หลาย class ในหน่วยงานเดียวกัน' : 'เลือก class ที่มีอยู่ในหน่วยงานของคุณ · class สร้างโดย Wich'}</span>
      </div>
      ${owner ? `<div class="field">
        <label for="new-student-class-code">สร้าง class ใหม่ (ไม่บังคับ)</label>
        <input class="input" id="new-student-class-code" name="newClassName" maxlength="32" placeholder="เช่น CSCA-C, TAS-A1">
        <span class="field__hint">ถ้ากรอก ระบบจะสร้าง class นี้ในหน่วยงานที่เลือกและเพิ่มนักเรียนเข้าไปพร้อมกัน</span>
      </div>` : ''}
      <div class="form-error" data-add-student-error>${icon('alert-circle', 15)}<span></span></div>
      <p class="field__hint" style="margin-top:12px">${icon('shield-check', 12)} รหัสนักเรียนต้องไม่ซ้ำ · รหัสผ่านเปลี่ยนได้จากโปรไฟล์นักเรียน</p>
    </form>`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-close>ยกเลิก</button>
      <button class="btn btn--primary" type="submit" form="add-student-form">${icon('plus', 15)} เพิ่มนักเรียน</button>`,
    onMount(overlay) {
      const form = overlay.querySelector('#add-student-form');
      const error = overlay.querySelector('[data-add-student-error]');
      const newClassInput = overlay.querySelector('#new-student-class-code');
      const codeInput = overlay.querySelector('#new-student-code');
      const passwordInput = overlay.querySelector('#new-student-password');
      const orgSelect = overlay.querySelector('#new-student-org');
      const classOptions = overlay.querySelector('[data-student-class-options]');
      const showError = (message) => {
        error.querySelector('span').textContent = message;
        error.classList.add('is-visible');
      };
      const selectedOrg = () => findOrganization(orgSelect?.value, getDB()) || defaultOrg;
      const refreshClasses = () => {
        classes = getDB().classes.filter(cls => cls.orgId === selectedOrg().id);
        selectedClassIds = classes[0] ? [classes[0].id] : [];
        classOptions.innerHTML = classCheckboxList(selectedClassIds, { classes });
      };
      const refreshDefaults = () => {
        const next = studentCodeDefaults(selectedOrg(), getDB());
        codeInput.value = next.code;
        if (!passwordTouched) passwordInput.value = next.password;
      };
      overlay.querySelector('[data-generate-student-code]')?.addEventListener('click', () => {
        const next = studentCodeDefaults(selectedOrg(), getDB());
        codeInput.value = next.code;
        if (!passwordTouched) passwordInput.value = next.password;
        codeInput.focus();
        codeInput.select();
      });
      passwordInput?.addEventListener('input', () => { passwordTouched = true; });
      codeInput?.addEventListener('input', () => {
        if (!passwordTouched) passwordInput.value = generateStudentPassword(codeInput.value);
      });
      orgSelect?.addEventListener('change', () => {
        refreshClasses();
        refreshDefaults();
        if (newClassInput) newClassInput.value = '';
      });
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const data = new FormData(form);
        const org = selectedOrg();
        let ids = [...form.querySelectorAll('input[name="classIds"]:checked')].map(input => input.value);
        const newName = owner ? String(data.get('newClassName') || '').trim() : '';
        if (newName) {
          const created = addClass(newName, session, org.id);
          if (created.ok) ids.push(created.class.id);
          else if (created.existing) ids.push(created.existing.id);
          else { showError(created.error); newClassInput.focus(); return; }
        }
        const uniqueIds = [...new Set(ids)];
        if (!uniqueIds.length) {
          showError('กรุณาเลือก class อย่างน้อย 1 class');
          return;
        }
        const result = addStudent({
          name: data.get('name'),
          code: data.get('code'),
          password: data.get('password'),
          classIds: uniqueIds,
          orgId: org.id
        }, session);
        if (!result.ok) {
          showError(result.error);
          return;
        }
        closeModal();
        refreshRoute();
        openStudentCreatedModal(result.student, result.organization);
      });
    }
  });
}

function openStudentCreatedModal(student, org) {
  openModal({
    title: 'เพิ่มนักเรียนแล้ว',
    eyebrow: 'บัญชีพร้อมใช้งาน',
    size: 'sm',
    body: `<div class="teacher-created">
      <div class="teacher-created__hero">${avatar(student.name, student.id, 'lg')}<div><strong>${e(student.name)}</strong><span>${e(org?.name || 'ไม่ระบุหน่วยงาน')} · ${e(student.class || '')}</span></div></div>
      <div class="teacher-created__credential"><span>รหัสนักเรียน</span><strong>${e(student.code)}</strong><button class="icon-btn" type="button" data-copy="${e(student.code)}" aria-label="คัดลอกรหัสนักเรียน" title="คัดลอกรหัส">${icon('copy', 14)}</button></div>
      <div class="teacher-created__credential teacher-created__credential--soft"><span>รหัสผ่าน</span><strong>${e(student.password)}</strong><button class="icon-btn" type="button" data-copy="${e(student.password)}" aria-label="คัดลอกรหัสผ่าน" title="คัดลอกรหัสผ่าน">${icon('copy', 14)}</button></div>
      <p class="teacher-created__hint">${icon('info', 14)} นักเรียนเข้าสู่ระบบด้วยรหัส <strong>${e(student.code)}</strong> และรหัสผ่านด้านบน · เปลี่ยนรหัสได้จากโปรไฟล์นักเรียน</p>
    </div>`,
    footer: `<button class="btn btn--primary" type="button" data-modal-close>เสร็จสิ้น</button>`,
    onMount(overlay) {
      overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => closeModal());
      mountCopyButtons(overlay);
    }
  });
}

function openMoveStudentOrgModal(student, session) {
  const db = getDB();
  openModal({
    title: 'ย้ายหน่วยงานนักเรียน',
    eyebrow: 'เฉพาะ Wich Pitchon',
    size: 'sm',
    body: `<form id="move-student-org-form">
      <div class="student-class-modal__person">${avatar(student.name, student.id, 'sm')}<div><strong>${e(student.name)}</strong><span>${e(student.code)} · ${e(organizationName(student.orgId, db))}</span></div></div>
      <div class="field"><label for="move-student-org">หน่วยงานปลายทาง</label>
        <select class="select input--lg" id="move-student-org" name="orgId">
          ${db.organizations.map(org => `<option value="${e(org.id)}" ${org.id === student.orgId ? 'selected' : ''}>${e(org.name)} · ${e(org.shortName)}</option>`).join('')}
        </select>
        <span class="field__hint">ระบบจะเลือก class แรกของหน่วยงานปลายทางให้ · ต้องมี class อยู่ก่อน</span>
      </div>
      <div class="form-error" data-move-student-error>${icon('alert-circle', 15)}<span></span></div>
    </form>`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-close>ยกเลิก</button><button class="btn btn--primary" type="submit" form="move-student-org-form">${icon('school', 14)} ย้ายหน่วยงาน</button>`,
    onMount(overlay) {
      overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => closeModal());
      overlay.querySelector('#move-student-org-form')?.addEventListener('submit', ev => {
        ev.preventDefault();
        const orgId = new FormData(ev.target).get('orgId');
        const result = updateStudentOrg(student.id, orgId, session);
        if (!result.ok) {
          const error = overlay.querySelector('[data-move-student-error]');
          error.querySelector('span').textContent = result.error;
          error.classList.add('is-visible');
          return;
        }
        closeModal();
        toast('ย้ายหน่วยงานนักเรียนแล้ว', 'success');
        refreshRoute();
      });
    }
  });
}

async function confirmRemoveStudent(studentId, session) {
  const db = getDB();
  const student = db.students.find(s => s.id === studentId);
  if (!student) return;
  const attemptCount = db.attempts.filter(a => a.studentId === studentId).length;
  const ok = await confirmDialog({
    title: 'ลบรายชื่อนักเรียน?',
    message: `ลบ “${student.name}” ออกจากทะเบียนหรือไม่${attemptCount ? ` ประวัติการสอบ ${attemptCount} รายการของนักเรียนคนนี้จะถูกลบไปด้วย` : ' รายชื่อนี้ยังไม่มีประวัติการสอบ'}`,
    confirmLabel: 'ลบรายชื่อ',
    tone: 'danger',
    iconName: 'trash'
  });
  if (!ok) return;
  const result = removeStudent(studentId, session);
  if (!result.ok) {
    toast(result.error || 'ไม่สามารถลบรายชื่อได้', 'error');
    return;
  }
  toast(`ลบ ${result.name} ออกจากทะเบียนแล้ว`, 'warning');
  refreshRoute();
}

function orgTypeLabel(org) {
  return org?.type === 'agency' ? 'หน่วยงาน' : 'โรงเรียน';
}

function organizationCards(db, canManage = false, myOrgId = '') {
  if (!canManage) return '';
  const ownerOrgId = db.teachers.find(t => t.isOwner && !t.deletedAt)?.orgId;
  const cards = db.organizations.map(org => {
    const staffCount = db.teachers.filter(t => !t.deletedAt && t.orgId === org.id).length;
    const studentCount = db.students.filter(s => s.orgId === org.id).length;
    const canDelete = org.id !== ownerOrgId && org.id !== myOrgId;
    const access = org.accessLevel === 'manage_all'
      ? 'จัดการทุกหน่วยงาน'
      : org.accessLevel === 'view_all' ? 'เห็นทุกหน่วยงาน' : 'เห็นเฉพาะหน่วยงาน';
    return `<article class="org-card">
      <div class="org-card__top">
        <span class="org-card__icon">${icon(org.type === 'school' ? 'school' : 'layout-dashboard', 16)}</span>
        <div class="org-card__identity"><strong>${e(org.name)}</strong><span>${orgTypeLabel(org)} · ชื่อย่อ <strong>${e(org.shortName)}</strong></span></div>
        <div class="org-card__actions">
          <button class="icon-btn" type="button" data-edit-org="${e(org.id)}" title="แก้ไขหน่วยงาน" aria-label="แก้ไข ${e(org.name)}">${icon('edit', 14)}</button>
          ${canDelete ? `<button class="icon-btn icon-btn--danger" type="button" data-delete-org="${e(org.id)}" title="ลบหน่วยงาน" aria-label="ลบ ${e(org.name)}">${icon('trash', 14)}</button>` : ''}
        </div>
      </div>
      <div class="org-card__stats"><span>${icon('users', 11)} ${staffCount} คน</span><span>${icon('graduation-cap', 11)} ${studentCount} นักเรียน</span></div>
      <div class="org-card__hint">${icon('key', 10)} รหัสหน้า: ${e(org.shortName)} · ${e(access)}${org.id === ownerOrgId ? ' · หน่วยงานของ Wich' : org.id === myOrgId ? ' · หน่วยงานของคุณ' : ''}</div>
    </article>`;
  }).join('');
  return `<section class="org-section">
    <div class="org-section__head">
      <div><div class="eyebrow">${icon('school', 12)} โครงสร้างองค์กร</div><h2>หน่วยงานและโรงเรียน</h2><p>ใช้ชื่อย่อเพื่อสร้างรหัสครูและรหัสผ่านนักเรียนในหน่วยงานนั้น</p></div>
      <button class="btn btn--ghost btn--sm" type="button" data-create-org>${icon('plus', 14)} สร้างหน่วยงาน</button>
    </div>
    <div class="org-grid">${cards || `<div class="org-empty">${icon('school', 18)} ยังไม่มีหน่วยงาน</div>`}</div>
  </section>`;
}

export function teacherStaffView(ctx) {
  const { session } = ctx;
  const db = getDB();
  const owner = isOwnerTeacher(session);
  const globalAccess = hasAllOrganizationAccess(session);
  const canManageOrgs = canManageOrganizations(session);
  const manager = isManagerStaff(session) || canManageOrgs;
  const me = currentTeacher(session);
  const requestedOrg = ctx.query?.get?.('org') || '';
  const orgFilter = globalAccess ? (db.organizations.some(o => o.id === requestedOrg) ? requestedOrg : 'all') : me.orgId;
  const teachers = visibleStaff(session, db, orgFilter);
  const activeTeachers = db.teachers.filter(t => !t.deletedAt);
  const orgs = globalAccess ? db.organizations : db.organizations.filter(o => o.id === me.orgId);
  const scopedStudents = globalAccess
    ? db.students.filter(s => orgFilter === 'all' || s.orgId === orgFilter)
    : db.students.filter(s => s.orgId === me.orgId);
  const scopedClasses = globalAccess
    ? db.classes.filter(c => orgFilter === 'all' || c.orgId === orgFilter)
    : db.classes.filter(c => c.orgId === me.orgId);
  const cards = teachers.map(t => {
    const org = findOrganization(t.orgId, db);
    const examCount = db.exams.filter(exam => exam.teacherId === t.id).length;
    const publishedCount = db.exams.filter(exam => exam.teacherId === t.id && exam.status !== 'draft').length;
    const roleLabel = t.roleLabel || (t.staffRole === 'manager' ? 'ผู้จัดการ' : 'ครูผู้สอน');
    return `<article class="staff-card ${t.isOwner ? 'staff-card--owner' : ''}">
      <div class="staff-card__head">
        <button class="staff-card__person" type="button" data-staff-open="${e(t.id)}" aria-label="เปิดข้อมูล ${e(t.name)}">
          ${avatar(t.name, t.id, 'md')}
          <span class="staff-card__identity"><strong>${e(t.name)}</strong><span>${roleLabel}</span></span>
        </button>
        ${t.isOwner ? badge('OWNER', 'draft') : t.staffRole === 'manager' ? badge('MANAGER', 'info') : ''}
      </div>
      <div class="staff-card__code">${icon('key', 13)} <span>รหัสครู</span><strong>${e(t.code)}</strong></div>
      <div class="staff-card__school">${icon('school', 14)} <span>${e(org?.name || t.school || 'ไม่ระบุโรงเรียน')}</span><span class="staff-card__orgshort">${e(org?.shortName || '')}</span></div>
      <div class="staff-card__meta">
        <div><span>ชุดสอบ</span><strong>${examCount} ชุด</strong></div>
        <div><span>เผยแพร่แล้ว</span><strong>${publishedCount} ชุด</strong></div>
      </div>
      <div class="staff-card__foot">
        <span>${t.createdAt ? `เข้าร่วม ${thaiDate(t.createdAt)}` : 'บัญชีผู้ดูแล'}</span>
        <button class="btn btn--link" type="button" data-staff-open="${e(t.id)}">${owner || globalAccess ? 'จัดการบัญชี' : 'ดูข้อมูล'}</button>
      </div>
    </article>`;
  }).join('');

  const filterSelect = globalAccess ? `<select class="select" data-staff-org-filter aria-label="กรองตามหน่วยงาน">
    <option value="all">ทุกหน่วยงาน (${activeTeachers.length})</option>
    ${db.organizations.map(org => `<option value="${e(org.id)}" ${orgFilter === org.id ? 'selected' : ''}>${e(org.name)} (${activeTeachers.filter(t => t.orgId === org.id).length})</option>`).join('')}
  </select>` : '';
  const scopeName = orgFilter === 'all' ? 'ทุกหน่วยงาน' : findOrganization(orgFilter, db)?.name || 'หน่วยงาน';
  const content = `<div class="teacher-page-head">
    <div><div class="eyebrow">${icon('school', 12)} การจัดการทีม</div><h1>ครูและบุคลากร</h1><p>${canManageOrgs ? 'เห็นทุกหน่วยงาน สร้าง/ลบหน่วยงาน และจัดการบุคลากรได้ทุกหน่วยงาน' : manager ? `ผู้จัดการเพิ่มหรือลบครูได้เฉพาะใน ${e(scopeName)} · สร้างได้เฉพาะบัญชีครู` : `บุคลากรใน ${e(scopeName)} · ดูข้อมูลได้อย่างเดียว`}</p></div>
    <div class="teacher-page-head__actions">
      ${owner || canManageOrgs ? `<button class="btn btn--primary" type="button" data-create-teacher>${icon('plus', 16)} สร้างบัญชีครู / ผู้จัดการ</button>` : manager ? `<button class="btn btn--primary" type="button" data-create-teacher>${icon('plus', 16)} เพิ่มครูในหน่วยงาน</button>` : `<span class="badge badge--neutral">${icon('eye', 11)} อ่านอย่างเดียว</span>`}
    </div>
  </div>
  ${canManageOrgs ? organizationCards(db, canManageOrgs, me?.orgId) : `<div class="notice-strip notice-strip--info" style="margin-bottom:14px">${icon('school', 15)}<span><strong>${e(scopeName)}</strong> · ชื่อย่อ ${e(findOrganization(me.orgId, db)?.shortName || '—')}</span></div>`}
  <div class="staff-summary">
    <div class="overview-metric"><span>${icon('users', 11)} ครูและบุคลากร</span><strong>${teachers.length} <small>คน</small></strong></div>
    <div class="overview-metric"><span>${icon('school', 11)} หน่วยงานที่เห็น</span><strong>${orgFilter === 'all' ? orgs.length : 1} <small>แห่ง</small></strong></div>
    <div class="overview-metric"><span>${icon('graduation-cap', 11)} นักเรียนในขอบเขต</span><strong>${scopedStudents.length} <small>คน</small></strong></div>
    <div class="overview-metric"><span>${icon('file-text', 11)} class</span><strong>${scopedClasses.length} <small>class</small></strong></div>
  </div>
  ${globalAccess ? `<div class="table-toolbar staff-toolbar">${filterSelect}<span class="table-caption">แสดง ${teachers.length} คน · ${e(scopeName)}</span></div>` : ''}
  <div class="notice-strip notice-strip--info" style="margin-bottom:16px">${icon('shield-check', 15)}<span><strong>สิทธิ์:</strong> ${globalAccess ? 'หน่วยงานหลักเห็นข้อมูลบุคลากร นักเรียน และชุดสอบของทุกหน่วยงาน' : 'ครูในหน่วยงานเห็นนักเรียนและบุคลากรของหน่วยงานตนเองเท่านั้น'}</span></div>
  <div class="staff-grid">${cards || `<div class="card">${emptyState({ iconName: 'users', title: 'ยังไม่มีบุคลากรในขอบเขตนี้', text: owner || canManageOrgs ? 'สร้างบัญชีครูคนแรกในหน่วยงานนี้' : manager ? 'เพิ่มบัญชีครูคนแรกในหน่วยงานของคุณ' : 'ยังไม่มีบัญชีครูในหน่วยงานของคุณ' })}</div>`}</div>`;
  return {
    html: teacherShell(session, { active: 'staff', crumb: 'ครูและบุคลากร', content }),
    mount() {
      mountTeacherShell(session);
      document.querySelector('[data-create-teacher]')?.addEventListener('click', () => openCreateTeacherModal(session, orgFilter === 'all' ? db.organizations[0]?.id : orgFilter));
      document.querySelector('[data-create-org]')?.addEventListener('click', () => openOrganizationModal(null, session));
      document.querySelectorAll('[data-edit-org]').forEach(btn => btn.addEventListener('click', () => {
        const org = db.organizations.find(o => o.id === btn.dataset.editOrg);
        if (org) openOrganizationModal(org, session);
      }));
      document.querySelectorAll('[data-delete-org]').forEach(btn => btn.addEventListener('click', async () => {
        const org = db.organizations.find(o => o.id === btn.dataset.deleteOrg);
        if (!org) return;
        const teachers = db.teachers.filter(t => !t.deletedAt && t.orgId === org.id).length;
        const students = db.students.filter(st => st.orgId === org.id).length;
        const classes = db.classes.filter(c => c.orgId === org.id).length;
        const exams = db.exams.filter(exam => examOrganizationIds(exam, db).includes(org.id)).length;
        const ok = await confirmDialog({
          title: `ลบ ${org.name}?`,
          message: `การลบหน่วยงานจะลบข้อมูลถาวรทั้งหมดในหน่วยงานนี้: ${teachers} บัญชีครู/บุคลากร, ${students} นักเรียน, ${classes} class และชุดสอบที่ผูกกับหน่วยงานนี้ ${exams} ชุด (ชุดที่แชร์หลายหน่วยงานจะยังอยู่) พร้อมผลสอบที่เกี่ยวข้องหรือไม่`,
          confirmLabel: 'ลบหน่วยงาน',
          tone: 'danger',
          iconName: 'trash'
        });
        if (!ok) return;
        const result = deleteOrganization(org.id, session);
        if (!result.ok) { toast(result.error || 'ลบหน่วยงานไม่สำเร็จ', 'error'); return; }
        toast(`ลบ ${org.name} และข้อมูลในหน่วยงานแล้ว`, 'warning');
        refreshRoute();
      }));
      document.querySelectorAll('[data-staff-open]').forEach(btn => btn.addEventListener('click', () => openStaffDetailModal(btn.dataset.staffOpen, session)));
      document.querySelector('[data-staff-org-filter]')?.addEventListener('change', ev => {
        const value = ev.target.value;
        navigate(`/teacher/staff${value && value !== 'all' ? `?org=${encodeURIComponent(value)}` : ''}`);
      });
    }
  };
}

function maskStaffPassword(value) {
  return '•'.repeat(Math.max(6, Math.min(14, String(value || '').length)));
}

function openCodeEditModal({ kind, id, title, current, session }) {
  const isTeacher = kind === 'teacher';
  openModal({
    title,
    eyebrow: isTeacher ? 'แก้ไขรหัสครู' : 'แก้ไขรหัสนักเรียน',
    size: 'sm',
    body: `<form id="code-edit-form" novalidate>
      <div class="field"><label for="code-edit-value">รหัสใหม่</label>
        <input class="input input--lg" id="code-edit-value" name="code" value="${e(current)}" maxlength="${isTeacher ? 24 : 20}" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase" required autofocus>
        <span class="field__hint">${isTeacher ? '3–24 ตัว ใช้ A–Z, 0–9, จุด, ขีดกลาง หรือขีดล่าง · ใช้เข้าสู่ระบบแทนรหัสเดิมทันที' : '3–20 ตัว ใช้ A–Z, 0–9, จุด, ขีดกลาง หรือขีดล่าง · ใช้เข้าสู่ระบบแทนรหัสเดิมทันที'}</span>
      </div>
      <div class="form-error" data-code-error>${icon('alert-circle', 15)}<span></span></div>
    </form>`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-close>ยกเลิก</button>
      <button class="btn btn--primary" type="submit" form="code-edit-form">${icon('save', 15)} บันทึกรหัสใหม่</button>`,
    onMount(overlay) {
      const form = overlay.querySelector('#code-edit-form');
      const error = overlay.querySelector('[data-code-error]');
      overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => closeModal());
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const next = new FormData(form).get('code');
        const result = isTeacher ? setTeacherCode(id, next, session) : setStudentCode(id, next, session);
        if (!result.ok) {
          error.querySelector('span').textContent = result.error;
          error.classList.add('is-visible');
          return;
        }
        closeModal();
        refreshRoute();
        toast(isTeacher ? 'แก้ไขรหัสครูแล้ว' : 'แก้ไขรหัสนักเรียนแล้ว', 'success');
      });
    }
  });
}

function openStaffDetailModal(teacherId, session) {
  const db = getDB();
  const teacher = db.teachers.find(t => t.id === teacherId && !t.deletedAt);
  if (!teacher) { toast('ไม่พบบัญชีนี้', 'error'); return; }
  const owner = isOwnerTeacher(session);
  const globalAccess = hasAllOrganizationAccess(session);
  const manager = isManagerStaff(session);
  const me = currentTeacher(session);
  if (!owner && !globalAccess && !teacher.isOwner && teacher.orgId !== me?.orgId) {
    toast('คุณไม่มีสิทธิ์ดูบัญชีนอกหน่วยงาน', 'error');
    return;
  }
  const org = findOrganization(teacher.orgId, db);
  const roleLabel = teacher.roleLabel || (teacher.isOwner ? 'ผู้สร้างระบบ' : teacher.staffRole === 'manager' ? 'ผู้จัดการ' : 'ครูผู้สอน');
  const examCount = db.exams.filter(exam => exam.teacherId === teacher.id).length;
  const canDelete = owner ? !teacher.isOwner : (globalAccess || manager) && !teacher.isOwner && teacher.staffRole === 'teacher' && (globalAccess || teacher.orgId === me?.orgId) && teacher.id !== me?.id;
  const canMove = (owner || globalAccess) && !teacher.isOwner;
  const canEditCode = !teacher.isOwner && (owner || globalAccess || Boolean(manager && me?.orgId === teacher.orgId
    && (teacher.staffRole !== 'manager' || teacher.id === me?.id)));
  const isSelf = teacher.id === session.teacherId;
  const showSecret = owner || isSelf;
  const secretBlock = showSecret
    ? `<div class="profile-secret">
        <div class="profile-secret__label"><span>${icon('key', 12)} รหัสผ่านปัจจุบัน</span><small>${isSelf ? 'บัญชีของคุณ · เปลี่ยนได้' : 'เฉพาะ Wich เท่านั้นที่เห็น'}</small></div>
        <div class="profile-secret__row">
          <strong data-staff-secret>${maskStaffPassword(teacher.password)}</strong>
          <button class="icon-btn" type="button" data-staff-reveal aria-label="เปิดดูรหัสผ่าน" title="เปิดดูรหัสผ่าน">${icon('eye', 15)}</button>
          <button class="icon-btn" type="button" data-copy="${e(teacher.password)}" aria-label="คัดลอกรหัสผ่าน" title="คัดลอกรหัสผ่าน">${icon('copy', 13)}</button>
          ${isSelf ? `<button class="btn btn--ghost btn--sm" type="button" data-staff-open-password>เปลี่ยนรหัสผ่าน</button>` : ''}
        </div>
      </div>
      ${isSelf ? `<form class="profile-password-form" data-staff-password-form hidden>
        <div class="field"><label for="staff-new-password">รหัสผ่านใหม่</label><input class="input" id="staff-new-password" name="password" type="password" minlength="4" maxlength="64" autocomplete="new-password" placeholder="อย่างน้อย 4 ตัวอักษร" required></div>
        <div class="field"><label for="staff-confirm-password">ยืนยันรหัสผ่านใหม่</label><input class="input" id="staff-confirm-password" name="confirm" type="password" minlength="4" maxlength="64" autocomplete="new-password" placeholder="พิมพ์อีกครั้ง" required></div>
        <div class="profile-password-form__actions"><button class="btn btn--ghost btn--sm" type="button" data-staff-cancel-password>ยกเลิก</button><button class="btn btn--primary btn--sm" type="submit">${icon('save', 13)} บันทึกรหัสใหม่</button></div>
      </form>` : ''}`
    : '';
  openModal({
    title: 'ข้อมูลครูและบุคลากร',
    eyebrow: owner || globalAccess ? 'จัดการบัญชี' : 'ข้อมูลในหน่วยงาน',
    size: 'sm',
    body: `<div class="account-profile staff-profile">
      <div class="account-profile__hero">
        ${avatar(teacher.name, teacher.id, 'lg')}
        <div><strong>${e(teacher.name)}</strong><span>${e(roleLabel)} · ${e(org?.name || teacher.school || 'ไม่ระบุหน่วยงาน')}</span></div>
      </div>
      <div class="account-profile__details">
        <div class="profile-detail"><span>รหัสครู</span><strong class="profile-code">${e(teacher.code)} <button class="icon-btn" type="button" data-copy="${e(teacher.code)}" aria-label="คัดลอกรหัส" title="คัดลอกรหัส">${icon('copy', 12)}</button>${canEditCode ? `<button class="icon-btn" type="button" data-edit-teacher-code aria-label="แก้ไขรหัสครู" title="แก้ไขรหัสครู">${icon('edit', 12)}</button>` : ''}</strong></div>
        <div class="profile-detail"><span>หน่วยงาน / โรงเรียน</span><strong>${e(org?.name || teacher.school || 'ไม่ระบุ')}</strong></div>
        <div class="profile-detail"><span>บทบาท</span><strong>${e(roleLabel)}</strong></div>
        <div class="profile-detail"><span>ชื่อย่อหน่วยงาน</span><strong>${e(org?.shortName || '—')}</strong></div>
        <div class="profile-detail"><span>ชุดสอบที่สร้าง</span><strong>${examCount} ชุด</strong></div>
        <div class="profile-detail"><span>สร้างบัญชีเมื่อ</span><strong>${teacher.createdAt ? thaiDate(teacher.createdAt) : 'บัญชีหลัก'}</strong></div>
      </div>
      ${owner ? `<form class="staff-role-form" data-staff-role-form>
        <div class="field"><label for="staff-role">ตำแหน่ง / บทบาท</label>
          <select class="select" id="staff-role" name="staffRole">
            ${teacher.isOwner ? `<option value="owner" ${teacher.roleLabel === 'ผู้สร้างระบบ' ? 'selected' : ''}>ผู้สร้างระบบ (เจ้าของ)</option>` : ''}
            <option value="teacher" ${teacher.staffRole !== 'manager' && !(teacher.isOwner && teacher.roleLabel === 'ผู้สร้างระบบ') ? 'selected' : ''}>ครูผู้สอน</option>
            <option value="manager" ${teacher.staffRole === 'manager' ? 'selected' : ''}>ผู้จัดการหน่วยงาน</option>
          </select>
          <span class="field__hint">${teacher.isOwner ? 'Wich ยังคงเป็นเจ้าของระบบ แม้เปลี่ยนตำแหน่งที่แสดง' : 'เปลี่ยนตำแหน่งได้ทันที · ผู้จัดการจะสร้าง/แก้ไขชุดสอบได้เหมือนครู'}</span>
        </div>
        <button class="btn btn--ghost btn--sm" type="submit">${icon('save', 12)} บันทึกตำแหน่ง</button>
      </form>` : ''}
      ${secretBlock}
      ${canMove ? `<form class="staff-move-form" data-staff-move-form>
        <div class="field"><label for="staff-move-org">ย้ายหน่วยงาน / โรงเรียน</label>
          <select class="select" id="staff-move-org" name="orgId">
            ${db.organizations.map(o => `<option value="${e(o.id)}" ${o.id === teacher.orgId ? 'selected' : ''}>${e(o.name)} · ${e(o.shortName)}</option>`).join('')}
          </select>
          <span class="field__hint">${icon('alert-triangle', 11)} การย้ายจะย้ายชุดสอบที่ครูคนนี้สร้างไปยังหน่วยงานใหม่ด้วย</span>
        </div>
        <button class="btn btn--ghost btn--sm" type="submit">${icon('save', 12)} บันทึกหน่วยงาน</button>
      </form>` : ''}
      <p class="account-profile__hint">${icon('shield-check', 12)} ${owner || globalAccess ? 'จัดการรหัส หน่วยงาน และลบบัญชีได้ · รหัสของ Wich ถูกป้องกัน · การลบจะซ่อนบัญชีแต่เก็บประวัติชุดสอบไว้' : 'ผู้จัดการแก้รหัส/เพิ่ม/ลบได้เฉพาะครูในหน่วยงานของตนเอง'}</p>
    </div>`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-close>ปิด</button>
      ${canDelete ? `<button class="btn btn--danger-ghost" type="button" data-staff-delete>${icon('trash', 13)} ลบบัญชีนี้</button>` : ''}`,
    onMount(overlay) {
      mountCopyButtons(overlay);
      overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => closeModal());
      const secret = overlay.querySelector('[data-staff-secret]');
      const reveal = overlay.querySelector('[data-staff-reveal]');
      let visible = false;
      let revealing = false;
      reveal?.addEventListener('click', async () => {
        if (revealing) return;
        if (visible) {
          visible = false;
          if (secret) secret.textContent = maskStaffPassword(teacher.password);
          reveal.innerHTML = icon('eye', 15);
          reveal.setAttribute('aria-label', 'เปิดดูรหัสผ่าน');
          return;
        }
        let value = String(teacher.password || '');
        if (!value) {
          revealing = true;
          reveal.disabled = true;
          const result = await cloudGetPassword('teacher', teacher.id);
          revealing = false;
          reveal.disabled = false;
          if (!result.ok) {
            toast(result.error || 'ไม่พบรหัสผ่านของบัญชีนี้', 'error', 6000);
            return;
          }
          value = result.password;
          teacher.password = value;
        }
        visible = true;
        if (secret) secret.textContent = value;
        reveal.innerHTML = icon('eye-off', 15);
        reveal.setAttribute('aria-label', 'ซ่อนรหัสผ่าน');
      });
      overlay.querySelector('[data-edit-teacher-code]')?.addEventListener('click', () => {
        closeModal();
        setTimeout(() => openCodeEditModal({ kind: 'teacher', id: teacher.id, title: 'แก้ไขรหัสครู', current: teacher.code, session }), 20);
      });
      const passwordForm = overlay.querySelector('[data-staff-password-form]');
      overlay.querySelector('[data-staff-open-password]')?.addEventListener('click', () => {
        passwordForm?.removeAttribute('hidden');
        overlay.querySelector('#staff-new-password')?.focus();
      });
      overlay.querySelector('[data-staff-cancel-password]')?.addEventListener('click', () => {
        passwordForm?.setAttribute('hidden', '');
        passwordForm?.reset();
      });
      passwordForm?.addEventListener('submit', async ev => {
        ev.preventDefault();
        const data = new FormData(passwordForm);
        const next = String(data.get('password') || '');
        if (next !== String(data.get('confirm') || '')) { toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'error'); return; }
        const previous = teacher.password;
        const result = setTeacherPassword(teacher.id, next, session);
        if (!result.ok) { toast(result.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ', 'error'); return; }
        teacher.password = next;
        const submit = passwordForm.querySelector('button[type=submit]');
        if (submit) submit.disabled = true;
        const cloud = await cloudSetPassword('teacher', teacher.id, next);
        if (submit) submit.disabled = false;
        if (!cloud.ok) {
          setTeacherPassword(teacher.id, previous, session);
          teacher.password = previous;
          toast(cloud.error || 'อัปเดตรหัสผ่านบนคลาวด์ไม่สำเร็จ กรุณาลองใหม่', 'error', 6000);
          return;
        }
        if (secret) secret.textContent = maskStaffPassword(next);
        visible = false;
        if (reveal) reveal.innerHTML = icon('eye', 15);
        passwordForm.setAttribute('hidden', '');
        passwordForm.reset();
        toast('เปลี่ยนรหัสผ่านแล้ว', 'success');
      });
      overlay.querySelector('[data-staff-role-form]')?.addEventListener('submit', ev => {
        ev.preventDefault();
        const role = new FormData(ev.currentTarget).get('staffRole');
        const result = setTeacherRole(teacher.id, role, session);
        if (!result.ok) { toast(result.error || 'เปลี่ยนตำแหน่งไม่สำเร็จ', 'error'); return; }
        closeModal();
        toast(`เปลี่ยนตำแหน่งของ ${teacher.name} เป็น ${role === 'owner' ? 'ผู้สร้างระบบ' : role === 'manager' ? 'ผู้จัดการ' : 'ครูผู้สอน'} แล้ว`, 'success');
        refreshRoute();
      });
      overlay.querySelector('[data-staff-move-form]')?.addEventListener('submit', ev => {
        ev.preventDefault();
        const orgId = new FormData(ev.currentTarget).get('orgId');
        const result = updateTeacherOrg(teacher.id, orgId, session);
        if (!result.ok) { toast(result.error || 'ย้ายหน่วยงานไม่สำเร็จ', 'error'); return; }
        closeModal();
        toast(`ย้าย ${teacher.name} ไป ${result.organization.name} แล้ว`, 'success');
        refreshRoute();
      });
      overlay.querySelector('[data-staff-delete]')?.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'ลบบัญชีครู?',
          message: `บัญชี ${teacher.name} จะถูกซ่อนและเข้าสู่ระบบไม่ได้อีก · ชุดสอบและผลสอบเดิมยังอยู่ในหน่วยงาน`,
          confirmLabel: 'ลบบัญชี',
          tone: 'danger',
          iconName: 'trash'
        });
        if (!ok) return;
        const result = removeTeacher(teacher.id, session);
        if (!result.ok) { toast(result.error || 'ลบบัญชีไม่สำเร็จ', 'error'); return; }
        closeModal();
        toast(`ลบบัญชี ${teacher.name} แล้ว`, 'success');
        refreshRoute();
      });
    }
  });
}

function updateTeacherCodeDefaults(overlay, db) {
  const orgId = overlay.querySelector('[name="orgId"]')?.value;
  const role = overlay.querySelector('[name="staffRole"]')?.value || 'teacher';
  const org = findOrganization(orgId, db);
  if (!org) return;
  const codeInput = overlay.querySelector('[name="code"]');
  const passwordInput = overlay.querySelector('[name="password"]');
  const hint = overlay.querySelector('[data-code-hint]');
  const passwordHint = overlay.querySelector('[data-password-hint]');
  const code = nextTeacherCode(db, org.id, role);
  if (codeInput) codeInput.value = code;
  if (passwordInput) passwordInput.value = '123456';
  if (hint) hint.innerHTML = `${icon('info', 12)} ต้องขึ้นต้นด้วย <strong>${e(staffCodePrefix(org, role))}</strong> แล้วต่อท้ายด้วยตัวเลขเท่านั้น · ระบบเติมให้อัตโนมัติ`;
  if (passwordHint) passwordHint.innerHTML = `${icon('info', 12)} รหัสตั้งต้น <strong>123456</strong> · เปลี่ยนได้ภายหลัง`;
}

function openCreateTeacherModal(session, defaultOrgId = '') {
  const db = getDB();
  const owner = isOwnerTeacher(session);
  const globalManager = canManageOrganizations(session);
  const admin = owner || globalManager;
  const manager = isManagerStaff(session);
  if (!admin && !manager) { toast('คุณไม่มีสิทธิ์สร้างบัญชีครู', 'error'); return; }
  const me = currentTeacher(session);
  const orgs = admin ? db.organizations : db.organizations.filter(o => o.id === me?.orgId);
  if (!orgs.length) { toast('สร้างหน่วยงานก่อนเพิ่มบัญชีครู', 'error'); return; }
  const initialOrg = findOrganization(defaultOrgId, db) || orgs[0];
  const initialRole = 'teacher';
  const initialCode = nextTeacherCode(db, initialOrg.id, initialRole);
  const roleField = admin
    ? `<div class="field">
        <label for="new-teacher-role">ประเภทบัญชี</label>
        <select class="select input--lg" id="new-teacher-role" name="staffRole">
          <option value="teacher">ครูผู้สอน</option>
          <option value="manager">ผู้จัดการหน่วยงาน</option>
        </select>
      </div>`
    : `<div class="field">
        <label>ประเภทบัญชี</label>
        <div class="fixed-field">${icon('user-check', 15)}<strong>ครูผู้สอน</strong><span>ผู้จัดการสร้างได้เฉพาะครู</span></div>
        <input type="hidden" name="staffRole" value="teacher">
      </div>`;
  openModal({
    title: admin ? 'สร้างบัญชีครูและบุคลากร' : 'เพิ่มครูในหน่วยงาน',
    eyebrow: admin ? 'ผู้ดูแลระบบ / หน่วยงานหลัก' : 'ผู้จัดการหน่วยงาน',
    size: 'sm',
    body: `<form id="create-teacher-form" novalidate>
      <div class="field">
        <label for="new-teacher-name">ชื่อ–นามสกุล <span style="color:var(--coral)">*</span></label>
        <input class="input input--lg" id="new-teacher-name" name="name" placeholder="เช่น ครูสมชาย ใจดี" autocomplete="off" autofocus>
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="new-teacher-org">หน่วยงาน / โรงเรียน <span style="color:var(--coral)">*</span></label>
          <select class="select input--lg" id="new-teacher-org" name="orgId" ${admin ? '' : 'disabled'}>
            ${orgs.map(org => `<option value="${e(org.id)}" ${org.id === initialOrg.id ? 'selected' : ''}>${e(org.name)} · ${e(org.shortName)}</option>`).join('')}
          </select>
          ${admin ? '' : `<input type="hidden" name="orgId" value="${e(initialOrg.id)}">`}
        </div>
        ${roleField}
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="new-teacher-code">รหัสประจำตัว</label>
          <input class="input input--lg" id="new-teacher-code" name="code" value="${e(initialCode)}" autocomplete="off" style="text-transform:uppercase">
          <span class="field__hint" data-code-hint>${icon('info', 12)} ต้องขึ้นต้นด้วย <strong>${e(staffCodePrefix(initialOrg, initialRole))}</strong> แล้วต่อท้ายด้วยตัวเลขเท่านั้น · ระบบเติมให้อัตโนมัติ</span>
        </div>
        <div class="field">
          <label for="new-teacher-password">รหัสผ่านเริ่มต้น</label>
          <input class="input input--lg" id="new-teacher-password" name="password" value="123456" autocomplete="off">
          <span class="field__hint" data-password-hint>${icon('info', 12)} รหัสตั้งต้น <strong>123456</strong> · เปลี่ยนได้ภายหลัง</span>
        </div>
      </div>
      <div class="form-error" data-create-teacher-error>${icon('alert-circle', 15)}<span></span></div>
      <p class="field__hint" style="margin-top:10px">${icon('shield-check', 12)} ${admin ? 'สร้างได้ทั้งครูและผู้จัดการในทุกหน่วยงาน · ใช้สำหรับผู้ดูแลระบบ/หน่วยงานหลัก' : 'ผู้จัดการเพิ่มได้เฉพาะครูในหน่วยงานของตนเอง · ไม่สามารถสร้างผู้จัดการหรือย้ายหน่วยงานได้'}</p>
    </form>`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-close>ยกเลิก</button>
      <button class="btn btn--primary" type="submit" form="create-teacher-form">${icon('plus', 15)} สร้างบัญชี</button>`,
    onMount(overlay) {
      const form = overlay.querySelector('#create-teacher-form');
      const error = overlay.querySelector('[data-create-teacher-error]');
      overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => closeModal());
      overlay.querySelector('[name="orgId"]')?.addEventListener('change', () => updateTeacherCodeDefaults(overlay, db));
      overlay.querySelector('[name="staffRole"]')?.addEventListener('change', () => updateTeacherCodeDefaults(overlay, db));
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const data = new FormData(form);
        const result = addTeacher({
          name: data.get('name'),
          orgId: data.get('orgId'),
          staffRole: data.get('staffRole'),
          code: data.get('code'),
          password: data.get('password')
        }, session);
        if (!result.ok) {
          error.querySelector('span').textContent = result.error;
          error.classList.add('is-visible');
          return;
        }
        closeModal();
        refreshRoute();
        openTeacherCreatedModal(result.teacher, result.organization);
      });
    }
  });
}

function openTeacherCreatedModal(teacher, org) {
  openModal({
    title: 'สร้างบัญชีแล้ว',
    eyebrow: 'บัญชีพร้อมใช้งาน',
    size: 'sm',
    body: `<div class="teacher-created">
      <div class="teacher-created__hero">${avatar(teacher.name, teacher.id, 'lg')}<div><strong>${e(teacher.name)}</strong><span>${e(org?.name || teacher.school || 'ไม่ระบุโรงเรียน')} · ${teacher.staffRole === 'manager' ? 'ผู้จัดการ' : 'ครูผู้สอน'}</span></div></div>
      <div class="teacher-created__credential">
        <span>รหัสประจำตัว</span><strong>${e(teacher.code)}</strong>
        <button class="icon-btn" type="button" data-copy="${e(teacher.code)}" aria-label="คัดลอกรหัสครู" title="คัดลอกรหัส">${icon('copy', 14)}</button>
      </div>
      <div class="teacher-created__credential teacher-created__credential--soft">
        <span>รหัสผ่าน</span><strong>${e(teacher.password)}</strong>
        <button class="icon-btn" type="button" data-copy="${e(teacher.password)}" aria-label="คัดลอกรหัสผ่าน" title="คัดลอกรหัสผ่าน">${icon('copy', 14)}</button>
      </div>
      <p class="teacher-created__hint">${icon('info', 14)} เข้าสู่ระบบด้วยรหัส <strong>${e(teacher.code)}</strong> หรือชื่อ–นามสกุล <strong>${e(teacher.name)}</strong> พร้อมรหัสผ่านด้านบน · เปลี่ยนรหัสได้ที่ชื่อมุมซ้ายล่าง</p>
    </div>`,
    footer: `<button class="btn btn--primary" type="button" data-modal-close>เสร็จสิ้น</button>`,
    onMount(overlay) {
      overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => closeModal());
      mountCopyButtons(overlay);
    }
  });
}

function openOrganizationModal(org = null, session = null) {
  const db = getDB();
  openModal({
    title: org ? 'แก้ไขหน่วยงาน' : 'สร้างหน่วยงานหรือโรงเรียน',
    eyebrow: canManageOrganizations(session) ? 'จัดการองค์กร' : 'เฉพาะผู้ดูแลระบบ',
    size: 'sm',
    body: `<form id="organization-form" novalidate>
      <div class="field"><label for="org-name">ชื่อหน่วยงาน / โรงเรียน <span style="color:var(--coral)">*</span></label>
        <input class="input input--lg" id="org-name" name="name" value="${e(org?.name || '')}" placeholder="เช่น โรงเรียนแมทเวิร์ด" autofocus>
      </div>
      <div class="form-grid">
        <div class="field"><label for="org-short">ชื่อย่อ <span style="color:var(--coral)">*</span></label>
          <input class="input input--lg" id="org-short" name="shortName" value="${e(org?.shortName || '')}" placeholder="เช่น MW" maxlength="8" style="text-transform:uppercase" autocomplete="off">
          <span class="field__hint">A–Z หรือ 0–9 2–8 ตัว · ใช้เป็นส่วนหนึ่งของรหัสครูและรหัสผ่านนักเรียน</span>
        </div>
        <div class="field"><label for="org-type">ประเภท</label>
          <select class="select input--lg" id="org-type" name="type">
            <option value="school" ${org?.type !== 'agency' ? 'selected' : ''}>โรงเรียน</option>
            <option value="agency" ${org?.type === 'agency' ? 'selected' : ''}>หน่วยงาน</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label for="org-access">สิทธิ์การมองเห็นข้อมูล</label>
        <select class="select input--lg" id="org-access" name="accessLevel" ${!isOwnerTeacher(session) && org?.id === currentTeacher(session)?.orgId ? 'disabled' : ''}>
          <option value="own" ${(org?.accessLevel || 'own') === 'own' ? 'selected' : ''}>เห็นเฉพาะหน่วยงานของตน</option>
          <option value="view_all" ${org?.accessLevel === 'view_all' ? 'selected' : ''}>เห็นทุกหน่วยงาน (ดูข้อมูลได้ แต่จัดการองค์กรไม่ได้)</option>
          <option value="manage_all" ${org?.accessLevel === 'manage_all' ? 'selected' : ''}>เห็นทุกหน่วยงาน + สร้าง/ลบหน่วยงานและจัดการบุคลากรได้</option>
        </select>
        <span class="field__hint">${icon('shield-check', 11)} สิทธิ์นี้มีผลกับบุคลากรทุกคนในหน่วยงาน · ใช้สำหรับหน่วยงานหลัก/ผู้จัดการร่วมเท่านั้น</span>
      </div>
      ${org ? `<p class="field__hint">${icon('info', 12)} การเปลี่ยนชื่อย่อจะมีผลกับรหัสที่สร้างใหม่เท่านั้น รหัสเดิมยังใช้ได้</p>` : ''}
      <div class="form-error" data-org-error>${icon('alert-circle', 15)}<span></span></div>
    </form>`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-close>ยกเลิก</button>
      <button class="btn btn--primary" type="submit" form="organization-form">${icon('save', 15)} ${org ? 'บันทึก' : 'สร้างหน่วยงาน'}</button>`,
    onMount(overlay) {
      const form = overlay.querySelector('#organization-form');
      const error = overlay.querySelector('[data-org-error]');
      overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => closeModal());
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const data = new FormData(form);
        const payload = { name: data.get('name'), shortName: data.get('shortName'), type: data.get('type'), accessLevel: data.get('accessLevel') || org?.accessLevel || 'own' };
        const result = org ? updateOrganization(org.id, payload, session) : addOrganization(payload, session);
        if (!result.ok) {
          error.querySelector('span').textContent = result.error;
          error.classList.add('is-visible');
          return;
        }
        closeModal();
        refreshRoute();
        toast(org ? 'บันทึกหน่วยงานแล้ว' : 'สร้างหน่วยงานแล้ว', 'success');
      });
    }
  });
}

export function teacherStudentsView(ctx) {
  const { session } = ctx;
  const db = getDB();
  const owner = hasAllOrganizationAccess(session);
  const canAdmin = canManageOrganizations(session);
  const manager = isManagerStaff(session);
  const me = currentTeacher(session);
  const requestedOrg = ctx.query?.get?.('org') || '';
  const orgFilter = owner ? (db.organizations.some(o => o.id === requestedOrg) ? requestedOrg : 'all') : me.orgId;
  const students = [...visibleStudents(session, db, orgFilter)].sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const classes = visibleClasses(session, db, orgFilter);
  const classCounts = new Map(classes.map(cls => [cls.id, studentsInClass(cls.id, db).filter(student => students.some(s => s.id === student.id)).length]));
  const visibleExamIds = new Set(visibleExams(session, db)
    .filter(exam => canViewExamStats(exam, session))
    .map(exam => exam.id));
  const cards = students.map(student => {
    const attempts = db.attempts.filter(a => a.studentId === student.id && a.status !== 'in_progress' && visibleExamIds.has(a.examId));
    const scores = attempts.map(a => {
      const exam = db.exams.find(x => x.id === a.examId);
      return exam ? attemptScore(exam, a).percent : null;
    }).filter(v => v !== null);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const last = [...attempts].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
    const performance = scores.length ? (avg >= 80 ? 'ดีมาก' : avg >= 60 ? 'ผ่านเกณฑ์' : 'ควรพัฒนา') : 'ยังไม่มีผล';
    const studentClassIds = classIdsOf(student);
    const studentClasses = classCodesOf(student, db);
    const classChips = studentClasses.length
      ? studentClasses.map(code => `<span class="class-chip">${e(code)}</span>`).join('')
      : `<span class="class-chip class-chip--empty">ไม่ระบุ class</span>`;
    return `<article class="student-card" data-student-card data-student-id="${e(student.id)}" data-classes="${e(studentClassIds.join(' '))}" data-name="${e(student.name.toLowerCase())}" data-code="${e(student.code)}">
      <div class="student-card__top">
        <a class="student-card__profile" href="#/teacher/student/${student.id}" title="เปิดนามบัตรและผลสอบ">
          ${avatar(student.name, student.id, 'md')}
          <span class="student-card__copy"><strong>${e(student.name)}</strong><span>${e(student.code)} · ${icon('arrow-up-right', 10)} นามบัตร</span></span>
        </a>
        ${manager && !canAdmin ? '' : (owner || canAdmin) ? `<button class="student-card__remove" type="button" data-remove-student="${e(student.id)}" aria-label="ลบ ${e(student.name)}" title="ลบรายชื่อ">${icon('trash', 14)}</button>` : ''}
      </div>
      <button class="student-class-edit" type="button" data-edit-student-classes="${e(student.id)}" aria-label="แก้ไข class ของ ${e(student.name)}">
        <span class="student-class-edit__label">class</span>
        <span class="student-class-edit__chips">${classChips}</span>
        ${icon('edit', 12)}
      </button>
      <div class="student-card__stats">
        <div><span>การสอบ</span><strong>${attempts.length} ครั้ง</strong></div>
        <div class="right"><span>เฉลี่ย</span><strong>${scores.length ? avg + '%' : '—'} ${scores.length ? `<span class="performance-pill">${performance}</span>` : ''}</strong></div>
      </div>
      <div class="student-card__stats" style="margin-top:7px;padding-top:7px">
        <div><span>ล่าสุด</span><strong style="font-weight:400;font-size:9.5px">${last ? relativeTime(last.submittedAt) : 'ยังไม่เคยสอบ'}</strong></div>
      </div>
    </article>`;
  }).join('');
  const orgSelect = owner ? `<select class="select" data-student-org-filter aria-label="กรองตามหน่วยงาน">
    <option value="all">ทุกหน่วยงาน (${db.students.length})</option>
    ${db.organizations.map(org => `<option value="${e(org.id)}" ${orgFilter === org.id ? 'selected' : ''}>${e(org.name)} (${db.students.filter(s => s.orgId === org.id).length})</option>`).join('')}
  </select>` : '';
  const scopeName = orgFilter === 'all' ? 'ทุกหน่วยงาน' : organizationName(orgFilter, db);
  const content = `<div class="teacher-page-head">
    <div><div class="eyebrow">${icon('users', 12)} ทะเบียนนักเรียน</div><h1>นักเรียน</h1><p>${owner ? 'เห็นนักเรียนทุกหน่วยงานและเลือกกรองตามโรงเรียน/หน่วยงานได้ · คลิกนามบัตรเพื่อดูผลสอบรายชุด' : `เพิ่มนักเรียนและกำหนด class ใน ${e(scopeName)} · นักเรียนใหม่จะอยู่ในหน่วยงานของคุณอัตโนมัติ`}</p></div>
    <div class="teacher-page-head__actions">
      <button class="btn btn--ghost" type="button" data-export-students>${icon('download', 15)} ส่งออก Excel</button>
      ${owner ? `<button class="btn btn--ghost" type="button" data-manage-classes>${icon('graduation-cap', 15)} จัดการ class</button>` : ''}
      <button class="btn btn--primary" type="button" data-add-student>${icon('plus', 15)} เพิ่มนักเรียน</button>
    </div>
  </div>
  <div class="students-summary">
    <div class="overview-metric"><span>${icon('users', 11)} นักเรียนในขอบเขต</span><strong>${students.length} <small>คน</small></strong></div>
    <div class="overview-metric"><span>${icon('graduation-cap', 11)} class</span><strong>${classes.length} <small>class</small></strong></div>
    <div class="overview-metric"><span>${icon('clipboard-check', 11)} เคยเข้าสอบ</span><strong>${new Set(db.attempts.filter(a => visibleExamIds.has(a.examId) && students.some(s => s.id === a.studentId)).map(a => a.studentId)).size} <small>คน</small></strong></div>
  </div>
  <div class="table-toolbar" style="background:var(--surface);border:1px solid var(--line);border-radius:14px;margin-bottom:14px">
    <div class="table-toolbar__left">
      <label class="search-field">${icon('search', 17)}<input type="search" placeholder="ค้นหาชื่อหรือรหัสนักเรียน..." data-student-directory-search></label>
      <select class="select student-class-filter" data-class-filter aria-label="กรองตาม class">
        <option value="all">ทุก class (${students.length})</option>
        ${classes.map(cls => `<option value="${e(cls.id)}">${e(cls.code)} (${classCounts.get(cls.id) || 0})</option>`).join('')}
      </select>
      ${orgSelect}
    </div>
    <span class="table-caption" data-directory-count>${students.length} คน · ${e(scopeName)}</span>
  </div>
  ${students.length ? `<div class="student-grid" data-student-directory>${cards}</div>` : `<div class="card">${emptyState({ iconName: 'users', title: 'ยังไม่มีรายชื่อนักเรียน', text: owner ? 'เพิ่มนักเรียนคนแรกและกำหนด class ในหน่วยงานที่เลือก' : 'เพิ่มนักเรียนคนแรกและเลือก class ที่มีอยู่ในหน่วยงานของคุณ', action: '<button class="btn btn--primary" type="button" data-add-student>เพิ่มนักเรียน</button>' })}</div>`}
  <div class="table-empty" data-directory-empty style="display:none">ไม่พบรายชื่อที่ตรงกับคำค้น</div>`;
  return {
    html: teacherShell(session, { active: 'students', crumb: 'นักเรียน', content }),
    mount() {
      mountTeacherShell(session);
      document.querySelector('[data-export-students]')?.addEventListener('click', () => {
        exportStudentsExcel(students, session);
        toast('ดาวน์โหลดทะเบียนนักเรียนแล้ว', 'success');
      });
      document.querySelectorAll('[data-add-student]').forEach(btn => btn.addEventListener('click', () => openAddStudentModal(session, orgFilter)));
      if (owner) {
        document.querySelectorAll('[data-manage-classes]').forEach(btn => btn.addEventListener('click', () => openClassManager(session, orgFilter)));
        document.querySelectorAll('[data-remove-student]').forEach(btn => btn.addEventListener('click', () => confirmRemoveStudent(btn.dataset.removeStudent, session)));
      }
      document.querySelectorAll('[data-edit-student-classes]').forEach(button => button.addEventListener('click', () => {
        openStudentClassesModal(button.dataset.editStudentClasses);
      }));
      document.querySelector('[data-student-org-filter]')?.addEventListener('change', ev => {
        const value = ev.target.value;
        navigate(`/teacher/students${value && value !== 'all' ? `?org=${encodeURIComponent(value)}` : ''}`);
      });
      const search = document.querySelector('[data-student-directory-search]');
      const classFilter = document.querySelector('[data-class-filter]');
      const empty = document.querySelector('[data-directory-empty]');
      const count = document.querySelector('[data-directory-count]');
      const apply = () => {
        const q = (search?.value || '').trim().toLowerCase();
        const classId = classFilter?.value || 'all';
        let visible = 0;
        document.querySelectorAll('[data-student-card]').forEach(card => {
          const matchQuery = !q || card.dataset.name.includes(q) || card.dataset.code.toLowerCase().includes(q);
          const matchClass = classId === 'all' || (card.dataset.classes || '').split(' ').includes(classId);
          const show = matchQuery && matchClass;
          card.classList.toggle('hidden', !show);
          if (show) visible++;
        });
        count.textContent = `${visible} คน`;
        if (empty) empty.style.display = visible ? 'none' : 'block';
      };
      search?.addEventListener('input', apply);
      classFilter?.addEventListener('change', apply);
    }
  };
}

function studentExamAttempt(student, exam, db) {
  return db.attempts.find(a => a.examId === exam.id && a.studentId === student.id) || null;
}

function studentExamStatus(exam, attempt, showScore = true) {
  if (!attempt) return { label: 'ยังไม่ได้ส่ง', tone: 'warning', key: 'not_submitted' };
  if (attempt.status === 'in_progress') return { label: 'กำลังทำ', tone: 'info', key: 'in_progress' };
  if (!showScore) return { label: 'ส่งแล้ว · ยังไม่เปิดเผย', tone: 'neutral', key: 'submitted' };
  const meta = attemptStatusMeta(exam, attempt);
  if (meta.key === 'graded') return { label: 'ตรวจแล้ว', tone: 'success', key: 'graded' };
  return { label: 'ส่งแล้ว · รอประกาศผล', tone: 'info', key: 'submitted' };
}

export function teacherStudentView(ctx) {
  const { session } = ctx;
  const db = getDB();
  const student = db.students.find(s => s.id === ctx.studentId);
  const manager = isManagerStaff(session);
  if (!student || !canAccessStudent(student, session)) {
    return {
      html: teacherShell(session, {
        active: 'students', crumb: 'ไม่พบนักเรียน',
        content: `<div class="teacher-card">${emptyState({ iconName: 'users', title: 'ไม่พบนักเรียนในขอบเขตของคุณ', text: 'นักเรียนคนนี้อาจอยู่ต่างหน่วยงาน หรือลิงก์ไม่ถูกต้อง', action: '<a class="btn btn--primary" href="#/teacher/students">กลับทะเบียนนักเรียน</a>' })}</div>`
      }),
      mount: () => mountTeacherShell(session)
    };
  }
  const org = findOrganization(student.orgId, db);
  const exams = visibleExams(session, db)
    .filter(exam => !Array.isArray(exam.assignedStudentIds) || exam.assignedStudentIds.includes(student.id))
    .sort((a, b) => {
      const order = { open: 0, saved: 1, closed: 2, announced: 3, draft: 4 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9) || new Date(b.openAt) - new Date(a.openAt);
    });
  const rowsData = exams.map(exam => {
    const attempt = studentExamAttempt(student, exam, db);
    const showScore = canViewExamStats(exam, session);
    return { exam, attempt, showScore, status: studentExamStatus(exam, attempt, showScore) };
  });
  const rows = rowsData.map(({ exam, attempt, showScore, status }) => {
    const score = showScore && attempt && attempt.status !== 'in_progress' ? attemptScore(exam, attempt) : null;
    const inner = `
      <span class="student-exam-row__icon">${icon(showScore ? 'file-text' : 'lock', 15)}</span>
      <span class="student-exam-row__copy"><strong>${e(exam.title)}</strong><small>${e(exam.subject)} · ${exam.questions.length} ข้อ · ${thaiDateTime(exam.openAt)}</small></span>
      <span class="student-exam-row__status">${badge(status.label, status.tone)}</span>
      <span class="student-exam-row__score">${score ? `${score.total}/${score.max} <small>${score.percent}%</small>` : '—'}</span>
      ${showScore ? icon('chevron-right', 14) : ''}`;
    return showScore
      ? `<a class="student-exam-row" href="#/teacher/student/${student.id}/exam/${exam.id}">${inner}</a>`
      : `<div class="student-exam-row student-exam-row--locked" title="สถิติจะเปิดให้ดูเมื่อปิดสอบ">${inner}</div>`;
  }).join('');
  const submitted = rowsData.filter(({ attempt, showScore }) => showScore && attempt && attempt.status !== 'in_progress').length;
  const scores = rowsData
    .filter(({ attempt, showScore }) => showScore && attempt && attempt.status !== 'in_progress')
    .map(({ exam, attempt }) => attemptScore(exam, attempt).percent);
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const classChips = classCodesOf(student, db).map(code => `<span class="class-chip">${e(code)}</span>`).join('') || `<span class="class-chip class-chip--empty">ไม่ระบุ class</span>`;
  const content = `<a class="page-back" href="#/teacher/students">${icon('arrow-left', 15)} กลับทะเบียนนักเรียน</a>
  <div class="student-profile-page">
    <section class="student-id-card">
      <div class="student-id-card__top">
        ${avatar(student.name, student.id, 'lg')}
        <div class="student-id-card__identity"><span class="eyebrow">นามบัตรนักเรียน</span><h1>${e(student.name)}</h1><p>${e(org?.name || 'ไม่ระบุหน่วยงาน')}</p></div>
      </div>
      ${ownerStudentBadge(student, session)}
      <div class="student-id-card__grid">
        <div><span>รหัสนักเรียน</span><strong>${e(student.code)}</strong></div>
        <div><span>หน่วยงาน</span><strong>${e(org?.name || '—')} · ${e(org?.shortName || '—')}</strong></div>
        <div><span>class</span><strong>${classChips}</strong></div>
        <div><span>เข้าสอบแล้ว</span><strong>${submitted} ชุด</strong></div>
      </div>
      <div class="student-id-card__foot">${icon('info', 12)} ${manager ? 'ผู้จัดการแก้ไขรหัสนักเรียนในหน่วยงานได้ · ข้อมูลคะแนนอ่านได้อย่างเดียว' : 'ข้อมูลบัญชีและรหัสผ่านดูได้จากหน้าโปรไฟล์ของนักเรียน'}</div>
    </section>
    <section class="student-results-panel">
      <div class="student-results-panel__average">
        <div><span>คะแนนเฉลี่ยรวม</span><strong>${average === null ? '—' : `${average}%`}</strong><small>${scores.length ? `จาก ${scores.length} ชุดที่ส่งแล้ว` : 'ยังไม่มีผลสอบที่ส่งแล้ว'}</small></div>
        <div class="average-ring">${average === null ? '<span class="average-empty">—</span>' : ringScore(average)}</div>
      </div>
      <div class="student-results-panel__head"><div><h2>บททดสอบที่ได้รับมอบหมาย</h2><p>คลิกชื่อบททดสอบเพื่อดูรายละเอียดคำตอบของนักเรียนคนนี้</p></div><span class="table-caption">${exams.length} ชุด</span></div>
      <div class="student-exam-list">${rows || `<div class="table-empty">ยังไม่มีบททดสอบที่มอบหมายให้นักเรียนคนนี้</div>`}</div>
    </section>
  </div>`;
  return {
    html: teacherShell(session, { active: 'students', crumb: 'นามบัตรนักเรียน', content }),
    mount() {
      mountTeacherShell(session);
      document.querySelector('[data-move-student-org]')?.addEventListener('click', () => openMoveStudentOrgModal(student, session));
      document.querySelector('[data-edit-student-code]')?.addEventListener('click', () => openCodeEditModal({
        kind: 'student', id: student.id, title: 'แก้ไขรหัสนักเรียน',
        current: student.code, session
      }));
      document.querySelector('[data-open-student-account]')?.addEventListener('click', () => {
        openAccountProfile({ kind: 'student', personId: student.id, session, title: 'ข้อมูลบัญชีนักเรียน' });
      });
    }
  };
}

function ownerStudentBadge(student, session) {
  const owner = isOwnerTeacher(session);
  const canAdmin = canManageOrganizations(session);
  const manager = isManagerStaff(session);
  const buttons = [];
  if (owner || manager) buttons.push(`<button class="btn btn--ghost btn--sm" type="button" data-edit-student-code="${e(student.id)}">${icon('key', 13)} แก้ไขรหัสนักเรียน</button>`);
  if (!manager) buttons.push(`<button class="btn btn--ghost btn--sm" type="button" data-open-student-account="${e(student.id)}">${icon('user', 13)} ข้อมูลบัญชี</button>`);
  if (owner || canAdmin) buttons.push(`<button class="btn btn--ghost btn--sm" type="button" data-move-student-org="${e(student.id)}">${icon('school', 13)} ย้ายหน่วยงาน</button>`);
  if (!buttons.length) return badge('อ่านอย่างเดียว', 'neutral');
  return `<div class="student-id-card__actions">${buttons.join('')}</div>`;
}

export function teacherStudentExamView(ctx) {
  const { session } = ctx;
  const db = getDB();
  const student = db.students.find(s => s.id === ctx.studentId);
  const exam = findExam(ctx.examId);
  if (!student || !exam || !canAccessStudent(student, session) || !canViewExam(exam, session) || !canViewExamStats(exam, session)) {
    return {
      html: teacherShell(session, {
        active: 'students', crumb: 'ไม่พบข้อมูล',
        content: `<div class="teacher-card">${emptyState({ iconName: 'lock', title: 'ยังเปิดรายละเอียดไม่ได้', text: 'นักเรียนหรือชุดสอบอยู่นอกขอบเขตที่คุณดูได้ · ชุดสอบแบบดูอย่างเดียวจะเปิดรายละเอียดเมื่อปิดสอบแล้ว', action: `<a class="btn btn--primary" href="${student ? `#/teacher/student/${student.id}` : '#/teacher/students'}">กลับนามบัตร</a>` })}</div>`
      }),
      mount: () => mountTeacherShell(session)
    };
  }
  const attempt = studentExamAttempt(student, exam, db);
  const status = studentExamStatus(exam, attempt);
  const score = attempt && attempt.status !== 'in_progress' ? attemptScore(exam, attempt) : null;
  const reviewed = attempt && attempt.status !== 'in_progress' ? attempt.reviewed : false;
  const questionRows = attempt ? exam.questions.map((q, index) => {
    const value = getAnswerValue(attempt, q.id);
    const correct = q.type === 'essay' ? null : isCorrect(q, value);
    const manual = attempt.manualScores?.[q.id];
    const points = q.type === 'essay'
      ? (manual?.score ?? 'รอตรวจ')
      : correct ? q.points : 0;
    return `<div class="student-answer-row ${correct === true ? 'is-correct' : correct === false ? 'is-wrong' : ''}">
      <div class="student-answer-row__head"><span>ข้อ ${index + 1}</span><span>${typeLabel(q.type)} · ${q.points} คะแนน</span><strong>${points} คะแนน</strong></div>
      <div class="student-answer-row__question">${mathText(q.text)}</div>
      ${questionImageHTML(q, 'question-figure question-figure--review')}
      <div class="student-answer-row__grid">
        <div><span>คำตอบของนักเรียน</span><strong>${value === null || value === undefined || value === '' ? '— ไม่ได้ตอบ —' : mathText(answerText(q, value))}</strong></div>
        <div><span>${q.type === 'essay' ? 'แนวคำตอบ' : 'คำตอบที่ถูก'}</span><strong>${mathText(correctAnswerText(q))}</strong></div>
      </div>
      ${manual?.comment ? `<div class="student-answer-row__comment">${icon('message-circle', 12)} ${e(manual.comment)}</div>` : ''}
    </div>`;
  }).join('') : '';
  const content = `<a class="page-back" href="#/teacher/student/${student.id}">${icon('arrow-left', 15)} กลับนามบัตร ${e(student.name)}</a>
  <div class="student-exam-detail-head">
    <div><div class="eyebrow">${icon('file-text', 12)} รายละเอียดการสอบของนักเรียน</div><h1>${e(exam.title)}</h1><p>${e(student.name)} · ${e(student.code)} · ${e(findOrganization(student.orgId, db)?.name || '')}</p></div>
    <div class="student-exam-detail-head__score">${score ? `<strong>${score.total}/${score.max}</strong><span>${score.percent}%</span>` : `<strong>—</strong><span>${e(status.label)}</span>`}</div>
  </div>
  <div class="student-exam-detail-meta">
    <span>${icon('clock', 12)} ${exam.duration} นาที</span><span>${icon('calendar', 12)} เริ่ม ${thaiDateTime(exam.openAt)}</span><span>${icon('timer', 12)} ปิด ${thaiDateTime(exam.closeAt)}</span>
    ${attempt?.submittedAt ? `<span>${icon('send', 12)} ส่งเมื่อ ${thaiDateTime(attempt.submittedAt)}</span>` : ''}
  </div>
  ${!attempt ? `<div class="teacher-card">${emptyState({ iconName: 'clock', title: 'ยังไม่ได้ส่งคำตอบ', text: 'นักเรียนคนนี้ยังไม่ได้เริ่มหรือส่งบททดสอบนี้', action: `<a class="btn btn--ghost" href="#/teacher/student/${student.id}">กลับนามบัตร</a>` })}</div>`
    : attempt.status === 'in_progress' ? `<div class="notice-strip notice-strip--warn">${icon('timer', 15)}<span>นักเรียนกำลังทำบททดสอบนี้อยู่ · ยังไม่มีการส่งคำตอบ</span></div>`
    : `<div class="student-exam-detail-body">
        <div class="student-exam-detail-summary card">
          <div><span>สถานะ</span>${badge(status.label, status.tone)}</div>
          <div><span>คะแนน</span><strong>${score.total}/${score.max} (${score.percent}%)</strong></div>
          <div><span>ตรวจแล้ว</span><strong>${reviewed ? 'ครบแล้ว' : 'รอตรวจอัตนัย'}</strong></div>
          ${canManageExam(exam, session) ? `<a class="btn btn--ghost btn--sm" href="#/teacher/exam/${exam.id}/answer/${attempt.id}">${icon('clipboard-check', 13)} ไปหน้าตรวจคำตอบ</a>` : ''}
        </div>
        <div class="student-answer-list">${questionRows}</div>
      </div>`}`;
  return {
    html: teacherShell(session, { active: 'students', crumb: 'รายละเอียดการสอบ', content }),
    mount() { mountTeacherShell(session); }
  };
}
