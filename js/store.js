import { normalize, uid, answerIsEmpty } from './utils.js';
import { cloudSave } from './cloud.js';

export const DB_KEY = 'examio_demo_db_v2';
export const SESSION_KEY = 'examio_demo_session_v2';

const now = () => new Date();
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const ahead = (ms) => new Date(Date.now() + ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const organizations = [
  {
    id: 'org_math',
    name: '02._.math',
    shortName: 'MATH',
    type: 'agency',
    accessLevel: 'own',
    createdBy: 'teacher_1',
    createdAt: ago(120 * DAY)
  },
  {
    id: 'org_satit',
    name: 'โรงเรียนสาธิตวิทยา',
    shortName: 'SAT',
    type: 'school',
    accessLevel: 'own',
    createdBy: 'teacher_1',
    createdAt: ago(90 * DAY)
  }
];

const teachers = [
  {
    id: 'teacher_1',
    code: '02._.math',
    name: 'Wich Pitchon',
    shortName: 'Wich',
    email: 'wich@02math.app',
    password: '123456',
    subject: 'คณิตศาสตร์',
    orgId: 'org_math',
    school: '02._.math',
    phone: '',
    isOwner: true,
    staffRole: 'teacher',
    roleLabel: 'ผู้สร้างระบบ',
    createdAt: ago(120 * DAY)
  },
  {
    id: 'teacher_2',
    code: 'TCH002',
    name: 'ครูณัฐวุฒิ พงษ์เจริญ',
    shortName: 'ครูณัฐวุฒิ',
    email: 'nattawut@02math.app',
    password: '123456',
    subject: 'คณิตศาสตร์',
    orgId: 'org_satit',
    school: 'โรงเรียนสาธิตวิทยา',
    phone: '081 234 5678',
    isOwner: false,
    staffRole: 'teacher',
    roleLabel: 'ครูผู้สอน',
    createdBy: 'teacher_1',
    createdByName: 'Wich Pitchon',
    createdAt: ago(45 * DAY)
  }
];
const teacher = teachers[0];

const rosterNames = [
  'สมชาย ใจดี',
  'อารยา ศรีสุข',
  'ธนวัฒน์ ใจงาม',
  'ปณิธาน แสงทอง',
  'ญาดา พูลสุข',
  'ภูมิพัฒน์ วงศ์ชัย',
  'ชนิดา บุญมี',
  'กิตติพงษ์ รักเรียน',
  'มนัสนันท์ สุขใจ',
  'ศิรวิทย์ ตั้งมั่น',
  'พิมพ์ชนก แก้วใส',
  'ธีรภัทร สายทอง',
  'สุพัตรา ดีพร้อม',
  'ณัฐพล ขยันดี',
  'ศศิธร งามยิ่ง',
  'วรรณิศา นุ่มนวล',
  'ชยุตพงศ์ กล้าหาญ',
  'นภัสสร พรหมมา',
  'ภูริณัฐ เกิดผล',
  'จิราพร สุขสม',
  'อนันต์ชัย เก่งกาจ',
  'รัตนากร ทองดี',
  'สุนิสา ปัญญาดี',
  'กันตินันท์ ใจเย็น',
  'ปวีณา สว่างโลก'
];

const seedClasses = [
  { id: 'cls_csca_a', code: 'CSCA-A', orgId: 'org_satit', createdAt: ago(30 * DAY) },
  { id: 'cls_csca_b', code: 'CSCA-B', orgId: 'org_satit', createdAt: ago(30 * DAY) }
];

const students = rosterNames.map((name, i) => {
  const classIndex = i < 13 ? 0 : 1;
  return {
    id: i === 0 ? 'stu_demo' : `stu_${String(i + 1).padStart(2, '0')}`,
    code: `65010${String(i + 1).padStart(2, '0')}`,
    name,
    classIds: [seedClasses[classIndex].id],
    classId: seedClasses[classIndex].id,
    class: seedClasses[classIndex].code,
    number: classIndex === 0 ? i + 1 : i - 12,
    orgId: 'org_satit',
    password: '123456',
    createdBy: 'teacher_1',
    createdByName: 'Wich Pitchon',
    email: `student${i + 1}@school.ac.th`
  };
});

function mcq(id, text, options, correct, explanation, points = 1) {
  return {
    id, type: 'mcq', text, points, correct,
    options: options.map((label, i) => ({ id: String.fromCharCode(65 + i), text: label })),
    explanation
  };
}
function tf(id, text, correct, explanation, points = 1) {
  return { id, type: 'truefalse', text, points, correct: String(correct), explanation };
}
function short(id, text, acceptedAnswers, explanation, points = 2) {
  return { id, type: 'short', text, points, acceptedAnswers, explanation };
}
function essay(id, text, reference, points = 4) {
  return { id, type: 'essay', text, points, reference, explanation: reference };
}

const mathQuestions = [
  mcq('m1', '2 + 3 × 4 เท่ากับเท่าใด?', ['10', '14', '20', '24'], 'B', 'คูณก่อนบวก: 3 × 4 = 12 แล้ว 2 + 12 = 14'),
  mcq('m2', 'ถ้า x + 5 = 12 แล้ว x มีค่าเท่าใด?', ['5', '6', '7', '8'], 'C', 'ย้าย 5 ไปลบ: x = 12 − 5 = 7'),
  mcq('m3', '(x + 3)(x − 3) เท่ากับข้อใด?', ['x² − 9', 'x² + 9', 'x² − 6x + 9', 'x² + 6x + 9'], 'A', 'ใช้ผลต่างกำลังสอง (a + b)(a − b) = a² − b²'),
  mcq('m4', 'ค่าของ 3² + 4² เท่ากับเท่าใด?', ['7', '12', '25', '49'], 'C', '3² = 9, 4² = 16 ดังนั้น 9 + 16 = 25'),
  mcq('m5', 'ข้อใดเป็นสมการกำลังสองตัวแปรเดียว?', ['2x + 3 = 7', 'x² − 5x + 6 = 0', 'x³ + 1 = 0', '2x = y'], 'B', 'สมการกำลังสองมีรูป ax² + bx + c = 0 โดย a ≠ 0'),
  mcq('m6', 'รากของสมการ x² − 5x + 6 = 0 คือข้อใด?', ['1, 6', '2, 3', '−2, −3', '−1, −6'], 'B', 'แยกตัวประกอบได้ (x − 2)(x − 3) = 0 จึงได้ x = 2 หรือ 3'),
  mcq('m7', '(x + 2)² เท่ากับข้อใด?', ['x² + 4', 'x² + 4x + 4', 'x² + 2x + 4', 'x² − 4x + 4'], 'B', 'ใช้กำลังสองสมบูรณ์ (a + b)² = a² + 2ab + b²'),
  mcq('m8', 'ค่าของ 2⁵ เท่ากับเท่าใด?', ['10', '16', '32', '64'], 'C', '2⁵ = 2 × 2 × 2 × 2 × 2 = 32'),
  mcq('m9', 'ถ้า 3x − 7 = 11 แล้ว x มีค่าเท่าใด?', ['4', '5', '6', '7'], 'C', '3x = 18 ดังนั้น x = 6'),
  mcq('m10', 'ข้อใดคือรูปทั่วไปของสมการกำลังสอง?', ['ax + b = 0', 'ax² + bx + c = 0', 'ax³ + bx² + c = 0', 'a/x + b = 0'], 'B', 'รูปทั่วไปคือ ax² + bx + c = 0 เมื่อ a ≠ 0'),
  mcq('m11', 'ผลบวกของรากสมการ x² − 7x + 10 = 0 เท่ากับเท่าใด?', ['7', '−7', '10', '−10'], 'A', 'ผลบวกราก = −b/a = 7'),
  mcq('m12', 'ผลคูณของรากสมการ x² − 7x + 10 = 0 เท่ากับเท่าใด?', ['7', '−7', '10', '−10'], 'C', 'ผลคูณราก = c/a = 10'),
  mcq('m13', 'x² − 4 แยกตัวประกอบได้ตามข้อใด?', ['(x − 2)²', '(x + 2)²', '(x − 2)(x + 2)', '(x − 4)(x + 4)'], 'C', 'ผลต่างกำลังสอง: x² − 2² = (x − 2)(x + 2)'),
  mcq('m14', 'ถ้า x² = 81 แล้ว x มีค่าเป็นเท่าใดได้บ้าง?', ['9 เท่านั้น', '−9 เท่านั้น', '±9', '±81'], 'C', 'x = √81 หรือ −√81 ดังนั้น x = 9 หรือ −9'),
  mcq('m15', 'สมการ x² + 4x + 4 = 0 มีลักษณะอย่างไร?', ['มีรากต่างกันสองค่า', 'มีรากซ้ำ', 'ไม่มีรากจริง', 'เป็นสมการเชิงเส้น'], 'B', '(x + 2)² = 0 จึงมีรากซ้ำที่ x = −2'),
  tf('m16', 'x = 3 ทำให้ x² − 9 = 0 เป็นจริง', true, '3² − 9 = 9 − 9 = 0'),
  tf('m17', 'สมการ x² + 1 = 0 มีรากเป็นจำนวนจริง', false, 'x² = −1 ไม่มีจำนวนจริงใดยกกำลังสองแล้วได้ −1'),
  tf('m18', '(x + 1)(x + 2) = x² + 3x + 2', true, 'กระจาย (x + 1)(x + 2) ได้ x² + 3x + 2'),
  short('m19', 'จงหาค่า x จากสมการ 2x − 8 = 0 (ตอบเป็นตัวเลข)', ['4', 'x=4', 'x = 4'], '2x = 8 ดังนั้น x = 4', 2),
  essay('m20', 'จงอธิบายขั้นตอนการแก้สมการ x² − 5x + 6 = 0 พร้อมระบุรากของสมการ', 'แยกตัวประกอบเป็น (x − 2)(x − 3) = 0 จากนั้นให้แต่ละวงเล็บเท่ากับ 0 จะได้ x = 2 หรือ x = 3', 4)
];

const geometryQuestions = [
  mcq('g1', 'รูปสามเหลี่ยมมีฐานยาว 12 เซนติเมตร สูง 8 เซนติเมตร มีพื้นที่เท่าใด?', ['40 ตร.ซม.', '48 ตร.ซม.', '96 ตร.ซม.', '192 ตร.ซม.'], 'B', 'พื้นที่สามเหลี่ยม = 1/2 × ฐาน × สูง = 1/2 × 12 × 8 = 48', 2),
  mcq('g2', 'รูปสี่เหลี่ยมผืนผ้ากว้าง 9 เซนติเมตร ยาว 14 เซนติเมตร มีความยาวรอบรูปเท่าใด?', ['23 ซม.', '36 ซม.', '46 ซม.', '126 ซม.'], 'C', 'ความยาวรอบรูป = 2 × (9 + 14) = 46 เซนติเมตร', 2),
  mcq('g3', 'วงกลมรัศมี 7 เซนติเมตร มีพื้นที่ประมาณเท่าใด (ใช้ π ≈ 22/7)', ['44 ตร.ซม.', '77 ตร.ซม.', '154 ตร.ซม.', '308 ตร.ซม.'], 'C', 'พื้นที่วงกลม = πr² = 22/7 × 7 × 7 = 154', 2),
  mcq('g4', 'รูปสี่เหลี่ยมจัตุรัสมีพื้นที่ 81 ตารางเซนติเมตร ด้านยาวเท่าใด?', ['7 ซม.', '8 ซม.', '9 ซม.', '10 ซม.'], 'C', 'ด้าน = √81 = 9 เซนติเมตร', 2),
  mcq('g5', 'สามเหลี่ยมมีมุมหนึ่ง 50° และอีกมุมหนึ่ง 60° มุมที่เหลือมีขนาดเท่าใด?', ['60°', '70°', '80°', '90°'], 'B', 'มุมภายในสามเหลี่ยมรวม 180° จึงเหลือ 180 − 50 − 60 = 70°', 2),
  mcq('g6', 'รูปสี่เหลี่ยมด้านขนานฐานยาว 12 เซนติเมตร สูง 5 เซนติเมตร มีพื้นที่เท่าใด?', ['30 ตร.ซม.', '60 ตร.ซม.', '120 ตร.ซม.', '17 ตร.ซม.'], 'B', 'พื้นที่สี่เหลี่ยมด้านขนาน = ฐาน × สูง = 12 × 5 = 60', 2),
  mcq('g7', 'ลูกบาศก์ยาวด้านละ 4 เซนติเมตร มีปริมาตรเท่าใด?', ['16 ลบ.ซม.', '32 ลบ.ซม.', '48 ลบ.ซม.', '64 ลบ.ซม.'], 'D', 'ปริมาตรลูกบาศก์ = ด้าน³ = 4 × 4 × 4 = 64', 2),
  mcq('g8', 'มุมสองมุมรวมกันได้ 90° ถ้ามุมหนึ่งมีขนาด 35° อีกมุมมีขนาดเท่าใด?', ['45°', '55°', '65°', '145°'], 'B', 'มุมประกอบมีผลรวม 90° จึงได้ 90 − 35 = 55°', 2),
  mcq('g9', 'วงกลมเส้นผ่านศูนย์กลาง 14 เซนติเมตร มีความยาวรอบรูปประมาณเท่าใด (ใช้ π ≈ 22/7)', ['22 ซม.', '44 ซม.', '154 ซม.', '616 ซม.'], 'B', 'ความยาวรอบรูป = πd = 22/7 × 14 = 44 เซนติเมตร', 2),
  mcq('g10', 'รูปสี่เหลี่ยมคางหมูมีด้านคู่ขนานยาว 8 และ 12 เซนติเมตร สูง 5 เซนติเมตร มีพื้นที่เท่าใด?', ['40 ตร.ซม.', '50 ตร.ซม.', '60 ตร.ซม.', '100 ตร.ซม.'], 'B', 'พื้นที่คางหมู = 1/2 × (8 + 12) × 5 = 50', 2)
];

const statisticsQuestions = [
  mcq('t1', 'ค่าเฉลี่ยของ 4, 6, 8, 10 เท่ากับเท่าใด?', ['6', '7', '8', '9'], 'B', 'ผลรวม 28 หารด้วย 4 เท่ากับ 7', 2),
  mcq('t2', 'มัธยฐานของ 3, 5, 7, 9, 11 เท่ากับเท่าใด?', ['5', '6', '7', '9'], 'C', 'ข้อมูลเรียงแล้ว 5 จำนวน ค่ากลางคือตัวที่ 3 คือ 7', 2),
  mcq('t3', 'ฐานนิยมของ 2, 3, 3, 4, 5 เท่ากับเท่าใด?', ['2', '3', '4', '5'], 'B', '3 ปรากฏมากที่สุด จึงเป็นฐานนิยม', 2),
  mcq('t4', 'ทอยลูกเต๋า 1 ลูก ความน่าจะเป็นที่จะได้เลขคู่เท่ากับเท่าใด?', ['1/6', '1/3', '1/2', '2/3'], 'C', 'เลขคู่คือ 2, 4, 6 มี 3 ผลจาก 6 ผล จึงเป็น 3/6 = 1/2', 2),
  mcq('t5', 'โยนเหรียญ 2 เหรียญ ความน่าจะเป็นที่จะได้หัวทั้งสองเหรียญเท่ากับเท่าใด?', ['1/2', '1/3', '1/4', '3/4'], 'C', 'ผลทั้งหมด 4 แบบ และได้หัวทั้งคู่ 1 แบบ จึงเป็น 1/4', 2),
  mcq('t6', 'พิสัยของ 12, 15, 18, 20 เท่ากับเท่าใด?', ['6', '8', '12', '20'], 'B', 'พิสัย = ค่าสูงสุด − ค่าต่ำสุด = 20 − 12 = 8', 2),
  mcq('t7', 'ข้อมูล 5 จำนวนมีผลรวม 35 ค่าเฉลี่ยเท่ากับเท่าใด?', ['5', '6', '7', '8'], 'C', 'ค่าเฉลี่ย = 35 ÷ 5 = 7', 2),
  mcq('t8', 'กล่องมีลูกบอลสีแดง 3 ลูก สีน้ำเงิน 7 ลูก หยิบ 1 ลูก ความน่าจะเป็นที่จะได้สีแดงเท่ากับเท่าใด?', ['3/10', '3/7', '7/10', '1/3'], 'A', 'ลูกแดง 3 ลูก จากทั้งหมด 10 ลูก จึงเป็น 3/10', 2),
  mcq('t9', 'มัธยฐานของ 2, 4, 6, 8 เท่ากับเท่าใด?', ['4', '5', '6', '7'], 'B', 'ค่ากลางของ 4 และ 6 คือ (4 + 6)/2 = 5', 2),
  mcq('t10', 'เหตุการณ์ใดมีความน่าจะเป็นเท่ากับ 1?', ['ได้หัวจากการโยนเหรียญ', 'ได้เลข 7 จากลูกเต๋า', 'ได้ลูกบอลสีแดงจากกล่องที่มีแต่สีแดง', 'ได้ฝนตกพรุ่งนี้'], 'C', 'เหตุการณ์ที่เกิดขึ้นแน่นอนมีความน่าจะเป็น 1', 2)
];

const ratioQuestions = [
  mcq('r1', 'อัตราส่วนนักเรียนหญิงต่อชายเป็น 3 : 5 ถ้ามีนักเรียนทั้งหมด 40 คน มีนักเรียนชายกี่คน?', ['15 คน', '20 คน', '25 คน', '30 คน'], 'C', 'อัตราส่วนรวม 8 ส่วน นักเรียนชาย 5 ส่วน = 40 × 5/8 = 25 คน', 2),
  mcq('r2', '20% ของ 250 เท่ากับเท่าใด?', ['25', '40', '50', '75'], 'C', '20% = 20/100 ดังนั้น 250 × 0.20 = 50', 2),
  mcq('r3', 'อัตราส่วน 18 : 24 เขียนในรูปอย่างต่ำได้ข้อใด?', ['2 : 3', '3 : 4', '4 : 5', '6 : 8'], 'B', 'หารทั้งสองจำนวนด้วย 6 จะได้ 3 : 4', 2),
  mcq('r4', 'สินค้าราคา 800 บาท ลดราคา 15% ต้องจ่ายกี่บาท?', ['640 บาท', '680 บาท', '700 บาท', '720 บาท'], 'B', 'ส่วนลด 800 × 0.15 = 120 บาท จึงจ่าย 800 − 120 = 680 บาท', 2),
  mcq('r5', 'แผนที่มาตราส่วน 1 : 5,000 วัดระยะได้ 4 เซนติเมตร ระยะจริงคือเท่าใด?', ['20 เมตร', '200 เมตร', '2,000 เมตร', '20,000 เมตร'], 'B', '4 × 5,000 = 20,000 เซนติเมตร = 200 เมตร', 2),
  mcq('r6', 'เศษส่วน 2/5 คิดเป็นร้อยละเท่าใด?', ['20%', '30%', '40%', '50%'], 'C', '2/5 = 0.4 = 40%', 2),
  mcq('r7', 'แบ่งเงิน 120 บาท ในอัตราส่วน 2 : 3 : 5 ส่วนที่มากที่สุดมีค่าเท่าใด?', ['24 บาท', '36 บาท', '48 บาท', '60 บาท'], 'D', 'อัตราส่วนรวม 10 ส่วน ส่วนละ 12 บาท ส่วนมากที่สุด 5 × 12 = 60 บาท', 2),
  mcq('r8', '25% ของ 80 เท่ากับเท่าใด?', ['15', '20', '25', '30'], 'B', '80 × 0.25 = 20', 2)
];

function makeExam(base) {
  const totalPoints = base.questions.reduce((sum, q) => sum + Number(q.points), 0);
  const owner = teachers.find(t => t.id === base.teacherId);
  return {
    attemptsAllowed: 1,
    passPercent: 60,
    shareMode: 'view',
    orgId: base.orgId || owner?.orgId || organizations[0].id,
    settings: { showScore: true, showSolutions: true, showRank: false },
    instructions: '',
    ...base,
    totalPoints
  };
}

const exams = [
  makeExam({
    id: 'exam_math3',
    orgId: 'org_satit',
    code: '482913',
    title: 'คณิตศาสตร์ – บทที่ 3',
    shortTitle: 'คณิตศาสตร์ บทที่ 3',
    subject: 'คณิตศาสตร์',
    topic: 'พหุนามและสมการกำลังสอง',
    level: 'มัธยมศึกษาปีที่ 3',
    teacherId: teachers[0].id,
    teacherName: teachers[0].name,
    teacherCode: teachers[0].code,
    teacherSchool: teachers[0].school,
    description: 'ทดสอบความเข้าใจเรื่องพหุนาม การแยกตัวประกอบ และการแก้สมการกำลังสอง',
    instructions: 'ทำข้อสอบให้ครบทุกข้อ ห้ามเปิดแท็บอื่นระหว่างสอบ ระบบบันทึกคำตอบอัตโนมัติทุกครั้งที่เลือก หากหมดเวลา ระบบจะส่งคำตอบให้อัตโนมัติ',
    duration: 30,
    status: 'open',
    openAt: ago(2 * HOUR),
    closeAt: ahead(5 * HOUR + 31 * MIN),
    createdAt: ago(2 * DAY),
    assignedStudentIds: students.map(s => s.id),
    questions: mathQuestions
  }),
  makeExam({
    id: 'exam_ratio',
    code: '318426',
    title: 'คณิตศาสตร์ – อัตราส่วนและร้อยละ',
    shortTitle: 'อัตราส่วนและร้อยละ',
    subject: 'คณิตศาสตร์',
    topic: 'อัตราส่วน สัดส่วน และร้อยละในชีวิตประจำวัน',
    level: 'มัธยมศึกษาปีที่ 3',
    teacherId: teachers[1].id,
    teacherName: teachers[1].name,
    teacherCode: teachers[1].code,
    teacherSchool: teachers[1].school,
    description: 'ตรวจความเข้าใจเรื่องอัตราส่วน สัดส่วน การลดราคา และมาตราส่วนแผนที่',
    instructions: 'อ่านโจทย์ให้ละเอียด แสดงวิธีคิดในกระดาษทด แล้วเลือกคำตอบที่ถูกต้องที่สุด',
    duration: 20,
    status: 'open',
    openAt: ago(1 * HOUR + 10 * MIN),
    closeAt: ahead(8 * HOUR),
    createdAt: ago(1 * DAY),
    assignedStudentIds: students.map(s => s.id),
    questions: ratioQuestions
  }),
  makeExam({
    id: 'exam_geometry',
    code: '736104',
    title: 'คณิตศาสตร์ – เรขาคณิตเบื้องต้น',
    shortTitle: 'เรขาคณิตเบื้องต้น',
    subject: 'คณิตศาสตร์',
    topic: 'พื้นที่ ความยาวรอบรูป และปริมาตร',
    level: 'มัธยมศึกษาปีที่ 3',
    teacherId: teachers[1].id,
    teacherName: teachers[1].name,
    teacherCode: teachers[1].code,
    teacherSchool: teachers[1].school,
    description: 'ความรู้พื้นฐานเกี่ยวกับรูปเรขาคณิตสองมิติและสามมิติ',
    instructions: 'อ่านโจทย์และเลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว',
    duration: 25,
    status: 'announced',
    openAt: ago(14 * DAY),
    closeAt: ago(13 * DAY),
    publishedAt: ago(11 * DAY),
    createdAt: ago(16 * DAY),
    settings: { showScore: true, showSolutions: true, showRank: true },
    passPercent: 60,
    assignedStudentIds: [students[0], ...students.slice(2, 10)].map(s => s.id),
    questions: geometryQuestions
  }),
  makeExam({
    id: 'exam_statistics',
    orgId: 'org_satit',
    code: '915270',
    title: 'คณิตศาสตร์ – สถิติและความน่าจะเป็น',
    shortTitle: 'สถิติและความน่าจะเป็น',
    subject: 'คณิตศาสตร์',
    topic: 'ค่าเฉลี่ย มัธยฐาน ฐานนิยม และความน่าจะเป็น',
    level: 'มัธยมศึกษาปีที่ 3',
    teacherId: teachers[0].id,
    teacherName: teachers[0].name,
    teacherCode: teachers[0].code,
    teacherSchool: teachers[0].school,
    description: 'แบบทดสอบการอ่านข้อมูลและการคำนวณค่าสถิติพื้นฐาน',
    instructions: 'อ่านโจทย์และเลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว',
    duration: 20,
    status: 'closed',
    openAt: ago(24 * DAY),
    closeAt: ago(23 * DAY),
    createdAt: ago(26 * DAY),
    settings: { showScore: true, showSolutions: true, showRank: false },
    passPercent: 60,
    assignedStudentIds: [students[0].id],
    questions: statisticsQuestions
  }),
  makeExam({
    id: 'exam_saved_wich',
    orgId: 'org_satit',
    code: '407215',
    title: 'คณิตศาสตร์ – แบบทดสอบสั้น',
    shortTitle: 'แบบทดสอบสั้น',
    subject: 'คณิตศาสตร์',
    topic: 'สถิติพื้นฐาน (บันทึกไว้ ยังไม่เปิดสอบ)',
    level: 'มัธยมศึกษาปีที่ 3',
    teacherId: teachers[0].id,
    teacherName: teachers[0].name,
    teacherCode: teachers[0].code,
    teacherSchool: teachers[0].school,
    description: 'ชุดทดสอบสั้นที่บันทึกไว้ให้ครูทุกคนดูข้อมูลได้ แต่ยังไม่เปิดรับคำตอบ',
    instructions: 'อ่านโจทย์และเลือกคำตอบที่ถูกต้อง',
    duration: 10,
    status: 'saved',
    shareMode: 'edit',
    openAt: ahead(2 * DAY),
    closeAt: ahead(2 * DAY + 6 * HOUR),
    savedAt: ago(2 * HOUR),
    createdAt: ago(4 * HOUR),
    assignedStudentIds: students.map(s => s.id),
    questions: statisticsQuestions.slice(0, 5)
  }),
  makeExam({
    id: 'exam_draft_wich',
    orgId: 'org_satit',
    code: '540118',
    title: 'คณิตศาสตร์ – แบบฝึกหัดเพิ่มเติม',
    shortTitle: 'แบบฝึกหัดเพิ่มเติม',
    subject: 'คณิตศาสตร์',
    topic: 'อัตราส่วนและร้อยละ (ฉบับร่าง)',
    level: 'มัธยมศึกษาปีที่ 3',
    teacherId: teachers[0].id,
    teacherName: teachers[0].name,
    teacherCode: teachers[0].code,
    teacherSchool: teachers[0].school,
    description: 'ชุดฝึกเพิ่มเติมสำหรับนักเรียนที่ต้องการทบทวน',
    instructions: 'ทำข้อสอบให้ครบทุกข้อ',
    duration: 15,
    status: 'draft',
    openAt: ahead(2 * DAY),
    closeAt: ahead(3 * DAY),
    createdAt: ago(6 * HOUR),
    assignedStudentIds: students.map(s => s.id),
    questions: ratioQuestions.slice(0, 5)
  }),
  makeExam({
    id: 'exam_draft_natt',
    code: '271903',
    title: 'คณิตศาสตร์ – ทบทวนก่อนสอบ',
    shortTitle: 'ทบทวนก่อนสอบ',
    subject: 'คณิตศาสตร์',
    topic: 'เรขาคณิต (ฉบับร่าง)',
    level: 'มัธยมศึกษาปีที่ 3',
    teacherId: teachers[1].id,
    teacherName: teachers[1].name,
    teacherCode: teachers[1].code,
    teacherSchool: teachers[1].school,
    description: 'แบบทบทวนเรขาคณิตก่อนสอบกลางภาค',
    instructions: 'อ่านโจทย์และเลือกคำตอบที่ถูกต้อง',
    duration: 15,
    status: 'draft',
    openAt: ahead(3 * DAY),
    closeAt: ahead(4 * DAY),
    createdAt: ago(3 * HOUR),
    assignedStudentIds: students.slice(0, 10).map(s => s.id),
    questions: geometryQuestions.slice(0, 5)
  })
];

function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function buildAnswers(exam, seed, accuracy, options = {}) {
  const rand = mulberry32(seed);
  const answers = {};
  const essays = [
    'แยกตัวประกอบได้ (x − 2)(x − 3) = 0 จึงได้ x = 2 หรือ x = 3 ค่ะ',
    'จาก x² − 5x + 6 = 0 ให้หาตัวเลขสองจำนวนที่คูณได้ 6 และบวกได้ −5 คือ −2 กับ −3 ดังนั้น (x−2)(x−3)=0 จะได้ x=2,3',
    'ใช้สูตรกำลังสอง x = (5 ± √(25−24))/2 = (5 ± 1)/2 ดังนั้น x = 3 หรือ 2',
    'แยกวงเล็บ (x-2)(x-3) = 0 แล้วจับแต่ละวงเล็บเท่ากับศูนย์ค่ะ',
    'x² − 5x + 6 = (x − 2)(x − 3) ดังนั้นคำตอบคือ 2 และ 3',
    'เริ่มจากหาพหุนามสองวงเล็บที่คูณกันได้ x² − 5x + 6 จะได้ (x−2)(x−3) จากนั้น x=2,3'
  ];

  exam.questions.forEach((q, idx) => {
    const correct = rand() < accuracy;
    if (q.type === 'mcq') {
      let value = q.correct;
      if (!correct) {
        const wrong = q.options.filter(o => o.id !== q.correct);
        value = wrong[Math.floor(rand() * wrong.length)].id;
      }
      answers[q.id] = { value, answeredAt: new Date().toISOString(), flagged: rand() < 0.08 };
    } else if (q.type === 'truefalse') {
      answers[q.id] = { value: String(correct ? q.correct : (q.correct === 'true' ? 'false' : 'true')), answeredAt: new Date().toISOString(), flagged: false };
    } else if (q.type === 'short') {
      answers[q.id] = { value: correct ? q.acceptedAnswers[0] : '5', answeredAt: new Date().toISOString(), flagged: false };
    } else if (q.type === 'essay') {
      const essayValue = correct ? essays[seed % essays.length] : (options.weakEssay || 'ลองแยกตัวประกอบแล้วแต่ยังได้คำตอบไม่ครบค่ะ');
      answers[q.id] = { value: essayValue, answeredAt: new Date().toISOString(), flagged: false };
    }
  });

  if (options.partial) {
    const keep = Math.max(3, Math.floor(exam.questions.length * 0.45));
    Object.keys(answers).slice(keep).forEach(id => delete answers[id]);
  }
  return answers;
}

function makeAttempt({ exam, student, index, status = 'submitted', accuracy = 0.75, submittedAt, startedAt, graded = false, partial = false, seedOffset = 0 }) {
  const submitted = submittedAt ? new Date(submittedAt) : now();
  const start = startedAt ? new Date(startedAt) : new Date(submitted.getTime() - (22 + (index % 7)) * MIN);
  const answers = buildAnswers(exam, 1700 + index * 13 + seedOffset, accuracy, { partial });
  const attempt = {
    id: `att_${exam.id}_${student.id}`,
    examId: exam.id,
    studentId: student.id,
    studentName: student.name,
    studentCode: student.code,
    studentClass: student.class,
    status,
    startedAt: start.toISOString(),
    endsAt: new Date(start.getTime() + exam.duration * MIN).toISOString(),
    submittedAt: status === 'in_progress' ? null : submitted.toISOString(),
    answers,
    manualScores: {},
    reviewed: graded,
    antiCheat: [],
    lastQuestion: 0,
    autoSubmitted: false
  };

  if (status === 'in_progress') {
    attempt.endsAt = new Date(Date.now() + (9 + index % 9) * MIN).toISOString();
    attempt.startedAt = new Date(Date.now() - (exam.duration - (9 + index % 9)) * MIN).toISOString();
  }

  if (graded && exam.questions.some(q => q.type === 'essay')) {
    exam.questions.filter(q => q.type === 'essay').forEach(q => {
      attempt.manualScores[q.id] = {
        score: index % 4 === 0 ? q.points : index % 3 === 0 ? q.points - 1 : q.points - 2,
        comment: index % 2 === 0 ? 'อธิบายขั้นตอนได้ชัดเจน ตรวจทานเครื่องหมายอีกครั้ง' : 'เข้าใจหลักการดี แต่ควรเขียนขั้นตอนให้ครบขึ้น',
        gradedAt: new Date(submitted.getTime() + 2 * HOUR).toISOString()
      };
    });
    attempt.gradedAt = new Date(submitted.getTime() + 2 * HOUR).toISOString();
  }

  attempt.antiCheat = index % 5 === 0 ? [{
    type: 'tab_blur', at: new Date(start.getTime() + 8 * MIN).toISOString(), label: 'สลับออกจากหน้าสอบ'
  }] : [];
  return attempt;
}

const mathExam = exams.find(x => x.id === 'exam_math3');
const geometryExam = exams.find(x => x.id === 'exam_geometry');
const statisticsExam = exams.find(x => x.id === 'exam_statistics');

const attempts = [];

// 12 submitted attempts for the live Math exam.
for (let i = 1; i <= 12; i++) {
  const student = students[i];
  const graded = i <= 2;
  attempts.push(makeAttempt({
    exam: mathExam,
    student,
    index: i,
    submittedAt: ago(i * 7 * MIN + i * 14000),
    graded,
    accuracy: Math.max(0.48, 0.94 - i * 0.035),
    seedOffset: i * 7
  }));
}
// 3 students are still working.
for (let i = 13; i <= 15; i++) {
  const student = students[i];
  attempts.push(makeAttempt({
    exam: mathExam,
    student,
    index: i,
    status: 'in_progress',
    accuracy: 0.7,
    partial: true,
    seedOffset: i * 5
  }));
}

// Geometry: demo student gets 18/20, plus classmates for classroom statistics.
for (let i = 0; i < 9; i++) {
  const student = i === 0 ? students[0] : students[i + 1];
  const targetAccuracy = i === 0 ? 0.9 : 0.45 + ((i * 17) % 45) / 100;
  const attempt = makeAttempt({
    exam: geometryExam,
    student,
    index: i + 20,
    submittedAt: ago(13 * DAY + (i + 1) * HOUR),
    startedAt: ago(13 * DAY + (i + 1) * HOUR + 21 * MIN),
    graded: true,
    accuracy: targetAccuracy,
    seedOffset: 300 + i
  });
  attempt.reviewed = true;
  attempts.push(attempt);
}

// Statistics: one closed exam that is waiting for the teacher's announcement.
attempts.push(makeAttempt({
  exam: statisticsExam,
  student: students[0],
  index: 40,
  submittedAt: ago(23 * DAY + 2 * HOUR),
  startedAt: ago(23 * DAY + 2 * HOUR + 18 * MIN),
  graded: true,
  accuracy: 0.7,
  seedOffset: 420
}));

const notices = [
  {
    id: 'notice_welcome',
    target: 'student:stu_demo',
    title: 'ยินดีต้อนรับกลับมา',
    body: 'มีชุดสอบที่เปิดอยู่ 2 ชุด ตรวจสอบกำหนดการก่อนเข้าสอบได้เลย',
    kind: 'info',
    createdAt: ago(35 * MIN),
    href: '#/student'
  },
  {
    id: 'notice_teacher',
    target: 'teacher:teacher_1',
    title: 'มีคำตอบใหม่รอตรวจ',
    body: 'นักเรียนส่งคำตอบวิชาคณิตศาสตร์ บทที่ 3 เข้ามาใหม่',
    kind: 'submission',
    createdAt: ago(7 * MIN),
    href: '#/teacher/exam/exam_math3/students'
  }
];

export function createSeedDB() {
  return {
    meta: { version: 7, createdAt: now().toISOString() },
    organizations: clone(organizations),
    teachers: clone(teachers),
    teacher: clone(teacher),
    classes: clone(seedClasses),
    students: clone(students),
    exams: clone(exams),
    attempts: clone(attempts),
    notices: clone(notices),
    noticeReads: {}
  };
}

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

let database = null;

function cleanClassCode(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

const DB_VERSION = 8;

function normalizeOrgShort(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function orgShortFromName(name) {
  const text = String(name || '').trim();
  const known = {
    '02._.math': 'MATH',
    'โรงเรียนสาธิตวิทยา': 'SAT'
  };
  if (known[text]) return known[text];
  const ascii = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
  return ascii || 'ORG';
}

function uniqueOrgShort(base, used) {
  const start = normalizeOrgShort(base) || 'ORG';
  let candidate = start;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${start.slice(0, 6)}${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

function migrateDB(db) {
  let changed = false;
  if (!db.meta || db.meta.version !== DB_VERSION) changed = true;
  if (!Array.isArray(db.organizations)) { db.organizations = []; changed = true; }
  if (!Array.isArray(db.classes)) { db.classes = []; changed = true; }
  if (!Array.isArray(db.students)) { db.students = []; changed = true; }
  if (!Array.isArray(db.exams)) { db.exams = []; changed = true; }
  if (!Array.isArray(db.attempts)) { db.attempts = []; changed = true; }
  if (!Array.isArray(db.notices)) { db.notices = []; changed = true; }
  if (!db.noticeReads || typeof db.noticeReads !== 'object' || Array.isArray(db.noticeReads)) { db.noticeReads = {}; changed = true; }

  if (!Array.isArray(db.teachers) || !db.teachers.length) {
    const primary = db.teacher && typeof db.teacher === 'object' ? db.teacher : {};
    db.teachers = [{
      ...primary,
      id: primary.id || 'teacher_1',
      code: primary.code || '02._.math',
      name: 'Wich Pitchon',
      shortName: 'Wich',
      email: primary.email || 'wich@02math.app',
      password: primary.password || '123456',
      subject: 'คณิตศาสตร์',
      school: '02._.math',
      isOwner: true,
      roleLabel: 'ผู้สร้างระบบ',
      createdAt: primary.createdAt || new Date().toISOString()
    }];
    changed = true;
  }
  db.teachers = db.teachers.filter(t => t && t.id).map(t => ({
    ...t,
    name: String(t.name || '').trim() || 'ครูผู้สอน',
    shortName: t.shortName || String(t.name || 'ครู').trim().split(/\s+/)[0],
    code: String(t.code || '').trim(),
    subject: 'คณิตศาสตร์',
    password: t.password || '123456',
    staffRole: t.staffRole === 'manager' ? 'manager' : 'teacher',
    isOwner: Boolean(t.isOwner)
  }));
  let owner = db.teachers.find(t => t.id === 'teacher_1') || db.teachers.find(t => t.isOwner) || db.teachers[0];
  if (owner?.id === 'teacher_1') {
    if (owner.code !== '02._.math') { owner.code = '02._.math'; changed = true; }
    if (owner.name !== 'Wich Pitchon') { owner.name = 'Wich Pitchon'; changed = true; }
    if (owner.shortName !== 'Wich') { owner.shortName = 'Wich'; changed = true; }
    if (!owner.email) owner.email = 'wich@02math.app';
    if (owner.roleLabel !== 'ผู้สร้างระบบ') { owner.roleLabel = 'ผู้สร้างระบบ'; changed = true; }
    owner.staffRole = 'teacher';
  }

  const legacyOrganizations = !db.organizations.length;
  if (legacyOrganizations) {
    if (owner?.id === 'teacher_1') {
      owner.school = '02._.math';
      owner.orgId = '';
    }
    const names = [...new Set(db.teachers.map(t => String(t.school || '').trim()).filter(Boolean))];
    if (!names.length) names.push('02._.math');
    const usedShorts = new Set();
    db.organizations = names.map(name => ({
      id: uid('org'),
      name,
      shortName: uniqueOrgShort(orgShortFromName(name), usedShorts),
      type: /โรงเรียน|school/i.test(name) ? 'school' : 'agency',
      createdBy: owner?.id || 'teacher_1',
      createdAt: new Date().toISOString()
    }));
    changed = true;
  }
  const usedOrgShorts = new Set();
  db.organizations = db.organizations.filter(o => o && o.id).map(o => {
    const name = String(o.name || '').trim() || 'หน่วยงานไม่มีชื่อ';
    let shortName = normalizeOrgShort(o.shortName);
    if (!shortName || usedOrgShorts.has(shortName)) {
      shortName = uniqueOrgShort(shortName || orgShortFromName(name), usedOrgShorts);
      changed = true;
    } else {
      usedOrgShorts.add(shortName);
    }
    if (o.name !== name || o.shortName !== shortName) changed = true;
    return {
      ...o,
      name,
      shortName,
      type: o.type === 'school' ? 'school' : 'agency',
      accessLevel: ['view_all', 'manage_all'].includes(o.accessLevel) ? o.accessLevel : 'own',
      hiddenFromGlobal: Boolean(o.hiddenFromGlobal),
      createdAt: o.createdAt || new Date().toISOString()
    };
  });
  if (!db.organizations.length) {
    db.organizations.push({
      id: 'org_math', name: '02._.math', shortName: 'MATH', type: 'agency', accessLevel: 'own',
      createdBy: owner?.id || 'teacher_1', createdAt: new Date().toISOString()
    });
    changed = true;
  }
  const orgById = id => db.organizations.find(o => o.id === id);
  const orgByName = name => db.organizations.find(o => o.name.toLowerCase() === String(name || '').trim().toLowerCase());
  let defaultOrg = db.organizations[0];
  db.teachers.forEach(t => {
    const selected = orgById(t.orgId) || orgByName(t.school) || defaultOrg;
    if (t.orgId !== selected.id) { t.orgId = selected.id; changed = true; }
    if (t.school !== selected.name) { t.school = selected.name; changed = true; }
    if (t.staffRole === 'manager') {
      if (t.roleLabel !== 'ผู้จัดการ') { t.roleLabel = 'ผู้จัดการ'; changed = true; }
    } else if (!t.isOwner && t.roleLabel !== 'ครูผู้สอน') {
      t.roleLabel = 'ครูผู้สอน';
      changed = true;
    }
  });
  if (owner) {
    db.teachers.forEach(t => {
      const shouldOwn = t.id === owner.id;
      if (Boolean(t.isOwner) !== shouldOwn) { t.isOwner = shouldOwn; changed = true; }
    });
  }
  if (owner && !owner.code) { owner.code = '02._.math'; changed = true; }
  const usedTeacherCodes = new Set();
  db.teachers.forEach(t => {
    let code = String(t.code || '').trim().toUpperCase();
    if (!code || usedTeacherCodes.has(code)) {
      const org = orgById(t.orgId) || defaultOrg;
      const prefix = `${t.staffRole === 'manager' ? 'MGR' : 'TCH'}${org.shortName}`;
      let n = 1;
      do { code = `${prefix}${String(n).padStart(2, '0')}`; n += 1; } while (usedTeacherCodes.has(code));
      t.code = code;
      changed = true;
    }
    usedTeacherCodes.add(code);
  });
  db.teacher = owner || db.teachers[0];
  const teacherById = id => db.teachers.find(t => t.id === id);
  const firstStudentOrgId = db.teachers.find(t => !t.isOwner)?.orgId || owner?.orgId || defaultOrg.id;
  defaultOrg = orgById(firstStudentOrgId) || defaultOrg;

  db.classes = db.classes.filter(cls => cls && cls.id && cleanClassCode(cls.code));
  db.classes.forEach(cls => {
    const org = orgById(cls.orgId) || defaultOrg;
    if (cls.orgId !== org.id) { cls.orgId = org.id; changed = true; }
  });

  const resolveClassForOrg = (rawCode, preferredId, orgId) => {
    let cls = preferredId ? db.classes.find(c => c.id === preferredId && c.orgId === orgId) : null;
    if (cls) return cls;
    const code = cleanClassCode(rawCode) || 'ไม่ระบุห้อง';
    cls = db.classes.find(c => c.orgId === orgId && cleanClassCode(c.code).toLowerCase() === code.toLowerCase());
    if (cls) return cls;
    cls = { id: uid('cls'), code, orgId, createdAt: new Date().toISOString() };
    db.classes.push(cls);
    changed = true;
    return cls;
  };

  db.students.forEach(student => {
    const org = orgById(student.orgId) || defaultOrg;
    if (student.orgId !== org.id) { student.orgId = org.id; changed = true; }
    let ids = Array.isArray(student.classIds)
      ? student.classIds.filter(id => db.classes.some(cls => cls.id === id && cls.orgId === org.id))
      : [];
    if (!ids.length && student.classId) {
      const preferred = db.classes.find(cls => cls.id === student.classId && cls.orgId === org.id);
      if (preferred) ids = [preferred.id];
    }
    if (!ids.length) {
      const cls = resolveClassForOrg(student.class, student.classId, org.id);
      ids = [cls.id];
    }
    ids = [...new Set(ids)];
    if (!Array.isArray(student.classIds) || student.classIds.length !== ids.length || student.classIds.some((id, i) => id !== ids[i])) {
      student.classIds = ids;
      changed = true;
    }
    if (student.classId !== ids[0]) { student.classId = ids[0]; changed = true; }
    const label = ids.map(id => db.classes.find(cls => cls.id === id)?.code).filter(Boolean).join(', ');
    if (student.class !== label) { student.class = label; changed = true; }
    if (!student.password) {
      student.password = '123456';
      changed = true;
    }
  });

  db.exams.forEach(exam => {
    if (exam.subject !== 'คณิตศาสตร์') { exam.subject = 'คณิตศาสตร์'; changed = true; }
    const nextShareMode = exam.shareMode === 'edit' ? 'edit' : 'view';
    if (exam.shareMode !== nextShareMode) { exam.shareMode = nextShareMode; changed = true; }
    if (!exam.openAt || Number.isNaN(new Date(exam.openAt).getTime())) {
      exam.openAt = new Date().toISOString();
      changed = true;
    }
    if (!exam.closeAt || Number.isNaN(new Date(exam.closeAt).getTime()) || new Date(exam.closeAt).getTime() <= new Date(exam.openAt).getTime()) {
      exam.closeAt = new Date(new Date(exam.openAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
      changed = true;
    }
    if (!Array.isArray(exam.assignedStudentIds)) {
      exam.assignedStudentIds = db.students.map(s => s.id);
      changed = true;
    }
    if (!Array.isArray(exam.reviewerIds)) {
      exam.reviewerIds = [];
      changed = true;
    }
    const examTeacher = teacherById(exam.teacherId);
    if (!examTeacher) {
      exam.teacherId = db.teacher.id;
      exam.teacherName = db.teacher.name;
      exam.teacherCode = db.teacher.code;
      exam.teacherSchool = db.teacher.school;
      changed = true;
    } else {
      if (exam.teacherName !== examTeacher.name) { exam.teacherName = examTeacher.name; changed = true; }
      if (exam.teacherCode !== examTeacher.code) { exam.teacherCode = examTeacher.code; changed = true; }
      if (exam.teacherSchool !== examTeacher.school) { exam.teacherSchool = examTeacher.school; changed = true; }
    }
    let orgIds = Array.isArray(exam.orgIds)
      ? [...new Set(exam.orgIds.filter(id => orgById(id)))]
      : [];
    if (!orgIds.length) {
      const knownOrg = orgById(exam.orgId);
      const assignedOrgId = Array.isArray(exam.assignedStudentIds)
        ? db.students.find(st => exam.assignedStudentIds.includes(st.id))?.orgId
        : null;
      const fallback = knownOrg?.id || orgById(assignedOrgId)?.id || examTeacher?.orgId || db.organizations[0]?.id;
      if (fallback) orgIds = [fallback];
    }
    if (!orgIds.length) orgIds = [db.organizations[0].id];
    if (!Array.isArray(exam.orgIds) || exam.orgIds.length !== orgIds.length || exam.orgIds.some((id, i) => id !== orgIds[i])) {
      exam.orgIds = orgIds;
      changed = true;
    }
    if (exam.orgId !== orgIds[0]) {
      exam.orgId = orgIds[0];
      changed = true;
    }
  });
  if (db.meta?.version !== DB_VERSION) {
    db.meta = { ...(db.meta || {}), version: DB_VERSION };
    changed = true;
  }
  return changed;
}

export function reloadDB() {
  const stored = safeParse(localStorage.getItem(DB_KEY));
  if (stored) {
    database = stored;
    if (migrateDB(database)) persist();
  }
  return database;
}

export function loadDB() {
  if (database) return database;
  const stored = safeParse(localStorage.getItem(DB_KEY));
  if (stored && Array.isArray(stored.exams)) {
    database = stored;
    if (migrateDB(database)) persist();
    return database;
  }
  database = createSeedDB();
  persist();
  return database;
}

export function getDB() {
  return database || loadDB();
}

export function replaceDB(next) {
  if (next) database = next;
}

export function persist() {
  if (!database) return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(database));
  } catch (err) {
    console.warn('Unable to persist exam data', err);
  }
}

export function saveDB() {
  persist();
  window.dispatchEvent(new CustomEvent('examio:datachange'));
  // Returning the queue lets critical actions (opening an exam, adding a
  // student) wait until the cloud snapshot is actually readable by students.
  return database ? cloudSave(database) : Promise.resolve();
}

export function resetDB() {
  database = createSeedDB();
  persist();
  sessionStorage.clear();
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent('examio:datachange'));
}

export function getSession() {
  return safeParse(localStorage.getItem(SESSION_KEY));
}

export function setSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, loginAt: session.loginAt || new Date().toISOString() }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function findExam(id) {
  return getDB().exams.find(exam => exam.id === id) || null;
}

export function findStudent(id) {
  return getDB().students.find(s => s.id === id) || null;
}

export function getTeacherById(id, db = getDB()) {
  return (db.teachers || []).find(t => t.id === id) || null;
}

export function currentTeacher(session) {
  if (!session || session.role !== 'teacher') return null;
  const teacher = getTeacherById(session.teacherId);
  return teacher && !teacher.deletedAt ? teacher : null;
}

export function isOwnerTeacher(session) {
  return Boolean(currentTeacher(session)?.isOwner);
}

export function creatorOfExam(exam, db = getDB()) {
  if (!exam) return null;
  return getTeacherById(exam.teacherId, db) || {
    id: exam.teacherId || '',
    name: exam.teacherName || 'ไม่ระบุผู้สร้าง',
    school: exam.teacherSchool || '',
    code: exam.teacherCode || ''
  };
}

export function findOrganization(id, db = getDB()) {
  return (db.organizations || []).find(org => org.id === id) || null;
}

export function examOrganizationIds(exam, db = getDB()) {
  if (!exam) return [];
  const ids = Array.isArray(exam.orgIds) ? exam.orgIds.filter(Boolean) : [];
  if (ids.length) return [...new Set(ids)];
  if (exam.orgId) return [exam.orgId];
  const creator = (db.teachers || []).find(t => t.id === exam.teacherId);
  return creator?.orgId ? [creator.orgId] : [];
}

export function examOrganizationId(exam, db = getDB()) {
  return examOrganizationIds(exam, db)[0] || '';
}

export function examOrganizationName(exam, db = getDB()) {
  const names = examOrganizationIds(exam, db)
    .map(id => findOrganization(id, db)?.name)
    .filter(Boolean);
  return names.length ? names.join(' · ') : 'ไม่ระบุหน่วยงาน';
}

export function organizationOfTeacher(teacher, db = getDB()) {
  if (!teacher) return null;
  return findOrganization(teacher.orgId, db) || null;
}

export function organizationOfStudent(student, db = getDB()) {
  if (!student) return null;
  return findOrganization(student.orgId, db) || null;
}

export function organizationName(id, db = getDB()) {
  return findOrganization(id, db)?.name || 'ไม่ระบุหน่วยงาน';
}

export function isManagerStaff(session) {
  const teacher = currentTeacher(session);
  return Boolean(teacher && !teacher.isOwner && teacher.staffRole === 'manager');
}

export function organizationAccessLevel(org) {
  return org && ['view_all', 'manage_all'].includes(org.accessLevel) ? org.accessLevel : 'own';
}

export function currentOrganization(session, db = getDB()) {
  return organizationOfTeacher(currentTeacher(session), db);
}

export function isOrganizationHidden(org) {
  return Boolean(org?.hiddenFromGlobal);
}

// Wich always sees every organization. A global viewer can see its own
// organization plus every organization that has not been hidden by Wich.
export function canAccessOrganization(orgId, session, db = getDB()) {
  if (!orgId) return false;
  if (isOwnerTeacher(session)) return true;
  const me = currentTeacher(session);
  if (!me) return false;
  if (me.orgId === orgId) return true;
  const org = findOrganization(orgId, db);
  if (!org || isOrganizationHidden(org)) return false;
  return hasAllOrganizationAccess(session, db);
}

export function visibleOrganizations(session, db = getDB()) {
  const orgs = db.organizations || [];
  if (isOwnerTeacher(session)) return [...orgs];
  const me = currentTeacher(session);
  if (!me) return [];
  if (!hasAllOrganizationAccess(session, db)) return orgs.filter(o => o.id === me.orgId);
  return orgs.filter(o => o.id === me.orgId || !isOrganizationHidden(o));
}

export function hasAllOrganizationAccess(session, db = getDB()) {
  if (isOwnerTeacher(session)) return true;
  const org = currentOrganization(session, db);
  return ['view_all', 'manage_all'].includes(organizationAccessLevel(org));
}

export function canManageOrganizations(session, db = getDB()) {
  if (isOwnerTeacher(session)) return true;
  // Organization-level management belongs to the manager role only. A teacher
  // account in a manage_all organization may view the data but must not manage
  // organizations, staff, or other organizations.
  if (!isManagerStaff(session)) return false;
  return organizationAccessLevel(currentOrganization(session, db)) === 'manage_all';
}

export function canAccessStudent(student, session) {
  if (!student) return false;
  return canAccessOrganization(student.orgId, session);
}

export function canAccessStaff(staff, session) {
  if (!staff) return false;
  return canAccessOrganization(staff.orgId, session);
}

function staffOrder(a, b) {
  const rank = t => t.isOwner ? 0 : t.staffRole === 'manager' ? 1 : 2;
  return rank(a) - rank(b) || a.name.localeCompare(b.name, 'th');
}

export function visibleStaff(session, db = getDB(), orgFilter = 'all') {
  const active = (db.teachers || []).filter(t => !t.deletedAt);
  return active
    .filter(t => (orgFilter === 'all' || t.orgId === orgFilter)
      && (canAccessOrganization(t.orgId, session, db) || t.isOwner))
    .sort(staffOrder);
}

export function visibleStudents(session, db = getDB(), orgFilter = 'all') {
  if (!session || session.role !== 'teacher') return [];
  return (db.students || []).filter(s =>
    (orgFilter === 'all' || s.orgId === orgFilter)
    && canAccessOrganization(s.orgId, session, db)
  );
}

export function visibleClasses(session, db = getDB(), orgFilter = 'all') {
  if (!session || session.role !== 'teacher') return [];
  return (db.classes || []).filter(c =>
    (orgFilter === 'all' || c.orgId === orgFilter)
    && canAccessOrganization(c.orgId, session, db)
  );
}

export function visibleExams(session, db = getDB()) {
  const exams = db.exams || [];
  if (!session || session.role !== 'teacher') return exams.filter(exam => exam.status !== 'draft');
  if (isOwnerTeacher(session)) return [...exams];
  const me = currentTeacher(session);
  if (!me) return [];
  const manager = isManagerStaff(session);
  return exams.filter(exam => {
    const orgIds = examOrganizationIds(exam, db);
    if (!orgIds.some(id => canAccessOrganization(id, session, db))) return false;
    if (hasAllOrganizationAccess(session, db)) return true;
    return orgIds.includes(me.orgId)
      && (manager || exam.status !== 'draft' || exam.teacherId === session.teacherId);
  });
}

export function canViewExam(exam, session) {
  if (!exam) return false;
  if (isOwnerTeacher(session)) return true;
  if (!session || session.role !== 'teacher') return exam.status !== 'draft';
  const me = currentTeacher(session);
  if (!me) return false;
  const orgIds = examOrganizationIds(exam);
  if (!orgIds.some(id => canAccessOrganization(id, session))) return false;
  if (hasAllOrganizationAccess(session)) return true;
  return orgIds.includes(me.orgId)
    && (isManagerStaff(session) || exam.status !== 'draft' || exam.teacherId === session.teacherId);
}

export function canManageExam(exam, session) {
  if (!exam || !session || session.role !== 'teacher') return false;
  if (!canViewExam(exam, session)) return false;
  return isOwnerTeacher(session) || exam.teacherId === session.teacherId;
}

export function canReviewExam(exam, session) {
  if (!exam || !session || session.role !== 'teacher') return false;
  if (!canViewExam(exam, session)) return false;
  if (isOwnerTeacher(session) || exam.teacherId === session.teacherId) return true;
  if (isManagerStaff(session)) {
    const me = currentTeacher(session);
    if (me && examOrganizationIds(exam).includes(me.orgId)) return true;
    // A manager of a manage_all organization may also review exams in the
    // organizations visible to that organization.
    if (canManageOrganizations(session)) return true;
  }
  return Array.isArray(exam.reviewerIds) && exam.reviewerIds.includes(session.teacherId);
}

// Managers (and the owner/creator) can ask the people responsible for an exam
// to clear the review queue. Assigned reviewers can review but cannot send
// reminders on behalf of the exam owner.
export function canSendReviewReminder(exam, session) {
  if (!exam || !session || session.role !== 'teacher') return false;
  if (!canReviewExam(exam, session)) return false;
  return isOwnerTeacher(session)
    || exam.teacherId === session.teacherId
    || isManagerStaff(session);
}

export function sendReviewReminder(examId, teacherIds = [], actor = null) {
  const db = getDB();
  const exam = db.exams.find(e => e.id === examId && !e.deletedAt);
  if (!exam) return { ok: false, error: 'ไม่พบชุดสอบ' };
  if (!canSendReviewReminder(exam, actor)) {
    return { ok: false, error: 'เฉพาะเจ้าของชุดสอบ ผู้จัดการหน่วยงาน หรือ Wich เท่านั้นที่ส่งแจ้งเตือนได้' };
  }
  const reviewerIds = new Set(Array.isArray(exam.reviewerIds) ? exam.reviewerIds : []);
  const allowed = new Set(visibleStaff(actor, db, 'all')
    .filter(t => t.id !== actor.teacherId)
    .filter(t => reviewerIds.has(t.id) || canReviewExam(exam, {
      role: 'teacher', teacherId: t.id, orgId: t.orgId, staffRole: t.staffRole
    }))
    .map(t => t.id));
  const ids = [...new Set((Array.isArray(teacherIds) ? teacherIds : []).map(String).filter(Boolean))]
    .filter(id => allowed.has(id));
  if (!ids.length) return { ok: false, error: 'ยังไม่มีครูที่สามารถรับแจ้งเตือนได้' };
  if (!Array.isArray(db.notices)) db.notices = [];
  const pending = (db.attempts || []).filter(a => a.examId === exam.id
    && a.status !== 'in_progress'
    && (!a.reviewed || pendingEssayQuestions(exam, a).length > 0)).length;
  const createdAt = new Date().toISOString();
  const sender = currentTeacher(actor);
  const senderName = sender?.name || actor?.name || '';
  ids.forEach(id => {
    db.notices.unshift({
      id: uid('notice'),
      createdAt,
      read: false,
      target: `teacher:${id}`,
      title: 'แจ้งเตือนตรวจคำตอบ',
      body: `${exam.shortTitle || exam.title} · ${pending} รายการรอตรวจ${senderName ? ` · จาก ${senderName}` : ''}`,
      kind: 'review',
      href: `#/teacher/review?exam=${exam.id}&status=pending`
    });
  });
  if (db.notices.length > 1000) db.notices = db.notices.slice(0, 1000);
  return { ok: true, count: ids.length, pending: saveDB() };
}

export function setExamReviewers(examId, reviewerIds = [], actor = null) {
  const db = getDB();
  const exam = db.exams.find(e => e.id === examId);
  if (!exam) return { ok: false, error: 'ไม่พบชุดสอบ' };
  if (!canManageExam(exam, actor)) {
    return { ok: false, error: 'เฉพาะเจ้าของชุดสอบและ Wich เท่านั้นที่เลือกผู้ตรวจได้' };
  }
  const allowed = new Set((db.teachers || [])
    .filter(t => !t.deletedAt && t.id !== exam.teacherId)
    .filter(t => canViewExam(exam, {
      role: 'teacher', teacherId: t.id, orgId: t.orgId, staffRole: t.staffRole
    }))
    .map(t => t.id));
  const clean = [...new Set((Array.isArray(reviewerIds) ? reviewerIds : []).map(String).filter(Boolean))]
    .filter(id => allowed.has(id));
  exam.reviewerIds = clean;
  return { ok: true, exam, pending: saveDB() };
}

export function canEditExam(exam, session) {
  if (!exam || !session || session.role !== 'teacher') return false;
  if (!canViewExam(exam, session)) return false;
  if (canManageExam(exam, session)) return true;
  if (exam.status === 'draft') return false;
  return exam.shareMode === 'edit';
}

export function canViewExamStats(exam, session) {
  if (!exam || !session || session.role !== 'teacher') return false;
  return canViewExam(exam, session);
}

function normalizeLoginText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function findStudentByLogin(identifier, db = getDB()) {
  const key = normalizeLoginText(identifier);
  if (!key) return null;
  return (db.students || []).find(st => (
    normalizeLoginText(st.code) === key ||
    normalizeLoginText(st.name) === key
  )) || null;
}

export function findTeacherByLogin(identifier, db = getDB()) {
  const key = normalizeLoginText(identifier);
  if (!key) return null;
  return (db.teachers || []).find(t => !t.deletedAt && (
    normalizeLoginText(t.code) === key ||
    normalizeLoginText(t.name) === key ||
    normalizeLoginText(t.email) === key
  )) || null;
}

export function staffCodePrefix(org, staffRole = 'teacher') {
  const short = normalizeOrgShort(org?.shortName) || 'ORG';
  return `${staffRole === 'manager' ? 'MGR' : 'TCH'}${short}`;
}

export function nextTeacherCode(db = getDB(), orgId = null, staffRole = 'teacher') {
  const org = findOrganization(orgId, db) || (db.organizations || [])[0];
  const prefix = staffCodePrefix(org, staffRole);
  let max = 0;
  (db.teachers || []).forEach(t => {
    const code = String(t.code || '').toUpperCase();
    if (!code.startsWith(prefix)) return;
    const suffix = code.slice(prefix.length);
    if (/^\d+$/.test(suffix)) max = Math.max(max, Number(suffix));
  });
  let code;
  let n = max + 1;
  do { code = `${prefix}${String(n).padStart(2, '0')}`; n += 1; } while ((db.teachers || []).some(t => String(t.code).toUpperCase() === code));
  return code;
}

export function generateStudentPassword() {
  return '123456';
}

export function generateStudentCode(db = getDB(), org = null) {
  const prefix = normalizeOrgShort(org?.shortName) || 'STU';
  const globalCodes = new Set((db.students || []).map(student => String(student.code || '').trim().toUpperCase()));
  const orgCodes = new Set((db.students || [])
    .filter(student => !org || student.orgId === org.id)
    .map(student => String(student.code || '').trim().toUpperCase()));
  let next = 1;
  let code;
  do {
    code = `${prefix}${String(next).padStart(4, '0')}`;
    next += 1;
  } while (orgCodes.has(code) || globalCodes.has(code));
  return code;
}

export function addTeacher({ name, orgId, staffRole = 'teacher', code, password } = {}, actor = null) {
  const actorTeacher = currentTeacher(actor);
  const owner = isOwnerTeacher(actor);
  const globalManager = canManageOrganizations(actor);
  if (!owner && !globalManager) return { ok: false, error: 'เฉพาะ Wich หรือผู้จัดการในหน่วยงานที่มีสิทธิ์จัดการองค์กรเท่านั้นที่สร้างบัญชีครูได้' };
  const db = getDB();
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
  const role = (owner || globalManager) && staffRole === 'manager' ? 'manager' : 'teacher';
  const org = (owner || globalManager)
    ? (findOrganization(orgId, db) || findOrganization(actorTeacher?.orgId, db))
    : findOrganization(actorTeacher?.orgId, db);
  if (!org) return { ok: false, error: 'กรุณาเลือกหน่วยงานหรือโรงเรียน' };
  if (!canAccessOrganization(org.id, actor, db)) return { ok: false, error: 'คุณไม่มีสิทธิ์เข้าถึงหน่วยงานนี้' };
  const expectedPrefix = staffCodePrefix(org, role);
  let cleanCode = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cleanCode) cleanCode = nextTeacherCode(db, org.id, role);
  if (cleanName.length < 3) return { ok: false, error: 'กรุณากรอกชื่อ–นามสกุลของครูอย่างน้อย 3 ตัวอักษร' };
  if (db.teachers.some(t => !t.deletedAt && normalizeLoginText(t.name) === normalizeLoginText(cleanName))) {
    return { ok: false, error: 'มีชื่อครูคนนี้อยู่ในระบบแล้ว กรุณาใช้ชื่อ–นามสกุลที่ต่างกัน' };
  }
  if (!cleanCode.startsWith(expectedPrefix) || !new RegExp(`^${expectedPrefix}\\d*$`).test(cleanCode)) {
    return { ok: false, error: `รหัสต้องขึ้นต้นด้วย ${expectedPrefix} และต่อท้ายด้วยตัวเลขเท่านั้น` };
  }
  if (cleanCode.length > 24) return { ok: false, error: 'รหัสครูต้องไม่เกิน 24 ตัวอักษร' };
  if (db.teachers.some(t => normalizeLoginText(t.code) === normalizeLoginText(cleanCode))) {
    return { ok: false, error: 'รหัสครูนี้ถูกใช้งานแล้ว' };
  }
  const cleanPassword = String(password || '123456').trim();
  if (cleanPassword.length < 4) return { ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' };
  const teacher = {
    id: uid('teacher'),
    code: cleanCode,
    name: cleanName,
    shortName: cleanName.split(/\s+/)[0],
    email: '',
    password: cleanPassword,
    subject: 'คณิตศาสตร์',
    orgId: org.id,
    school: org.name,
    phone: '',
    isOwner: false,
    staffRole: role,
    roleLabel: role === 'manager' ? 'ผู้จัดการ' : 'ครูผู้สอน',
    createdBy: actor.teacherId,
    createdByName: actor.name,
    createdAt: new Date().toISOString()
  };
  db.teachers.push(teacher);
  saveDB();
  return { ok: true, teacher, organization: org };
}

export function updateTeacherOrg(teacherId, nextOrgId, actor = null) {
  if (!isOwnerTeacher(actor) && !canManageOrganizations(actor)) return { ok: false, error: 'เฉพาะ Wich หรือหน่วยงานหลักเท่านั้นที่ย้ายหน่วยงานครูได้' };
  const db = getDB();
  const teacher = db.teachers.find(t => t.id === teacherId && !t.deletedAt);
  if (!teacher) return { ok: false, error: 'ไม่พบบัญชีครู' };
  if (teacher.isOwner) return { ok: false, error: 'ไม่สามารถย้ายหน่วยงานเจ้าของระบบได้' };
  if (!isOwnerTeacher(actor) && teacher.id === actor.teacherId) return { ok: false, error: 'ไม่สามารถย้ายหน่วยงานของตนเองได้' };
  const org = findOrganization(nextOrgId, db);
  if (!org) return { ok: false, error: 'ไม่พบหน่วยงานปลายทาง' };
  teacher.orgId = org.id;
  teacher.school = org.name;
  db.exams.forEach(exam => {
    if (exam.teacherId !== teacher.id) return;
    const ids = examOrganizationIds(exam, db);
    if (ids.length <= 1) {
      exam.orgId = org.id;
      exam.orgIds = [org.id];
    }
    exam.teacherSchool = org.name;
  });
  saveDB();
  return { ok: true, teacher, organization: org };
}

export function removeTeacher(teacherId, actor = null) {
  const db = getDB();
  const teacher = db.teachers.find(t => t.id === teacherId && !t.deletedAt);
  if (!teacher) return { ok: false, error: 'ไม่พบบัญชีครู' };
  if (teacher.isOwner) return { ok: false, error: 'ไม่สามารถลบบัญชีเจ้าของระบบได้' };
  if (actor?.role === 'teacher' && actor.teacherId === teacher.id) return { ok: false, error: 'ไม่สามารถลบบัญชีของตนเองได้' };
  const owner = isOwnerTeacher(actor);
  const globalManager = canManageOrganizations(actor);
  if (!owner && !globalManager) return { ok: false, error: 'เฉพาะ Wich หรือผู้จัดการในหน่วยงานที่มีสิทธิ์จัดการองค์กรเท่านั้นที่ลบบัญชีได้' };
  if (!owner && teacher.staffRole !== 'teacher') return { ok: false, error: 'ลบได้เฉพาะบัญชีครูผู้สอน' };
  teacher.deletedAt = new Date().toISOString();
  teacher.deletedBy = actor.teacherId;
  saveDB();
  return { ok: true, teacher };
}

export function updateExam(examId, updates = {}, actor = null) {
  const db = getDB();
  const exam = db.exams.find(e => e.id === examId);
  if (!exam) return { ok: false, error: 'ไม่พบชุดสอบ' };
  if (!canEditExam(exam, actor)) return { ok: false, error: 'ชุดสอบนี้ตั้งค่าให้ดูได้อย่างเดียว หรือคุณไม่มีสิทธิ์แก้ไข' };
  Object.assign(exam, updates);
  exam.totalPoints = exam.questions.reduce((sum, q) => sum + Number(q.points || 0), 0);
  return { ok: true, exam, pending: saveDB() };
}

export function deleteExam(examId, actor = null) {
  const db = getDB();
  const exam = db.exams.find(e => e.id === examId);
  if (!exam) return { ok: false, error: 'ไม่พบชุดสอบ' };
  if (!canManageExam(exam, actor)) return { ok: false, error: 'เฉพาะเจ้าของชุดสอบและ Wich Pitchon เท่านั้นที่ลบได้' };
  const attempts = db.attempts.filter(a => a.examId === examId).length;
  db.exams = db.exams.filter(e => e.id !== examId);
  db.attempts = db.attempts.filter(a => a.examId !== examId);
  db.notices = (db.notices || []).filter(n => {
    const href = String(n.href || '');
    return !href.includes(`/exam/${examId}`) && n.target !== `exam:${examId}`;
  });
  saveDB();
  return { ok: true, title: exam.title, code: exam.code, attempts };
}


export function classIdsOf(student) {
  if (!student) return [];
  if (Array.isArray(student.classIds) && student.classIds.length) {
    return [...new Set(student.classIds.filter(Boolean))];
  }
  return student.classId ? [student.classId] : [];
}

export function classCodesOf(student, db = getDB()) {
  return classIdsOf(student)
    .map(id => db.classes.find(cls => cls.id === id)?.code)
    .filter(Boolean);
}

export function studentClassLabel(student, db = getDB()) {
  const codes = classCodesOf(student, db);
  return codes.join(', ') || cleanClassCode(student?.class) || 'ไม่ระบุ class';
}

export function studentsInClass(classId, db = getDB()) {
  return db.students.filter(student => classIdsOf(student).includes(classId));
}

function syncStudentClassLabel(student, db) {
  const ids = classIdsOf(student);
  student.classIds = ids;
  student.classId = ids[0] || '';
  student.class = ids.map(id => db.classes.find(cls => cls.id === id)?.code).filter(Boolean).join(', ');
}

export function addStudent({ name, code, classId, classIds, className, orgId, password } = {}, actor = null) {
  const db = getDB();
  const actorTeacher = currentTeacher(actor);
  if (!actorTeacher) return { ok: false, error: 'ต้องเข้าสู่ระบบด้วยบัญชีครูจึงเพิ่มนักเรียนได้' };
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
  // Only Wich and a manager whose organization has manage_all may choose a
  // different organization. A teacher assigned to a manage_all organization
  // still adds students to their own organization only.
  const canChooseOrg = isOwnerTeacher(actor)
    || (isManagerStaff(actor) && canManageOrganizations(actor));
  let org = canChooseOrg ? findOrganization(orgId, db) : findOrganization(actorTeacher.orgId, db);
  if (!org) org = findOrganization(actorTeacher.orgId, db) || (db.organizations || [])[0];
  if (!org) return { ok: false, error: 'ไม่พบหน่วยงานหรือโรงเรียน' };
  if (!canAccessOrganization(org.id, actor, db)) return { ok: false, error: 'คุณไม่มีสิทธิ์เข้าถึงหน่วยงานนี้' };
  if (!cleanName) return { ok: false, error: 'กรุณากรอกชื่อ–นามสกุล' };
  let cleanCode = String(code || '').trim().toUpperCase();
  const orgPrefix = normalizeOrgShort(org.shortName);
  while (orgPrefix && cleanCode.startsWith(orgPrefix + orgPrefix)) {
    cleanCode = cleanCode.slice(orgPrefix.length);
  }
  if (!cleanCode) cleanCode = generateStudentCode(db, org);
  if (cleanCode.length < 3) return { ok: false, error: 'รหัสนักเรียนต้องมีอย่างน้อย 3 ตัวอักษร' };
  if (db.students.some(s => String(s.code).toLowerCase() === cleanCode.toLowerCase())) {
    return { ok: false, error: 'รหัสนักเรียนนี้มีอยู่ในทะเบียนแล้ว' };
  }
  let ids = Array.isArray(classIds) ? classIds : classId ? [classId] : [];
  ids = [...new Set(ids)].filter(id => db.classes.some(cls => cls.id === id && cls.orgId === org.id));
  if (!ids.length && className) {
    const cls = db.classes.find(c => c.orgId === org.id && cleanClassCode(c.code).toLowerCase() === cleanClassCode(className).toLowerCase());
    if (cls) ids = [cls.id];
  }
  if (!ids.length) return { ok: false, error: `กรุณาเลือก class ของ ${org.name} อย่างน้อย 1 class` };
  const cleanPassword = String(password || generateStudentPassword(cleanCode)).trim();
  if (cleanPassword.length < 4) return { ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' };
  const student = {
    id: uid('stu'),
    name: cleanName,
    code: cleanCode,
    orgId: org.id,
    password: cleanPassword,
    classIds: ids,
    classId: ids[0],
    class: ids.map(id => db.classes.find(cls => cls.id === id)?.code).filter(Boolean).join(', '),
    createdBy: actor.teacherId,
    createdByName: actor.name,
    createdAt: new Date().toISOString()
  };
  db.students.push(student);
  saveDB();
  return { ok: true, student, organization: org };
}

export function addClass(code, actor = null, orgId = null) {
  if (!isOwnerTeacher(actor)) return { ok: false, error: 'เฉพาะ Wich Pitchon เท่านั้นที่สร้าง class ได้' };
  const db = getDB();
  const org = findOrganization(orgId, db) || findOrganization(currentTeacher(actor)?.orgId, db);
  if (!org) return { ok: false, error: 'กรุณาเลือกหน่วยงานสำหรับ class' };
  const clean = cleanClassCode(code);
  if (!clean) return { ok: false, error: 'กรุณากรอกรหัส class' };
  if (clean.length > 32) return { ok: false, error: 'รหัส class ต้องไม่เกิน 32 ตัวอักษร' };
  const existing = db.classes.find(c => c.orgId === org.id && cleanClassCode(c.code).toLowerCase() === clean.toLowerCase());
  if (existing) return { ok: false, error: `มี class นี้อยู่แล้วใน ${org.name}`, existing };
  const cls = { id: uid('cls'), code: clean, orgId: org.id, createdAt: new Date().toISOString() };
  db.classes.push(cls);
  saveDB();
  return { ok: true, class: cls, organization: org };
}

export function addClassAcrossOrganizations(code, actor = null, orgIds = null) {
  if (!isOwnerTeacher(actor)) return { ok: false, error: 'เฉพาะ Wich Pitchon เท่านั้นที่สร้าง class ได้' };
  const db = getDB();
  const clean = cleanClassCode(code);
  if (!clean) return { ok: false, error: 'กรุณากรอกรหัส class' };
  if (clean.length > 32) return { ok: false, error: 'รหัส class ต้องไม่เกิน 32 ตัวอักษร' };
  const wanted = Array.isArray(orgIds) && orgIds.length ? new Set(orgIds) : null;
  const targets = db.organizations.filter(org => !wanted || wanted.has(org.id));
  if (!targets.length) return { ok: false, error: 'ไม่พบหน่วยงานสำหรับสร้าง class' };
  const created = [];
  const skipped = [];
  targets.forEach(org => {
    const existing = db.classes.find(c => c.orgId === org.id && cleanClassCode(c.code).toLowerCase() === clean.toLowerCase());
    if (existing) {
      skipped.push({ organization: org, class: existing });
      return;
    }
    const cls = { id: uid('cls'), code: clean, orgId: org.id, createdAt: new Date().toISOString() };
    db.classes.push(cls);
    created.push({ organization: org, class: cls });
  });
  if (created.length) saveDB();
  if (!created.length) {
    return { ok: false, error: `มี class ${clean} อยู่แล้วในทุกหน่วยงานที่เลือก`, skipped };
  }
  return { ok: true, created, skipped };
}

export function renameClass(classId, code, actor = null) {
  if (!isOwnerTeacher(actor)) return { ok: false, error: 'เฉพาะ Wich Pitchon เท่านั้นที่เปลี่ยนชื่อ class ได้' };
  const db = getDB();
  const cls = db.classes.find(c => c.id === classId);
  if (!cls) return { ok: false, error: 'ไม่พบ class นี้' };
  const clean = cleanClassCode(code);
  if (!clean) return { ok: false, error: 'กรุณากรอกรหัส class' };
  if (clean.length > 32) return { ok: false, error: 'รหัส class ต้องไม่เกิน 32 ตัวอักษร' };
  if (db.classes.some(c => c.id !== classId && c.orgId === cls.orgId && cleanClassCode(c.code).toLowerCase() === clean.toLowerCase())) {
    return { ok: false, error: 'มี class นี้อยู่แล้วในหน่วยงานเดียวกัน' };
  }
  cls.code = clean;
  db.students.forEach(student => {
    if (classIdsOf(student).includes(classId)) syncStudentClassLabel(student, db);
  });
  saveDB();
  return { ok: true, class: cls };
}

export function deleteClass(classId, actor = null) {
  if (!isOwnerTeacher(actor)) return { ok: false, error: 'เฉพาะ Wich Pitchon เท่านั้นที่ลบ class ได้' };
  const db = getDB();
  const cls = db.classes.find(c => c.id === classId);
  if (!cls) return { ok: false, error: 'ไม่พบ class นี้' };
  const count = studentsInClass(classId, db).length;
  if (count) return { ok: false, error: `class นี้ยังมีนักเรียน ${count} คน กรุณาย้ายนักเรียนออกก่อน` };
  db.classes = db.classes.filter(c => c.id !== classId);
  db.students.forEach(student => {
    if (classIdsOf(student).includes(classId)) syncStudentClassLabel(student, db);
  });
  saveDB();
  return { ok: true, code: cls.code };
}

export function addOrganization({ name, shortName, type = 'school', accessLevel = 'own' } = {}, actor = null) {
  if (!canManageOrganizations(actor)) return { ok: false, error: 'เฉพาะ Wich หรือหน่วยงานหลักที่มีสิทธิ์จัดการองค์กรเท่านั้นที่สร้างหน่วยงานได้' };
  const db = getDB();
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
  const short = normalizeOrgShort(shortName);
  if (cleanName.length < 2) return { ok: false, error: 'กรุณากรอกชื่อหน่วยงานหรือโรงเรียน' };
  if (db.organizations.some(o => normalizeLoginText(o.name) === normalizeLoginText(cleanName))) {
    return { ok: false, error: 'มีชื่อหน่วยงานนี้อยู่แล้ว' };
  }
  if (short.length < 2) return { ok: false, error: 'ชื่อย่อต้องมีอย่างน้อย 2 ตัวอักษร (A–Z หรือ 0–9)' };
  if (db.organizations.some(o => normalizeOrgShort(o.shortName) === short)) {
    return { ok: false, error: 'ชื่อย่อนี้ถูกใช้งานแล้ว' };
  }
  const org = {
    id: uid('org'),
    name: cleanName,
    shortName: short,
    type: type === 'agency' ? 'agency' : 'school',
    accessLevel: ['view_all', 'manage_all'].includes(accessLevel) ? accessLevel : 'own',
    hiddenFromGlobal: false,
    createdBy: actor.teacherId,
    createdAt: new Date().toISOString()
  };
  db.organizations.push(org);
  saveDB();
  return { ok: true, organization: org };
}

export function setOrganizationHidden(orgId, hidden, actor = null) {
  if (!isOwnerTeacher(actor)) return { ok: false, error: 'เฉพาะ Wich เท่านั้นที่กำหนดการมองเห็นหน่วยงานได้' };
  const db = getDB();
  const org = db.organizations.find(o => o.id === orgId);
  if (!org) return { ok: false, error: 'ไม่พบหน่วยงานนี้' };
  org.hiddenFromGlobal = Boolean(hidden);
  saveDB();
  return { ok: true, organization: org };
}

export function updateOrganization(orgId, { name, shortName, type, accessLevel } = {}, actor = null) {
  if (!canManageOrganizations(actor)) return { ok: false, error: 'เฉพาะ Wich หรือหน่วยงานหลักที่มีสิทธิ์จัดการองค์กรเท่านั้นที่แก้ไขหน่วยงานได้' };
  const db = getDB();
  const org = db.organizations.find(o => o.id === orgId);
  if (!org) return { ok: false, error: 'ไม่พบหน่วยงานนี้' };
  if (!canAccessOrganization(orgId, actor, db)) return { ok: false, error: 'คุณไม่มีสิทธิ์เข้าถึงหน่วยงานนี้' };
  const cleanName = String(name ?? org.name).trim().replace(/\s+/g, ' ');
  const short = normalizeOrgShort(shortName ?? org.shortName);
  if (cleanName.length < 2) return { ok: false, error: 'กรุณากรอกชื่อหน่วยงานหรือโรงเรียน' };
  if (db.organizations.some(o => o.id !== orgId && normalizeLoginText(o.name) === normalizeLoginText(cleanName))) {
    return { ok: false, error: 'มีชื่อหน่วยงานนี้อยู่แล้ว' };
  }
  if (short.length < 2) return { ok: false, error: 'ชื่อย่อต้องมีอย่างน้อย 2 ตัวอักษร (A–Z หรือ 0–9)' };
  if (db.organizations.some(o => o.id !== orgId && normalizeOrgShort(o.shortName) === short)) {
    return { ok: false, error: 'ชื่อย่อนี้ถูกใช้งานแล้ว' };
  }
  const nextAccess = accessLevel === undefined
    ? organizationAccessLevel(org)
    : (['view_all', 'manage_all'].includes(accessLevel) ? accessLevel : 'own');
  const me = currentTeacher(actor);
  if (!isOwnerTeacher(actor) && me?.orgId === org.id && nextAccess !== organizationAccessLevel(org)) {
    return { ok: false, error: 'ไม่สามารถเปลี่ยนสิทธิ์การมองเห็นของหน่วยงานที่คุณสังกัดเองได้ กรุณาให้ Wich เปลี่ยนให้' };
  }
  org.name = cleanName;
  org.shortName = short;
  org.type = type === 'agency' ? 'agency' : type === 'school' ? 'school' : org.type;
  org.accessLevel = nextAccess;
  db.teachers.forEach(t => {
    if (t.orgId === orgId) t.school = org.name;
  });
  db.exams.forEach(exam => {
    const teacher = db.teachers.find(t => t.id === exam.teacherId);
    if (teacher?.orgId === orgId) exam.teacherSchool = org.name;
  });
  saveDB();
  return { ok: true, organization: org };
}

export function deleteOrganization(orgId, actor = null) {
  if (!canManageOrganizations(actor)) return { ok: false, error: 'เฉพาะ Wich หรือหน่วยงานหลักที่มีสิทธิ์จัดการองค์กรเท่านั้นที่ลบหน่วยงานได้' };
  const db = getDB();
  const org = db.organizations.find(o => o.id === orgId);
  if (!org) return { ok: false, error: 'ไม่พบหน่วยงานนี้' };
  if (!canAccessOrganization(orgId, actor, db)) return { ok: false, error: 'คุณไม่มีสิทธิ์เข้าถึงหน่วยงานนี้' };
  if (db.organizations.length <= 1) return { ok: false, error: 'ต้องมีหน่วยงานอย่างน้อย 1 แห่งในระบบ' };
  const me = currentTeacher(actor);
  if (!isOwnerTeacher(actor) && me?.orgId === orgId) {
    return { ok: false, error: 'ไม่สามารถลบหน่วยงานที่คุณสังกัดเองได้' };
  }
  const owner = db.teachers.find(t => t.isOwner && !t.deletedAt);
  if (owner?.orgId === orgId) {
    return { ok: false, error: 'ลบหน่วยงานที่ Wich สังกัดอยู่ไม่ได้ กรุณาย้าย Wich ไปหน่วยงานอื่นก่อน' };
  }
  const teachers = db.teachers.filter(t => t.orgId === orgId);
  const classes = db.classes.filter(c => c.orgId === orgId);
  const students = db.students.filter(st => st.orgId === orgId);
  const exams = db.exams.filter(exam => examOrganizationIds(exam, db).includes(orgId));
  const teacherIds = new Set(teachers.map(t => t.id));
  const studentIds = new Set(students.map(st => st.id));
  const removedExamIds = new Set();
  const attempts = db.attempts.filter(a => exams.some(exam => exam.id === a.examId) || studentIds.has(a.studentId));
  if (teachers.some(t => t.isOwner)) {
    return { ok: false, error: 'หน่วยงานนี้มีบัญชีเจ้าของระบบอยู่ ไม่สามารถลบได้' };
  }
  db.organizations = db.organizations.filter(o => o.id !== orgId);
  db.teachers = db.teachers.filter(t => t.orgId !== orgId);
  db.classes = db.classes.filter(c => c.orgId !== orgId);
  db.students = db.students.filter(st => st.orgId !== orgId);
  db.exams = db.exams.flatMap(exam => {
    const ids = examOrganizationIds(exam, db);
    if (!ids.includes(orgId)) return [exam];
    const nextIds = ids.filter(id => id !== orgId);
    if (!nextIds.length) {
      removedExamIds.add(exam.id);
      return [];
    }
    exam.orgIds = nextIds;
    exam.orgId = nextIds[0];
    exam.assignedStudentIds = (exam.assignedStudentIds || []).filter(id => !studentIds.has(id));
    return [exam];
  });
  db.attempts = db.attempts.filter(a => !removedExamIds.has(a.examId) && !studentIds.has(a.studentId));
  db.notices = (db.notices || []).filter(notice => {
    const [kind, id] = String(notice.target || '').split(':');
    if (kind === 'student' && (id === 'all' || !studentIds.has(id))) return true;
    if (kind === 'teacher') return !teacherIds.has(id);
    if (kind === 'exam') return !removedExamIds.has(id);
    return true;
  });
  if (db.noticeReads && typeof db.noticeReads === 'object') {
    studentIds.forEach(id => { delete db.noticeReads[id]; });
  }
  saveDB();
  return {
    ok: true,
    organization: org,
    removed: {
      teachers: teachers.length,
      classes: classes.length,
      students: students.length,
      exams: removedExamIds.size,
      attempts: attempts.length
    }
  };
}

export function setTeacherPassword(teacherId, nextPassword, actor = null) {
  const db = getDB();
  const teacher = db.teachers.find(t => t.id === teacherId);
  if (!teacher) return { ok: false, error: 'ไม่พบบัญชีครู' };
  const allowed = isOwnerTeacher(actor) || (actor?.role === 'teacher' && actor.teacherId === teacherId);
  if (!allowed) return { ok: false, error: 'คุณไม่มีสิทธิ์เปลี่ยนรหัสผ่านของบัญชีนี้' };
  const password = String(nextPassword || '');
  if (password.length < 4) return { ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' };
  teacher.password = password;
  saveDB();
  return { ok: true, teacher };
}

export function setTeacherRole(teacherId, nextRole, actor = null) {
  if (!isOwnerTeacher(actor)) return { ok: false, error: 'เฉพาะ Wich Pitchon เท่านั้นที่เปลี่ยนตำแหน่งได้' };
  const db = getDB();
  const teacher = db.teachers.find(t => t.id === teacherId && !t.deletedAt);
  if (!teacher) return { ok: false, error: 'ไม่พบบัญชีครู' };
  const role = nextRole === 'manager' ? 'manager' : 'teacher';
  teacher.staffRole = role;
  teacher.roleLabel = nextRole === 'owner' && teacher.isOwner ? 'ผู้สร้างระบบ' : role === 'manager' ? 'ผู้จัดการ' : 'ครูผู้สอน';
  saveDB();
  return { ok: true, teacher };
}

export function setTeacherCode(teacherId, nextCode, actor = null) {
  const db = getDB();
  const teacher = db.teachers.find(t => t.id === teacherId && !t.deletedAt);
  if (!teacher) return { ok: false, error: 'ไม่พบบัญชีครู' };
  if (teacher.isOwner) return { ok: false, error: 'รหัสของ Wich Pitchon ถูกป้องกันและแก้ไขไม่ได้' };
  const me = currentTeacher(actor);
  const allowed = isOwnerTeacher(actor) || canManageOrganizations(actor)
    || Boolean(me && me.id === teacher.id);
  if (!allowed) return { ok: false, error: 'คุณไม่มีสิทธิ์แก้รหัสครูบัญชีนี้' };
  const code = String(nextCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9._-]{3,24}$/.test(code)) {
    return { ok: false, error: 'รหัสครูต้องมี 3–24 ตัว ใช้ A–Z, 0–9, จุด, ขีดกลาง หรือขีดล่าง' };
  }
  const duplicate = db.teachers.find(t => t.id !== teacher.id && !t.deletedAt && normalizeLoginText(t.code) === normalizeLoginText(code));
  if (duplicate) return { ok: false, error: 'รหัสครูนี้ถูกใช้งานแล้ว' };
  teacher.code = code;
  const saved = getSession();
  if (saved?.role === 'teacher' && saved.teacherId === teacher.id) {
    setSession({ ...saved, teacherCode: code });
  }
  saveDB();
  return { ok: true, teacher };
}

export function setStudentCode(studentId, nextCode, actor = null) {
  const db = getDB();
  const student = db.students.find(st => st.id === studentId);
  if (!student) return { ok: false, error: 'ไม่พบบัญชีนักเรียน' };
  const me = currentTeacher(actor);
  const allowed = isOwnerTeacher(actor) || canManageOrganizations(actor)
    || Boolean(me && isManagerStaff(actor) && me.orgId === student.orgId);
  if (!allowed) return { ok: false, error: 'คุณไม่มีสิทธิ์แก้รหัสนักเรียนคนนี้' };
  const code = String(nextCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9._-]{3,20}$/.test(code)) {
    return { ok: false, error: 'รหัสนักเรียนต้องมี 3–20 ตัว ใช้ A–Z, 0–9, จุด, ขีดกลาง หรือขีดล่าง' };
  }
  const duplicate = db.students.find(st => st.id !== student.id && normalizeLoginText(st.code) === normalizeLoginText(code));
  if (duplicate) return { ok: false, error: 'รหัสนักเรียนนี้ถูกใช้งานแล้ว' };
  student.code = code;
  db.attempts.forEach(a => {
    if (a.studentId === student.id) a.studentCode = code;
  });
  saveDB();
  return { ok: true, student };
}

export function setStudentPassword(studentId, nextPassword, actor = null) {
  const db = getDB();
  const student = db.students.find(s => s.id === studentId);
  if (!student) return { ok: false, error: 'ไม่พบบัญชีนักเรียน' };
  const me = currentTeacher(actor);
  const canManageAcrossOrganizations = isOwnerTeacher(actor)
    || (isManagerStaff(actor) && canManageOrganizations(actor));
  const allowed = (actor?.role === 'student' && actor.studentId === studentId)
    || canManageAcrossOrganizations
    || Boolean(me && me.orgId === student.orgId);
  if (!allowed) return { ok: false, error: 'คุณไม่มีสิทธิ์เปลี่ยนรหัสผ่านของนักเรียนคนนี้' };
  const password = String(nextPassword || '');
  if (password.length < 4) return { ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' };
  student.password = password;
  saveDB();
  return { ok: true, student };
}

export function updateStudentOrg(studentId, nextOrgId, actor = null) {
  if (!isOwnerTeacher(actor) && !canManageOrganizations(actor)) return { ok: false, error: 'เฉพาะ Wich หรือหน่วยงานหลักเท่านั้นที่ย้ายหน่วยงานนักเรียนได้' };
  const db = getDB();
  const student = db.students.find(s => s.id === studentId);
  if (!student) return { ok: false, error: 'ไม่พบนักเรียน' };
  const org = findOrganization(nextOrgId, db);
  if (!org) return { ok: false, error: 'ไม่พบหน่วยงานปลายทาง' };
  const current = classIdsOf(student).filter(id => db.classes.some(cls => cls.id === id && cls.orgId === org.id));
  const classes = current.length ? current : db.classes.filter(cls => cls.orgId === org.id).slice(0, 1).map(cls => cls.id);
  if (!classes.length) return { ok: false, error: 'หน่วยงานปลายทางยังไม่มี class กรุณาสร้าง class ก่อน' };
  student.orgId = org.id;
  student.classIds = classes;
  syncStudentClassLabel(student, db);
  saveDB();
  return { ok: true, student, organization: org };
}

export function setStudentClasses(studentId, nextClassIds = []) {
  const db = getDB();
  const student = db.students.find(s => s.id === studentId);
  if (!student) return { ok: false, error: 'ไม่พบรายชื่อนักเรียน' };
  const ids = [...new Set(Array.isArray(nextClassIds) ? nextClassIds : [nextClassIds])]
    .filter(id => db.classes.some(cls => cls.id === id && cls.orgId === student.orgId));
  if (!ids.length) return { ok: false, error: 'กรุณาเลือก class ในหน่วยงานของนักเรียนอย่างน้อย 1 class' };
  student.classIds = ids;
  syncStudentClassLabel(student, db);
  saveDB();
  return {
    ok: true,
    student,
    classes: ids.map(id => db.classes.find(cls => cls.id === id)).filter(Boolean)
  };
}

export function removeStudent(studentId, actor = null) {
  if (!isOwnerTeacher(actor) && !canManageOrganizations(actor)) return { ok: false, error: 'เฉพาะ Wich หรือหน่วยงานหลักเท่านั้นที่ลบรายชื่อนักเรียนได้' };
  const db = getDB();
  const student = db.students.find(s => s.id === studentId);
  if (!student) return { ok: false, error: 'ไม่พบรายชื่อนักเรียน' };
  const attempts = db.attempts.filter(a => a.studentId === studentId).length;
  db.students = db.students.filter(s => s.id !== studentId);
  db.attempts = db.attempts.filter(a => a.studentId !== studentId);
  db.notices = (db.notices || []).filter(n => n.target !== `student:${studentId}`);
  saveDB();
  return { ok: true, name: student.name, attempts };
}

export function currentStudentKey(session) {
  return session?.studentId || session?.guestId || null;
}

export function findStudentAttempt(examId, session) {
  const key = currentStudentKey(session);
  if (!key) return null;
  return getDB().attempts.find(a => a.examId === examId && a.studentId === key) || null;
}

export function getStudentAttempts(session) {
  const key = currentStudentKey(session);
  if (!key) return [];
  return getDB().attempts
    .filter(a => a.studentId === key)
    .sort((a, b) => new Date(b.submittedAt || b.startedAt) - new Date(a.submittedAt || a.startedAt));
}

export function getExamAttempts(examId) {
  return getDB().attempts.filter(a => a.examId === examId);
}

export function getAnswerValue(attempt, questionId) {
  return attempt?.answers?.[questionId]?.value ?? '';
}

export function isAnswered(attempt, questionId) {
  return !answerIsEmpty(getAnswerValue(attempt, questionId));
}

export function countAnswered(exam, attempt) {
  return exam.questions.filter(q => isAnswered(attempt, q.id)).length;
}

export function isObjective(type) {
  return type === 'mcq' || type === 'truefalse' || type === 'short';
}

export function isCorrect(question, value) {
  if (answerIsEmpty(value)) return false;
  if (question.type === 'mcq' || question.type === 'truefalse') {
    return String(value) === String(question.correct);
  }
  if (question.type === 'short') {
    const accepted = [question.correct, ...(question.acceptedAnswers || [])].filter(Boolean);
    return accepted.some(answer => normalize(answer) === normalize(value));
  }
  return false;
}

export function answerText(question, value) {
  if (answerIsEmpty(value)) return 'ไม่ได้ตอบ';
  if (question.type === 'mcq') {
    const option = question.options.find(o => o.id === String(value));
    return option ? `${option.id}. ${option.text}` : String(value);
  }
  if (question.type === 'truefalse') {
    return String(value) === 'true' ? 'ถูก' : 'ผิด';
  }
  return String(value);
}

export function correctAnswerText(question) {
  if (question.type === 'mcq') {
    const option = question.options.find(o => o.id === String(question.correct));
    return option ? `${option.id}. ${option.text}` : question.correct;
  }
  if (question.type === 'truefalse') {
    return String(question.correct) === 'true' ? 'ถูก' : 'ผิด';
  }
  if (question.type === 'short') return question.acceptedAnswers?.[0] || question.correct || '—';
  return question.reference || '—';
}

export function needsManualReview(question, attempt) {
  if (!question || !attempt) return false;
  if (attempt.manualScores?.[question.id] !== undefined) return false;
  if (question.type === 'essay') return true;
  if (question.type === 'short') {
    const value = getAnswerValue(attempt, question.id);
    // Exact accepted answers are checked automatically. A misspelled free-text
    // answer is not thrown away; it goes to the teacher for a final decision.
    return !answerIsEmpty(value) && !isCorrect(question, value);
  }
  return false;
}

export function pendingReviewQuestions(exam, attempt) {
  return exam.questions.filter(q => needsManualReview(q, attempt));
}

// Kept as an alias for older callers. It now includes short answers that need
// a teacher's judgement as well as essays.
export const pendingEssayQuestions = pendingReviewQuestions;

export function attemptScore(exam, attempt) {
  if (!attempt) {
    return { auto: 0, manual: 0, total: 0, max: exam?.totalPoints || 0, percent: 0, pending: exam?.questions?.filter(q => q.type === 'essay') || [], fullyGraded: false, overridden: false };
  }
  let auto = 0;
  let manual = 0;
  exam.questions.forEach(q => {
    const value = getAnswerValue(attempt, q.id);
    if (q.type === 'short') {
      if (isCorrect(q, value)) {
        auto += Number(q.points) || 0;
      } else {
        const entry = attempt.manualScores?.[q.id];
        if (entry && Number.isFinite(Number(entry.score))) manual += Number(entry.score);
      }
    } else if (isObjective(q.type)) {
      if (isCorrect(q, value)) auto += Number(q.points) || 0;
    } else if (q.type === 'essay') {
      const entry = attempt.manualScores?.[q.id];
      if (entry && Number.isFinite(Number(entry.score))) manual += Number(entry.score);
    }
  });
  const pending = pendingReviewQuestions(exam, attempt);
  const calculated = auto + manual;
  const overridden = Number.isFinite(Number(attempt.overrideScore));
  const total = overridden ? Number(attempt.overrideScore) : calculated;
  return {
    auto,
    manual,
    total,
    calculated,
    max: exam.totalPoints,
    percent: exam.totalPoints ? Math.round((total / exam.totalPoints) * 100) : 0,
    pending,
    fullyGraded: pending.length === 0,
    overridden
  };
}

export function attemptStatusMeta(exam, attempt) {
  if (!attempt) return { key: 'not_started', label: 'ยังไม่เริ่ม', tone: 'neutral' };
  if (attempt.status === 'in_progress') {
    const remaining = new Date(attempt.endsAt).getTime() - Date.now();
    if (remaining <= 0) return { key: 'submitted', label: 'ส่งแล้ว', tone: 'success' };
    return { key: 'in_progress', label: 'กำลังทำ', tone: 'warning' };
  }
  const score = attemptScore(exam, attempt);
  if (score.pending.length > 0) return { key: 'submitted', label: 'รอตรวจ', tone: 'info' };
  return { key: 'graded', label: 'ตรวจแล้ว', tone: 'success' };
}

export function assignedStudentCount(exam) {
  return Array.isArray(exam?.assignedStudentIds) ? exam.assignedStudentIds.length : getDB().students.length;
}

export function isStudentAssigned(exam, session) {
  if (!exam || !session || session.role !== 'student') return false;
  if (!Array.isArray(exam.assignedStudentIds)) return true;
  const key = currentStudentKey(session);
  return Boolean(key && exam.assignedStudentIds.includes(key));
}

export function participantRows(exam) {
  const db = getDB();
  const examAttempts = db.attempts.filter(a => a.examId === exam.id);
  const byStudent = new Map(examAttempts.map(a => [a.studentId, a]));
  const assigned = Array.isArray(exam.assignedStudentIds) ? new Set(exam.assignedStudentIds) : null;
  const eligible = assigned ? db.students.filter(s => assigned.has(s.id)) : db.students;
  const rows = eligible.map((student, idx) => ({
    student,
    attempt: byStudent.get(student.id) || null,
    index: idx
  }));
  examAttempts.forEach(a => {
    if (rows.some(row => row.student.id === a.studentId)) return;
    const existing = db.students.find(s => s.id === a.studentId);
    rows.push({
      student: existing || {
        id: a.studentId,
        name: a.studentName,
        code: a.studentCode || 'ผู้เข้าสอบภายนอก',
        class: a.studentClass || 'รหัสเข้าสอบ'
      },
      attempt: a,
      index: rows.length
    });
  });
  return rows;
}

export function examMetrics(exam) {
  const rows = participantRows(exam);
  const submitted = rows.filter(r => r.attempt && r.attempt.status !== 'in_progress');
  const inProgress = rows.filter(r => r.attempt?.status === 'in_progress');
  const scores = submitted.map(r => attemptScore(exam, r.attempt));
  const totalScores = scores.map(s => s.total);
  const average = scores.length ? totalScores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const passed = scores.filter(s => s.percent >= exam.passPercent).length;
  const needsReview = r => !r.attempt.reviewed || pendingEssayQuestions(exam, r.attempt).length > 0;
  const pendingReview = submitted.filter(needsReview).length;
  const unreviewed = submitted.filter(needsReview);
  const averagePercent = scores.length ? Math.round(scores.reduce((a, s) => a + s.percent, 0) / scores.length) : 0;
  const highest = scores.length ? Math.max(...scores.map(s => s.total)) : 0;
  const lowest = scores.length ? Math.min(...scores.map(s => s.total)) : 0;
  return {
    rows,
    total: rows.length,
    submitted: submitted.length,
    inProgress: inProgress.length,
    notStarted: rows.filter(r => !r.attempt).length,
    graded: submitted.filter(r => attemptStatusMeta(exam, r.attempt).key === 'graded').length,
    pendingReview,
    unreviewed,
    average,
    averagePercent,
    highest,
    lowest,
    passed,
    passRate: scores.length ? Math.round((passed / scores.length) * 100) : 0,
    scores
  };
}

export function dashedCode(code) {
  return String(code || '').replace(/(\d{3})(\d{3})/, '$1 $2');
}

export function activeExams() {
  return getDB().exams.filter(e => e.status === 'open');
}

export function totalPendingReview(session = null) {
  const db = getDB();
  return db.attempts.filter(a => {
    const exam = db.exams.find(e => e.id === a.examId);
    if (!exam || a.status === 'in_progress') return false;
    if (session && !canReviewExam(exam, session)) return false;
    return !a.reviewed || pendingEssayQuestions(exam, a).length > 0;
  }).length;
}

export function getNotifications(session) {
  const db = getDB();
  const all = [];
  if (!session) return all;
  if (session.role === 'teacher') {
    const teacherKey = `teacher:${session.teacherId}`;
    const readIds = new Set(db.noticeReads?.[teacherKey] || []);
    (db.notices || [])
      .filter(n => n.target === teacherKey && !readIds.has(n.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach(n => all.push({ ...n, href: n.href || '#/teacher/review' }));
    const recent = db.attempts
      .filter(a => {
        if (a.status === 'in_progress' || a.reviewed) return false;
        const exam = db.exams.find(e => e.id === a.examId);
        return exam && canReviewExam(exam, session);
      })
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 5);
    recent.forEach(a => {
      const exam = db.exams.find(e => e.id === a.examId);
      all.push({
        id: `sub-${a.id}`,
        title: `${a.studentName} ส่งคำตอบแล้ว`,
        body: `${exam?.title || 'ชุดสอบ'} · ${a.submittedAt ? new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(a.submittedAt)) : ''} น.`,
        kind: 'submission',
        href: `#/teacher/exam/${a.examId}/answer/${a.id}`,
        createdAt: a.submittedAt
      });
    });
  } else {
    const studentKey = currentStudentKey(session);
    const readIds = new Set(db.noticeReads?.[studentKey] || []);
    db.notices
      .filter(n => (n.target === `student:${studentKey}` || n.target === 'student:all') && !readIds.has(n.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach(n => all.push({ ...n, href: n.href || '#/student' }));
    getStudentAttempts(session).forEach(a => {
      const exam = db.exams.find(e => e.id === a.examId);
      if (exam?.status === 'announced' && exam.publishedAt) {
        const noticeId = `pub-${exam.id}`;
        if (readIds.has(noticeId)) return;
        all.push({
          id: noticeId,
          title: 'ประกาศผลสอบแล้ว',
          body: `ผลสอบ ${exam.title} พร้อมให้ตรวจดูแล้ว`,
          kind: 'result',
          href: `#/student/exam/${exam.id}/result`,
          createdAt: exam.publishedAt
        });
      }
    });
  }
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
}

export function markNoticeRead(session, noticeId) {
  if (!session || !noticeId) return;
  const db = getDB();
  const key = session.role === 'teacher'
    ? (session.teacherId ? `teacher:${session.teacherId}` : '')
    : currentStudentKey(session);
  if (!key) return;
  if (!db.noticeReads || typeof db.noticeReads !== 'object') db.noticeReads = {};
  const reads = Array.isArray(db.noticeReads[key]) ? db.noticeReads[key] : [];
  if (reads.includes(noticeId)) return;
  db.noticeReads[key] = [...reads, noticeId].slice(-200);
  saveDB();
}

export function addNotice(notice) {
  const db = getDB();
  db.notices.unshift({
    id: uid('notice'),
    createdAt: new Date().toISOString(),
    read: false,
    ...notice
  });
  saveDB();
}

export function sweepExpiredAttempts() {
  const db = getDB();
  let changed = 0;
  const stamp = new Date().toISOString();
  db.attempts.forEach(a => {
    if (a.status === 'in_progress' && new Date(a.endsAt).getTime() <= Date.now()) {
      a.status = 'submitted';
      a.submittedAt = stamp;
      a.autoSubmitted = true;
      a.reviewed = false;
      a.timeUsedSec = Math.round((new Date(a.endsAt) - new Date(a.startedAt)) / 1000);
      changed += 1;
    }
  });
  if (changed) saveDB();
  return changed;
}

export function submitAttempt(attempt, { auto = false, forced = false } = {}) {
  const stamp = new Date().toISOString();
  attempt.status = 'submitted';
  attempt.submittedAt = stamp;
  attempt.autoSubmitted = Boolean(auto);
  attempt.forced = Boolean(forced);
  attempt.reviewed = false;
  attempt.timeUsedSec = Math.max(0, Math.round((new Date(stamp) - new Date(attempt.startedAt)) / 1000));
  saveDB();
  return attempt;
}

export function startAttempt(exam, session) {
  const db = getDB();
  const key = currentStudentKey(session);
  const existing = db.attempts.find(a => a.examId === exam.id && a.studentId === key);
  if (existing) {
    if (!isStudentAssigned(exam, session)) return null;
    return existing;
  }
  const now = Date.now();
  if (!isStudentAssigned(exam, session)) return null;
  if (exam.status !== 'open' || (exam.openAt && now < new Date(exam.openAt).getTime()) || (exam.closeAt && now > new Date(exam.closeAt).getTime())) return null;
  const start = new Date();
  const currentStudent = db.students.find(s => s.id === key);
  const attempt = {
    id: uid('att'),
    examId: exam.id,
    studentId: key,
    studentName: session.name,
    studentCode: session.studentCode || 'ผู้เข้าสอบด้วยรหัส',
    studentClass: currentStudent ? studentClassLabel(currentStudent, db) : (session.class || 'ห้องสอบออนไลน์'),
    status: 'in_progress',
    startedAt: start.toISOString(),
    endsAt: new Date(start.getTime() + exam.duration * MIN).toISOString(),
    submittedAt: null,
    answers: {},
    manualScores: {},
    reviewed: false,
    antiCheat: [],
    lastQuestion: 0,
    autoSubmitted: false
  };
  db.attempts.push(attempt);
  saveDB();
  return attempt;
}

export function logAntiCheat(attempt, type, label) {
  if (!attempt) return;
  if (!Array.isArray(attempt.antiCheat)) attempt.antiCheat = [];
  attempt.antiCheat.push({ type, label, at: new Date().toISOString() });
  saveDB();
}

export function rankAttempts(exam) {
  const rows = participantRows(exam).filter(r => r.attempt && r.attempt.status !== 'in_progress');
  return rows
    .map(r => ({
      student: r.student,
      attempt: r.attempt,
      score: attemptScore(exam, r.attempt)
    }))
    .sort((a, b) => b.score.total - a.score.total || new Date(a.attempt.submittedAt) - new Date(b.attempt.submittedAt));
}

export function questionStats(exam) {
  const db = getDB();
  const submissions = db.attempts.filter(a => a.examId === exam.id && a.status !== 'in_progress');
  return exam.questions.map((q, index) => {
    if (q.type === 'essay') {
      const graded = submissions.filter(a => a.manualScores?.[q.id]);
      const avg = graded.length
        ? graded.reduce((sum, a) => sum + Number(a.manualScores[q.id].score), 0) / graded.length
        : 0;
      return {
        q, index, type: 'essay',
        answered: submissions.filter(a => !answerIsEmpty(a.answers?.[q.id]?.value)).length,
        total: submissions.length,
        correct: graded.filter(a => Number(a.manualScores[q.id].score) >= q.points * 0.6).length,
        correctPercent: graded.length ? Math.round((graded.filter(a => Number(a.manualScores[q.id].score) >= q.points * 0.6).length / graded.length) * 100) : 0,
        average: avg,
        graded: graded.length
      };
    }
    const answered = submissions.filter(a => !answerIsEmpty(a.answers?.[q.id]?.value));
    const correct = answered.filter(a => isCorrect(q, a.answers[q.id].value));
    return {
      q, index, type: q.type,
      answered: answered.length,
      total: submissions.length,
      correct: correct.length,
      correctPercent: answered.length ? Math.round((correct.length / answered.length) * 100) : 0,
      average: answered.length ? (correct.length / answered.length) * q.points : 0,
      graded: answered.length
    };
  });
}

export function scoreDistribution(exam) {
  const scores = participantRows(exam)
    .filter(r => r.attempt && r.attempt.status !== 'in_progress')
    .map(r => attemptScore(exam, r.attempt).percent);
  const bins = [
    { label: '0–39%', min: 0, max: 39, count: 0 },
    { label: '40–59%', min: 40, max: 59, count: 0 },
    { label: '60–79%', min: 60, max: 79, count: 0 },
    { label: '80–100%', min: 80, max: 100, count: 0 }
  ];
  scores.forEach(s => {
    const bin = bins.find(b => s >= b.min && s <= b.max) || bins[0];
    bin.count += 1;
  });
  return bins;
}
