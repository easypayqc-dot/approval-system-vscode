'use strict';

const sheets = require('../integrations/googleSheetsClient');
const {
  SHEETS,
  EMPLOYEES,
  RATES,
  EMPLOYEE_STATUS_DEFAULT,
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYEE_STATUS_HEADERS,
  ATTENDANCE_HEADERS
} = require('../config/constants');
const { clean, dateKey, dateTime, parseDate } = require('../utils/format');
const { initEmployeeMap, getKpiLevel } = require('./commissionService');

function buildEmployeeSummary(records, statusMap = {}) {
  const summary = initEmployeeMap();
  records.forEach((r) => {
    if (r.loanApproval && summary.has(r.loanApproval)) summary.get(r.loanApproval).loan += 1;
    if (r.docApproval && summary.has(r.docApproval)) summary.get(r.docApproval).doc += 1;
    if (r.closeApproval && summary.has(r.closeApproval)) summary.get(r.closeApproval).close += 1;
  });
  return Array.from(summary.entries()).map(([employee, s]) => {
    const total = s.loan + s.doc + s.close;
    const amount = s.loan * RATES.loan + s.doc * RATES.doc + s.close * RATES.close;
    return { employee, status: statusMap[employee] || EMPLOYEE_STATUS_DEFAULT, loan: s.loan, doc: s.doc, close: s.close, total, amount, kpi: getKpiLevel(total) };
  }).sort((a, b) => b.total - a.total);
}

async function ensureEmployeeStatusHeaders() {
  const values = await sheets.getValues(SHEETS.EMPLOYEE_STATUS, 'A1:C1');
  const current = values[0] || [];
  const needsUpdate = EMPLOYEE_STATUS_HEADERS.some((header, index) => clean(current[index]) !== header);
  if (needsUpdate) await sheets.updateValues(SHEETS.EMPLOYEE_STATUS, 'A1:C1', [EMPLOYEE_STATUS_HEADERS]);
}

async function ensureAttendanceHeaders() {
  const values = await sheets.getValues(SHEETS.ATTENDANCE, 'A1:E1');
  const current = values[0] || [];
  const needsUpdate = ATTENDANCE_HEADERS.some((header, index) => clean(current[index]) !== header);
  if (needsUpdate) await sheets.updateValues(SHEETS.ATTENDANCE, 'A1:E1', [ATTENDANCE_HEADERS]);
}

async function getEmployeeStatusMap() {
  await ensureEmployeeStatusHeaders();
  const values = await sheets.getValues(SHEETS.EMPLOYEE_STATUS, 'A:C');
  const map = {};
  EMPLOYEES.forEach((name) => { map[name] = EMPLOYEE_STATUS_DEFAULT; });
  values.slice(1).forEach((row) => {
    const name = clean(row[0]);
    const status = clean(row[1]);
    if (name && EMPLOYEE_STATUS_OPTIONS.includes(status)) map[name] = status;
  });
  return map;
}

async function setupDefaultEmployeeStatusRows() {
  await ensureEmployeeStatusHeaders();
  const values = await sheets.getValues(SHEETS.EMPLOYEE_STATUS, 'A:C');
  const existing = new Set(values.slice(1).map((row) => clean(row[0])).filter(Boolean));
  const now = dateTime(new Date());
  const rows = EMPLOYEES.filter((name) => !existing.has(name)).map((name) => [name, EMPLOYEE_STATUS_DEFAULT, now]);
  if (rows.length) await sheets.appendValues(SHEETS.EMPLOYEE_STATUS, rows);
  return { inserted: rows.length };
}

async function setEmployeeStatus(employee, status) {
  await ensureEmployeeStatusHeaders();
  const name = clean(employee);
  const nextStatus = clean(status) || EMPLOYEE_STATUS_DEFAULT;
  if (!EMPLOYEES.includes(name)) throw new Error('ไม่พบรายชื่อพนักงาน');
  if (!EMPLOYEE_STATUS_OPTIONS.includes(nextStatus)) throw new Error('สถานะไม่ถูกต้อง');
  const values = await sheets.getValues(SHEETS.EMPLOYEE_STATUS, 'A:C');
  const now = dateTime(new Date());
  const index = values.slice(1).findIndex((row) => clean(row[0]) === name);
  if (index > -1) {
    const rowNo = index + 2;
    await sheets.updateValues(SHEETS.EMPLOYEE_STATUS, `A${rowNo}:C${rowNo}`, [[name, nextStatus, now]]);
    return { employee: name, status: nextStatus, row: rowNo, updated: true };
  }
  const result = await sheets.appendValues(SHEETS.EMPLOYEE_STATUS, [[name, nextStatus, now]]);
  return { employee: name, status: nextStatus, row: result.startRow || null, updated: false };
}

