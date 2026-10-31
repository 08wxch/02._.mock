import { parseRoute, navigate, refreshRoute } from './router.js';
import { getDB, getSession, setSession, clearSession, sweepExpiredAttempts, loadDB, reloadDB, currentTeacher, replaceDB } from './store.js';
import { cloudRestore, cloudRefresh, isCloudEnabled, isCloudReady } from './cloud.js';
import { authView } from './views/auth.js';
import {
  studentDashboardView, instructionsView, examView, successView,
  resultView, historyView
} from './views/student.js';
import {
  teacherDashboardView, teacherExamsView, teacherExamView, teacherExamPreviewView,
  teacherAnswerView, teacherReviewView, teacherStudentsView, teacherStaffView,
  teacherStudentView, teacherStudentExamView
} from './views/teacher.js';
import { createExamView } from './views/createExam.js';
import { teacherAnalyticsView, teacherAnalyticsRankingView } from './views/analytics.js';
import { closeModal, toast } from './ui.js';

const app = document.getElementById('app');
let currentCleanup = null;
let isRendering = false;

// Restore the Supabase session before the first render. A stale local session
// must not send the user into a workspace that the database will reject.
let cloudBootError = null;
try {
  const restored = await cloudRestore();
  if (restored) {
    setSession(restored.session);
    replaceDB(restored.db);
  } else if (isCloudEnabled()) {
    clearSession();
  }
} catch (err) {
  cloudBootError = err;
  console.error('Cloud restore failed', err);
}

function setTitle(title) {
  document.title = title ? `${title} · 02._.mock` : '02._.mock — ระบบสอบออนไลน์';
}

function requireSession(role, routeName) {
  const session = getSession();
  if (!session || session.role !== role) {
    navigate(`/login${role === 'teacher' ? '?role=teacher' : ''}`, { replace: true });
    return null;
  }
  return session;
}

function routeView(route) {
  const { parts, query } = route;
  const [root, second, third, fourth, fifth, sixth] = parts;
  const session = getSession();

  if (!parts.length || root === 'login') {
    setTitle('เข้าสู่ระบบ');
    return authView({ query, session });
  }

  if (root === 'student') {
    const studentSession = requireSession('student', 'student');
    if (!studentSession) return null;

    if (!second) {
      setTitle('หน้าหลักนักเรียน');
      return studentDashboardView({ session: studentSession, query });
    }
    if (second === 'history') {
      setTitle('ประวัติการสอบ');
      return historyView({ session: studentSession, query });
    }
    if (second === 'exam' && third) {
      const examId = third;
      const sub = fourth;
      if (sub === 'instructions') {
        setTitle('คำชี้แจงก่อนสอบ');
        return instructionsView({ session: studentSession, examId, query });
      }
      if (sub === 'take') {
        setTitle('กำลังทำข้อสอบ');
        return examView({ session: studentSession, examId, query });
      }
      if (sub === 'success') {
        setTitle('ส่งคำตอบสำเร็จ');
        return successView({ session: studentSession, examId, query });
      }
      if (sub === 'result') {
        setTitle('ผลสอบ');
        return resultView({ session: studentSession, examId, query });
      }
    }
    navigate('/student', { replace: true });
    return null;
  }

  if (root === 'teacher') {
    const teacherSession = requireSession('teacher', 'teacher');
    if (!teacherSession) return null;
    if (!currentTeacher(teacherSession)) {
      navigate('/login?role=teacher', { replace: true });
      return null;
    }

    if (!second) {
      setTitle('ภาพรวมครู');
      return teacherDashboardView({ session: teacherSession, query });
    }
    if (second === 'exams') {
      setTitle('ชุดสอบทั้งหมด');
      return teacherExamsView({ session: teacherSession, query });
    }
    if (second === 'create') {
      setTitle('สร้างชุดสอบใหม่');
      return createExamView({ session: teacherSession, query });
    }
    if (second === 'review') {
      setTitle('ตรวจคำตอบ');
      return teacherReviewView({ session: teacherSession, query });
    }
    if (second === 'analytics') {
      if (third === 'ranking') {
        setTitle('อันดับนักเรียน');
        return teacherAnalyticsRankingView({ session: teacherSession, query });
      }
      setTitle('สถิติรวม');
      return teacherAnalyticsView({ session: teacherSession, query });
    }
    if (second === 'students') {
      setTitle('นักเรียน');
      return teacherStudentsView({ session: teacherSession, query });
    }
    if (second === 'staff') {
      setTitle('ครูและบุคลากร');
      return teacherStaffView({ session: teacherSession, query });
    }
    if (second === 'student' && third) {
      if (fourth === 'exam' && fifth) {
        setTitle('รายละเอียดการสอบของนักเรียน');
        return teacherStudentExamView({ session: teacherSession, studentId: third, examId: fifth, query });
      }
      setTitle('นามบัตรนักเรียน');
      return teacherStudentView({ session: teacherSession, studentId: third, query });
    }
    if (second === 'exam' && third) {
      if (fourth === 'answer' && fifth) {
        setTitle('ตรวจคำตอบนักเรียน');
        return teacherAnswerView({ session: teacherSession, examId: third, attemptId: fifth, query });
      }
      if (fourth === 'edit') {
        setTitle('แก้ไขชุดสอบ');
        return createExamView({ session: teacherSession, examId: third, query });
      }
      if (fourth === 'preview') {
        setTitle('พรีวิวข้อสอบ');
        return teacherExamPreviewView({ session: teacherSession, examId: third, query });
      }
      const tab = fourth || 'overview';
      setTitle('จัดการชุดสอบ');
      return teacherExamView({ session: teacherSession, examId: third, tab, query });
    }
    navigate('/teacher', { replace: true });
    return null;
  }

  navigate(session?.role === 'teacher' ? '/teacher' : session?.role === 'student' ? '/student' : '/login', { replace: true });
  return null;
}

