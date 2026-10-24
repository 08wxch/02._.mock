import { icon } from '../icons.js';
import { e, formatNumber, thaiDate } from '../utils.js';
import { avatar, badge, emptyState } from '../ui.js';
import {
  getDB, currentTeacher, isOwnerTeacher, visibleStudents,
  visibleExams, canViewExamStats, classIdsOf, studentClassLabel,
  attemptScore, examOrganizationId, findOrganization
} from '../store.js';
import { navigate } from '../router.js';
import { teacherShell, mountTeacherShell } from './teacher.js';

function queryValue(ctx, key) {
  return ctx.query?.get?.(key) || '';
}

function scopeFor(ctx) {
  const { session } = ctx;
  const db = getDB();
  const owner = isOwnerTeacher(session);
  const me = currentTeacher(session);
  if (!me) return { denied: true };

  const requestedOrg = queryValue(ctx, 'org');
  const orgId = owner
    ? (db.organizations.some(org => org.id === requestedOrg) ? requestedOrg : 'all')
    : me.orgId;
  const orgClasses = db.classes.filter(cls => orgId === 'all' || cls.orgId === orgId);
  const requestedClass = queryValue(ctx, 'class');
  const classId = orgClasses.some(cls => cls.id === requestedClass) ? requestedClass : 'all';
  const classes = orgClasses;
  const orgIds = new Set((orgId === 'all' ? db.organizations : db.organizations.filter(org => org.id === orgId)).map(org => org.id));

  const students = visibleStudents(session, db).filter(student =>
    orgIds.has(student.orgId) && (classId === 'all' || classIdsOf(student).includes(classId))
  );
  const studentIds = new Set(students.map(student => student.id));

  const exams = visibleExams(session, db).filter(exam =>
    orgIds.has(examOrganizationId(exam, db)) && canViewExamStats(exam, session)
  );
  const examById = new Map(exams.map(exam => [exam.id, exam]));
  const attempts = db.attempts.filter(attempt =>
    attempt.status !== 'in_progress' && examById.has(attempt.examId) && studentIds.has(attempt.studentId)
  );

  const scored = attempts.map(attempt => {
    const exam = examById.get(attempt.examId);
    const score = attemptScore(exam, attempt);
    return { attempt, exam, score, passed: score.percent >= Number(exam.passPercent || 60) };
  });
  const average = scored.length ? Math.round(scored.reduce((sum, row) => sum + row.score.percent, 0) / scored.length) : null;
  const passed = scored.filter(row => row.passed).length;
  const passRate = scored.length ? Math.round((passed / scored.length) * 100) : null;
  const highest = scored.length ? Math.max(...scored.map(row => row.score.percent)) : null;

  const byStudent = new Map();
  scored.forEach(row => {
    const entry = byStudent.get(row.attempt.studentId) || { attempts: 0, total: 0, best: 0, passed: 0, lastAt: null };
    entry.attempts += 1;
    entry.total += row.score.percent;
    entry.best = Math.max(entry.best, row.score.percent);
    if (row.passed) entry.passed += 1;
    const at = row.attempt.submittedAt || row.attempt.startedAt;
    if (at && (!entry.lastAt || new Date(at) > new Date(entry.lastAt))) entry.lastAt = at;
    byStudent.set(row.attempt.studentId, entry);
  });
  const studentRows = students.map(student => {
    const entry = byStudent.get(student.id);
    return {
      student,
      attempts: entry?.attempts || 0,
      average: entry?.attempts ? Math.round(entry.total / entry.attempts) : null,
      best: entry?.attempts ? Math.round(entry.best) : null,
      passed: entry?.passed || 0,
      lastAt: entry?.lastAt || null,
      classLabel: studentClassLabel(student, db)
    };
  }).sort((a, b) => {
    if (a.average === null && b.average === null) return a.student.name.localeCompare(b.student.name, 'th');
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    return b.average - a.average || b.best - a.best || a.student.name.localeCompare(b.student.name, 'th');
  });
  let rank = 0;
  studentRows.forEach(row => { if (row.average !== null) row.rank = ++rank; });

  const topicMap = new Map();
  scored.forEach(row => {
    const key = row.exam.topic || row.exam.title || 'ไม่ระบุบทเรียน';
    const entry = topicMap.get(key) || { total: 0, count: 0, exams: new Set() };
    entry.total += row.score.percent;
    entry.count += 1;
    entry.exams.add(row.exam.id);
    topicMap.set(key, entry);
  });
  const topics = [...topicMap.entries()]
    .map(([topic, entry]) => ({ topic, average: Math.round(entry.total / entry.count), exams: entry.exams.size, attempts: entry.count }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 8);

  const studentById = new Map(students.map(student => [student.id, student]));
  const classNameOf = (cls) => {
    const org = findOrganization(cls.orgId, db);
    return orgId === 'all' ? `${cls.code} · ${org?.shortName || org?.name || ''}` : cls.code;
  };

  const classEntries = new Map();
  scored.forEach(row => {
    const student = studentById.get(row.attempt.studentId);
    const primaryId = student ? classIdsOf(student)[0] : '';
    const cls = classes.find(item => item.id === primaryId);
    if (!cls) return;
    const entry = classEntries.get(cls.id) || { averageTotal: 0, attempts: 0, passed: 0, studentIds: new Set() };
    entry.averageTotal += row.score.percent;
    entry.attempts += 1;
    if (row.passed) entry.passed += 1;
    if (student) entry.studentIds.add(student.id);
    classEntries.set(cls.id, entry);
  });
  const classStats = [...classEntries.entries()]
    .map(([id, entry]) => {
      const cls = classes.find(item => item.id === id);
      return {
        id,
        label: classNameOf(cls),
        average: Math.round(entry.averageTotal / entry.attempts),
        attempts: entry.attempts,
        passRate: Math.round((entry.passed / entry.attempts) * 100),
        students: entry.studentIds.size
      };
    })
    .filter(row => row.attempts > 0)
    .sort((a, b) => b.average - a.average || b.attempts - a.attempts);

  const examEntries = new Map();
  scored.forEach(row => {
    const entry = examEntries.get(row.exam.id) || { total: 0, count: 0, passed: 0 };
    entry.total += row.score.percent;
    entry.count += 1;
    if (row.passed) entry.passed += 1;
    examEntries.set(row.exam.id, entry);
  });
  const examTrend = exams
    .map(exam => {
      const entry = examEntries.get(exam.id);
      return {
        id: exam.id,
        title: exam.title,
        date: exam.openAt || exam.createdAt || exam.closeAt || '',
        average: entry ? Math.round(entry.total / entry.count) : null,
        attempts: entry?.count || 0,
        passRate: entry ? Math.round((entry.passed / entry.count) * 100) : null
      };
    })
    .filter(row => row.average !== null)
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .slice(-8);

  const distributionBands = [
    { label: '0–19', min: 0, max: 20, count: 0 },
    { label: '20–39', min: 20, max: 40, count: 0 },
    { label: '40–59', min: 40, max: 60, count: 0 },
    { label: '60–79', min: 60, max: 80, count: 0 },
    { label: '80–100', min: 80, max: 101, count: 0 }
  ];
  scored.forEach(row => {
    const band = distributionBands.find(item => row.score.percent >= item.min && row.score.percent < item.max);
    if (band) band.count += 1;
  });

  const orgLabel = orgId === 'all' ? 'ทุกหน่วยงาน' : findOrganization(orgId, db)?.name || 'หน่วยงาน';
  const classLabel = classId === 'all' ? 'ทุก class' : classes.find(cls => cls.id === classId)?.code || 'class';

  return {
    db, session, owner, me, orgId, classId, classes, students, exams, attempts, scored,
    average, passRate, passCount: passed, highest,
    studentRows, topics, classStats, examTrend, distributionBands, orgLabel, classLabel
  };
}

function filterQuery(scope, overrides = {}) {
  const params = new URLSearchParams();
  const orgId = Object.prototype.hasOwnProperty.call(overrides, 'orgId') ? overrides.orgId : scope.orgId;
  const classId = Object.prototype.hasOwnProperty.call(overrides, 'classId') ? overrides.classId : scope.classId;
  if (scope.owner && orgId !== 'all') params.set('org', orgId);
  if (classId !== 'all') params.set('class', classId);
  return params.toString() ? `?${params.toString()}` : '';
}

function filtersHTML(scope, { ranking = false } = {}) {
  const { db, owner, orgId, classId, classes } = scope;
  const classOptions = classes.map(cls => {
    const org = findOrganization(cls.orgId, db);
    const label = orgId === 'all' ? `${cls.code} · ${org?.shortName || org?.name || ''}` : cls.code;
    return `<option value="${e(cls.id)}" ${cls.id === classId ? 'selected' : ''}>${e(label)}</option>`;
  }).join('');
  return `<form class="analytics-filters" data-analytics-filter data-analytics-path="${ranking ? 'ranking' : ''}">
    ${owner ? `<div class="field"><label for="analytics-org">หน่วยงาน / โรงเรียน</label>
      <select class="select" id="analytics-org" name="org">
        <option value="all" ${orgId === 'all' ? 'selected' : ''}>ทุกหน่วยงาน</option>
        ${db.organizations.map(org => `<option value="${e(org.id)}" ${org.id === orgId ? 'selected' : ''}>${e(org.name)} · ${e(org.shortName)}</option>`).join('')}
      </select>
    </div>` : `<div class="field"><label>หน่วยงาน / โรงเรียน</label><div class="fixed-field">${icon('school', 15)}<strong>${e(findOrganization(scope.me.orgId, db)?.name || 'หน่วยงานของฉัน')}</strong><span>กำหนดตามบัญชี</span></div></div>`}
    <div class="field"><label for="analytics-class">class</label>
      <select class="select" id="analytics-class" name="class">
        <option value="all" ${classId === 'all' ? 'selected' : ''}>ทุก class</option>
        ${classOptions}
      </select>
    </div>
    <div class="analytics-filters__note">${icon('info', 13)} ${owner ? 'เลือกหน่วยงาน แล้วเลือก class เพื่อดูสถิติรวม' : 'เลือกได้เฉพาะทั้งหมดหรือ class ในหน่วยงานของตนเอง'}</div>
  </form>`;
}

function statCard({ href, iconName, label, value, suffix = '', detail = '', tone = '' }) {
  const inner = `<span class="analytics-stat__icon">${icon(iconName, 18)}</span>
    <span class="analytics-stat__label">${e(label)}</span>
    <strong>${value}${suffix ? `<small>${suffix}</small>` : ''}</strong>
    <span class="analytics-stat__detail">${e(detail)}</span>
    ${href ? `<span class="analytics-stat__cta">ดูอันดับ ${icon('arrow-right', 12)}</span>` : ''}`;
  return href
    ? `<a class="analytics-stat analytics-stat--${tone || 'default'} ${href ? 'analytics-stat--link' : ''}" href="${href}">${inner}</a>`
    : `<div class="analytics-stat analytics-stat--${tone || 'default'}">${inner}</div>`;
}

function shortChartDate(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(date);
}

function trendChart(points) {
  if (!points.length) {
    return `<div class="analytics-empty analytics-empty--chart">${icon('trending-up', 22)}<span>ยังไม่มีผลสอบเพียงพอสำหรับดูแนวโน้ม</span></div>`;
  }
  const width = 720;
  const height = 230;
  const padding = { top: 18, right: 18, bottom: 38, left: 42 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;
  const xAt = (index) => padding.left + (points.length === 1 ? innerWidth / 2 : index * step);
  const yAt = (value) => padding.top + ((100 - Math.max(0, Math.min(100, value))) / 100) * innerHeight;
  const pointText = points.map((point, index) => {
    const x = xAt(index);
    const y = yAt(point.average);
    return `<g class="trend-point">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2"></circle>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" class="trend-point__hit"></circle>
      <title>${e(point.title)} · เฉลี่ย ${point.average}% · ${point.attempts} ครั้ง</title>
    </g>`;
  }).join('');
  const labels = points.map((point, index) => `<text x="${xAt(index).toFixed(1)}" y="${height - 13}" text-anchor="middle" class="trend-axis-label">${e(shortChartDate(point.date) || String(index + 1))}</text>`).join('');
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${xAt(index).toFixed(1)} ${yAt(point.average).toFixed(1)}`).join(' ');
  const area = points.length > 1
    ? `${line} L ${xAt(points.length - 1).toFixed(1)} ${padding.top + innerHeight} L ${xAt(0).toFixed(1)} ${padding.top + innerHeight} Z`
    : '';
  const grid = [0, 25, 50, 75, 100].map(value => {
    const y = yAt(value);
    return `<line x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}" class="trend-grid-line"></line>
      <text x="${padding.left - 9}" y="${y + 3}" text-anchor="end" class="trend-axis-label">${value}</text>`;
  }).join('');
  return `<div class="analytics-chart-scroll">
    <svg class="analytics-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="แนวโน้มคะแนนเฉลี่ยรายชุดสอบ">
      <defs><linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2f6b53" stop-opacity=".22"></stop><stop offset="100%" stop-color="#2f6b53" stop-opacity="0"></stop></linearGradient></defs>
      ${grid}
      ${area ? `<path d="${area}" fill="url(#analyticsTrendFill)"></path>` : ''}
      <path d="${line}" class="trend-line"></path>
      ${pointText}
      ${labels}
    </svg>
  </div>
  <div class="analytics-chart-caption"><span><i class="analytics-dot"></i> คะแนนเฉลี่ย (%)</span><span>${points.length > 1 ? `ชุดที่ 1–${points.length}` : '1 ชุด'} · เรียงตามวันที่เปิดสอบ</span></div>`;
}

function distributionChart(bands) {
  const max = Math.max(...bands.map(band => band.count), 1);
  const total = bands.reduce((sum, band) => sum + band.count, 0);
  if (!total) {
    return `<div class="analytics-empty analytics-empty--chart">${icon('bar-chart', 22)}<span>ยังไม่มีคะแนนสำหรับดูการกระจาย</span></div>`;
  }
  return `<div class="analytics-distribution">
    ${bands.map(band => `<div class="analytics-distribution__col">
      <span class="analytics-distribution__count">${band.count}</span>
      <div class="analytics-distribution__track"><span style="height:${Math.max(5, Math.round((band.count / max) * 100))}%"></span></div>
      <small>${band.label}</small>
    </div>`).join('')}
  </div>
  <div class="analytics-chart-caption"><span><i class="analytics-dot analytics-dot--coral"></i> จำนวนครั้งที่ส่ง</span><span>${total} ครั้ง</span></div>`;
}

function classPerformance(classStats) {
  if (!classStats.length) {
    return `<div class="analytics-empty analytics-empty--chart">${icon('school', 22)}<span>ยังไม่มีคะแนนแยกตาม class</span></div>`;
  }
  return `<div class="analytics-class-list">
    ${classStats.map(row => `<div class="analytics-class-row">
      <div class="analytics-class-row__top"><strong>${e(row.label)}</strong><span>${row.average}%</span></div>
      <div class="analytics-class-row__bar"><span style="width:${row.average}%"></span></div>
      <small>${row.students} คน · ${row.attempts} ครั้ง · ผ่าน ${row.passRate}%</small>
    </div>`).join('')}
  </div>`;
}

export function teacherAnalyticsView(ctx) {
  const scope = scopeFor(ctx);
  if (scope.denied) {
    return {
      html: teacherShell(ctx.session, {
        active: 'analytics', crumb: 'สถิติรวม',
        content: `<div class="teacher-card">${emptyState({ iconName: 'lock', title: 'ไม่มีสิทธิ์ดูสถิติรวม', text: 'กรุณาเข้าสู่ระบบด้วยบัญชีครูในหน่วยงานอีกครั้ง', action: '<a class="btn btn--primary" href="#/teacher">กลับภาพรวม</a>' })}</div>`
      }),
      mount: () => mountTeacherShell(ctx.session)
    };
  }
  const { average, passRate, attempts, exams, students, studentRows, topics, classStats, examTrend, distributionBands, orgLabel, classLabel } = scope;
  const rankingHref = `#/teacher/analytics/ranking${filterQuery(scope)}`;
  const topRows = studentRows.filter(row => row.average !== null).slice(0, 5);
  const content = `<div class="teacher-page-head">
    <div>
      <div class="eyebrow">${icon('chart', 12)} ภาพรวมผลการเรียน</div>
      <h1>สถิติรวม</h1>
      <p>${e(orgLabel)} · ${e(classLabel)} · รวมผลจาก ${exams.length} ชุดสอบและ ${attempts.length} ครั้งที่ส่งแล้ว</p>
    </div>
    <div class="teacher-page-head__actions">
      <a class="btn btn--primary" href="${rankingHref}">${icon('bar-chart', 16)} ดูอันดับนักเรียน</a>
    </div>
  </div>
  ${filtersHTML(scope)}
  <div class="analytics-stat-grid">
    ${statCard({ href: rankingHref, iconName: 'award', label: 'คะแนนเฉลี่ยรวม', value: average === null ? '—' : formatNumber(average, 0), suffix: average === null ? '' : '%', detail: average === null ? 'ยังไม่มีผลสอบที่ส่งแล้ว' : `สูงสุด ${formatNumber(scope.highest, 0)}% · จาก ${attempts.length} ครั้ง`, tone: 'hero' })}
    ${statCard({ iconName: 'check-circle', label: 'อัตราผ่านเกณฑ์', value: passRate === null ? '—' : formatNumber(passRate, 0), suffix: passRate === null ? '' : '%', detail: passRate === null ? 'ยังไม่มีข้อมูล' : `ผ่าน ${scope.passCount} จาก ${attempts.length} ครั้ง` })}
    ${statCard({ iconName: 'users', label: 'นักเรียนในขอบเขต', value: formatNumber(students.length, 0), suffix: ' คน', detail: `${studentRows.filter(row => row.average !== null).length} คนมีผลสอบแล้ว` })}
    ${statCard({ iconName: 'file-text', label: 'ชุดสอบที่เก็บสถิติ', value: formatNumber(exams.length, 0), suffix: ' ชุด', detail: `${attempts.length} ครั้งที่ส่งคำตอบ` })}
  </div>
  <div class="analytics-chart-grid">
    <section class="analytics-panel card analytics-chart-panel analytics-chart-panel--wide">
      <div class="analytics-panel__head"><div><span class="eyebrow">${icon('trending-up', 11)} แนวโน้มผลการเรียน</span><h2>คะแนนเฉลี่ยตามชุดสอบ</h2></div><span class="badge badge--neutral">${examTrend.length} ชุด</span></div>
      ${trendChart(examTrend)}
    </section>
    <section class="analytics-panel card analytics-chart-panel">
      <div class="analytics-panel__head"><div><span class="eyebrow">${icon('bar-chart', 11)} การกระจายคะแนน</span><h2>ช่วงคะแนนของนักเรียน</h2></div><span class="badge badge--neutral">${attempts.length} ครั้ง</span></div>
      ${distributionChart(distributionBands)}
    </section>
  </div>
  <div class="analytics-columns">
    <section class="analytics-panel card">
      <div class="analytics-panel__head"><div><span class="eyebrow">${icon('award', 11)} อันดับเด่น</span><h2>นักเรียนที่ทำคะแนนได้ดี</h2></div><a class="btn btn--link" href="${rankingHref}">ทั้งหมด ${icon('arrow-right', 12)}</a></div>
      ${topRows.length ? `<div class="analytics-mini-rank">
        ${topRows.map(row => `<a class="analytics-mini-row" href="#/teacher/student/${row.student.id}">
          <span class="analytics-mini-row__rank">${row.rank}</span>
          ${avatar(row.student.name, row.student.id, 'xs')}
          <span class="analytics-mini-row__name"><strong>${e(row.student.name)}</strong><small>${e(row.classLabel)}</small></span>
          <strong class="analytics-mini-row__score">${row.average}%</strong>
        </a>`).join('')}
      </div>` : `<div class="analytics-empty">${icon('bar-chart', 22)}<span>ยังไม่มีผลสอบที่ส่งแล้วในขอบเขตนี้</span></div>`}
    </section>
    <section class="analytics-panel card">
      <div class="analytics-panel__head"><div><span class="eyebrow">${icon('school', 11)} เปรียบเทียบราย class</span><h2>คะแนนเฉลี่ยราย class</h2></div><span class="badge badge--neutral">${classStats.length} class</span></div>
      ${classPerformance(classStats)}
    </section>
  </div>

  <section class="analytics-panel card">
    <div class="analytics-panel__head"><div><span class="eyebrow">${icon('book-open', 11)} แยกตามบทเรียน</span><h2>คะแนนเฉลี่ยรายหัวข้อ</h2></div><span class="badge badge--neutral">${topics.length} หัวข้อ</span></div>
    ${topics.length ? `<div class="analytics-topic-list">
      ${topics.map(topic => `<div class="analytics-topic">
        <div class="analytics-topic__top"><strong>${e(topic.topic)}</strong><span>${topic.average}% · ${topic.attempts} ครั้ง</span></div>
        <div class="analytics-topic__bar"><span style="width:${topic.average}%"></span></div>
        <small>${topic.exams} ชุดสอบ</small>
      </div>`).join('')}
    </div>` : `<div class="analytics-empty">${icon('book-open', 22)}<span>ยังไม่มีคะแนนเพียงพอสำหรับแยกตามบทเรียน</span></div>`}
  </section>`;
  return {
    html: teacherShell(ctx.session, { active: 'analytics', crumb: 'สถิติรวม', content }),
    mount() {
      mountTeacherShell(ctx.session);
      mountAnalyticsFilters();
    }
  };
}

export function teacherAnalyticsRankingView(ctx) {
  const scope = scopeFor(ctx);
  if (scope.denied) {
    return {
      html: teacherShell(ctx.session, {
        active: 'analytics', crumb: 'อันดับนักเรียน',
        content: `<div class="teacher-card">${emptyState({ iconName: 'lock', title: 'ไม่มีสิทธิ์ดูอันดับ', text: 'กรุณาเข้าสู่ระบบด้วยบัญชีครูในหน่วยงานอีกครั้ง', action: '<a class="btn btn--primary" href="#/teacher">กลับภาพรวม</a>' })}</div>`
      }),
      mount: () => mountTeacherShell(ctx.session)
    };
  }
  const { average, passRate, attempts, studentRows, orgLabel, classLabel, exams } = scope;
  const rows = studentRows.map(row => `<a class="analytics-rank-row ${row.rank && row.rank <= 3 ? `analytics-rank-row--top analytics-rank-row--top-${row.rank}` : ''}" href="#/teacher/student/${row.student.id}">
    <span class="analytics-rank-row__rank">${row.rank || '—'}</span>
    <span class="analytics-rank-row__name"><strong>${e(row.student.name)}</strong><small>${e(row.student.code)} · ${e(row.classLabel)}</small></span>
    <span class="analytics-rank-row__metric"><span>เฉลี่ย</span><strong>${row.average === null ? '—' : `${row.average}%`}</strong></span>
    <span class="analytics-rank-row__metric"><span>สูงสุด</span><strong>${row.best === null ? '—' : `${row.best}%`}</strong></span>
    <span class="analytics-rank-row__metric"><span>ส่งแล้ว</span><strong>${row.attempts} ครั้ง</strong></span>
    <span class="analytics-rank-row__arrow">${icon('chevron-right', 16)}</span>
  </a>`).join('');
  const content = `<a class="page-back" href="#/teacher/analytics${filterQuery(scope)}">${icon('arrow-left', 15)} กลับสถิติรวม</a>
  <div class="teacher-page-head">
    <div><div class="eyebrow">${icon('bar-chart', 12)} อันดับตามคะแนนเฉลี่ย</div><h1>${e(classLabel)}</h1><p>${e(orgLabel)} · ${exams.length} ชุดสอบ · ${attempts.length} ครั้งที่ส่งแล้ว</p></div>
    <div class="teacher-page-head__actions"><span class="badge badge--success">${icon('award', 11)} เฉลี่ยรวม ${average === null ? '—' : `${average}%`}</span></div>
  </div>
  ${filtersHTML(scope, { ranking: true })}
  <div class="analytics-ranking-summary">
    <div><span>นักเรียนทั้งหมด</span><strong>${studentRows.length} <small>คน</small></strong></div>
    <div><span>มีผลสอบ</span><strong>${studentRows.filter(row => row.average !== null).length} <small>คน</small></strong></div>
    <div><span>อัตราผ่านเกณฑ์</span><strong>${passRate === null ? '—' : `${passRate}%`}</strong></div>
  </div>
  <section class="analytics-rank-card card">
    <div class="analytics-rank-head"><span>อันดับ</span><span>นักเรียน</span><span>เฉลี่ย</span><span>สูงสุด</span><span>ส่งแล้ว</span><span></span></div>
    <div class="analytics-rank-list">${rows || `<div class="analytics-empty">${icon('users', 22)}<span>ยังไม่มีนักเรียนในขอบเขตนี้</span></div>`}</div>
  </section>`;
  return {
    html: teacherShell(ctx.session, { active: 'analytics', crumb: 'อันดับนักเรียน', content }),
    mount() {
      mountTeacherShell(ctx.session);
      mountAnalyticsFilters();
    }
  };
}

function mountAnalyticsFilters() {
  const form = document.querySelector('[data-analytics-filter]');
  if (!form) return;
  const ranking = form.dataset.analyticsPath === 'ranking';
  const go = () => {
    const data = new FormData(form);
    const params = new URLSearchParams();
    const org = data.get('org');
    const cls = data.get('class');
    if (org && org !== 'all') params.set('org', org);
    if (cls && cls !== 'all') params.set('class', cls);
    navigate(`/teacher/analytics${ranking ? '/ranking' : ''}${params.toString() ? `?${params}` : ''}`);
  };
  form.querySelector('[name="org"]')?.addEventListener('change', () => {
    const classSelect = form.querySelector('[name="class"]');
    if (classSelect) classSelect.value = 'all';
    go();
  });
  form.querySelector('[name="class"]')?.addEventListener('change', go);
}