function normalizeDateKey(value) {
  if (!value) return dateKey(new Date());
  const parsed = parseDate(value);
  if (parsed) return dateKey(parsed);
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : dateKey(new Date());
}

function defaultAttendanceSummary(dateText) {
  const useDate = normalizeDateKey(dateText);
  const items = EMPLOYEES.map((employee) => ({ employee, date: useDate, status: EMPLOYEE_STATUS_DEFAULT, note: '', updatedAt: '' }));
  return { date: useDate, items, counts: countAttendance(items) };
}

function countAttendance(items) {
  const counts = { total: items.length, work: 0, stop: 0, leave: 0, sick: 0, off: 0 };
  items.forEach((x) => {
    if (x.status === 'ปฏิบัติงาน') counts.work += 1;
    else if (x.status === 'หยุด') counts.stop += 1;
    else if (x.status === 'ลา') counts.leave += 1;
    else if (x.status === 'ลาป่วย') counts.sick += 1;
  });
  counts.off = counts.stop + counts.leave + counts.sick;
  return counts;
}

async function getAttendanceSummary(dateText) {
  await ensureAttendanceHeaders();
  const useDate = normalizeDateKey(dateText);
  const values = await sheets.getValues(SHEETS.ATTENDANCE, 'A:E');
  const map = new Map();
  EMPLOYEES.forEach((employee) => map.set(employee, { employee, date: useDate, status: EMPLOYEE_STATUS_DEFAULT, note: '', updatedAt: '' }));
  values.slice(1).forEach((row) => {
    const rowDate = normalizeDateKey(row[0]);
    const name = clean(row[1]);
    const status = clean(row[2]);
    if (rowDate === useDate && map.has(name) && EMPLOYEE_STATUS_OPTIONS.includes(status)) {
      map.set(name, { employee: name, date: useDate, status, note: clean(row[3]), updatedAt: clean(row[4]) });
    }
  });
  const items = Array.from(map.values());
  return { date: useDate, items, counts: countAttendance(items) };
}

async function setDailyEmployeeAttendance({ employee, date, status, note }) {
  await ensureAttendanceHeaders();
  const name = clean(employee);
  const useDate = normalizeDateKey(date);
  const nextStatus = clean(status) || EMPLOYEE_STATUS_DEFAULT;
  const memo = clean(note);
  if (!EMPLOYEES.includes(name)) throw new Error('ไม่พบรายชื่อพนักงาน');
  if (!EMPLOYEE_STATUS_OPTIONS.includes(nextStatus)) throw new Error('สถานะไม่ถูกต้อง');
  const values = await sheets.getValues(SHEETS.ATTENDANCE, 'A:E');
  const now = dateTime(new Date());
  const index = values.slice(1).findIndex((row) => normalizeDateKey(row[0]) === useDate && clean(row[1]) === name);
  const row = [useDate, name, nextStatus, memo, now];
  if (index > -1) {
    const rowNo = index + 2;
    await sheets.updateValues(SHEETS.ATTENDANCE, `A${rowNo}:E${rowNo}`, [row]);
  } else {
    await sheets.appendValues(SHEETS.ATTENDANCE, [row]);
  }
  return { attendanceSummary: await getAttendanceSummary(useDate) };
}

module.exports = {
  buildEmployeeSummary,
  defaultAttendanceSummary,
  getEmployeeStatusMap,
  setupDefaultEmployeeStatusRows,
  setEmployeeStatus,
  getAttendanceSummary,
  setDailyEmployeeAttendance,
  EMPLOYEES,
  EMPLOYEE_STATUS_OPTIONS
};