function renderRoute({ scroll = true } = {}) {
  if (isRendering) return;
  isRendering = true;
  try {
    loadDB();
    sweepExpiredAttempts();
    if (typeof currentCleanup === 'function') {
      try { currentCleanup(); } catch (err) { console.warn(err); }
      currentCleanup = null;
    }
    const route = parseRoute();
    const view = routeView(route);
    if (!view) return;
    app.innerHTML = view.html;
    if (scroll) window.scrollTo({ top: 0, behavior: 'auto' });
    if (typeof view.mount === 'function') {
      const returned = view.mount();
      currentCleanup = typeof returned === 'function' ? returned : view.cleanup;
    } else {
      currentCleanup = view.cleanup;
    }
    document.body.classList.remove('sidebar-open');
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="page-loader" style="min-height:100vh;padding:24px;text-align:center">
      <div>
        <div style="font-size:20px;font-weight:600;margin-bottom:8px">เกิดข้อผิดพลาดในการแสดงผล</div>
        <p style="font-size:12px;color:var(--muted);max-width:460px;margin:0 auto 18px">${String(err.message || err)}</p>
        <button class="btn btn--primary" type="button" onclick="location.reload()">โหลดหน้าใหม่</button>
      </div>
    </div>`;
  } finally {
    isRendering = false;
  }
}

window.addEventListener('hashchange', () => {
  closeModal();
  renderRoute();
});
window.addEventListener('app:refresh', () => {
  renderRoute({ scroll: false });
});
window.addEventListener('storage', (ev) => {
  if (ev.key !== 'examio_demo_db_v2') return;
  reloadDB();
  const hash = window.location.hash;
  if (!hash.includes('/take')) {
    sweepExpiredAttempts();
    refreshRoute();
  }
});

// Periodic timeout sweep. Exam pages manage their own countdown, while this
// keeps dashboards and teacher views consistent if a tab is left open.
setInterval(() => {
  const swept = sweepExpiredAttempts();
  const hash = window.location.hash;
  if (swept && (hash.includes('/student') && !hash.includes('/take'))) {
    refreshRoute();
  }
}, 30_000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    sweepExpiredAttempts();
    refreshFromCloud();
  }
});

window.addEventListener('examio:cloud-error', (ev) => {
  toast(ev.detail?.message || 'เชื่อมต่อคลาวด์ไม่สำเร็จ', 'error', 5000);
});

let cloudRefreshBusy = false;
async function refreshFromCloud() {
  if (cloudRefreshBusy || !isCloudReady() || !getSession()) return;
  const hash = window.location.hash;
  if (hash.includes('/take') || hash.includes('/review') || hash.includes('/answers') || hash.includes('/create') || hash.includes('/edit')) return;
  cloudRefreshBusy = true;
  try {
    const next = await cloudRefresh();
    if (next) {
      replaceDB(next);
      sweepExpiredAttempts();
      refreshRoute({ scroll: false });
    }
  } catch (err) {
    console.warn('Cloud refresh failed', err);
  } finally {
    cloudRefreshBusy = false;
  }
}
setInterval(refreshFromCloud, 5000);

loadDB();
sweepExpiredAttempts();
renderRoute();
if (cloudBootError) {
  toast('เชื่อมต่อฐานข้อมูลกลางไม่ได้ — กำลังใช้ข้อมูลสำรองในเครื่อง', 'warning', 6000);
}
