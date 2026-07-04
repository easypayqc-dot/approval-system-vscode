'use strict';

const { SHEETS, HEADERS, EMPLOYEES, SLA_MINUTES } = require('../config/constants');
const sheets = require('../integrations/googleSheetsClient');
const { callAppsScript } = require('../integrations/appsScriptClient');
const { clean, parseDate, monthKey, thaiDate, dateKey } = require('../utils/format');

function getHeaderMap(headers) {
  const map = {};
  headers.forEach((h, i) => { if (clean(h)) map[clean(h)] = i; });
  return map;
}

function headerColumnLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

async function ensureMainHeaders() {
  const values = await sheets.getValues(SHEETS.MAIN, `A1:${headerColumnLetter(HEADERS.length - 1)}1`);
  const current = values[0] || [];
  const needsUpdate = HEADERS.some((header, index) => clean(current[index]) !== header);

  if (needsUpdate) {
    await sheets.updateValues(SHEETS.MAIN, `A1:${headerColumnLetter(HEADERS.length - 1)}1`, [HEADERS]);
  }
}

function getSystem(contractNo) {
  const t = clean(contractNo).toUpperCase();
  if (t.startsWith('CSR')) return 'CSR';
  if (t.startsWith('ECR')) return 'ECR';
  if (t.startsWith('MV')) return 'MV';
  if (t.startsWith('BN')) return 'BN';
  if (t.startsWith('KK')) return 'KK';
  return '';
}

function isDocRequiredSystem(contractNo) {
  const sys = getSystem(contractNo);
  return sys === 'MV' || sys === 'CSR';
}

function getCaseStatus(contractNo, loan, doc, close) {
  const sys = getSystem(contractNo);
  if (!sys) return '';

  if (sys === 'MV' || sys === 'CSR') {
    if (loan && doc && close) return 'เสร็จสมบูรณ์';
    if (loan) return 'อนุมัติ-รอปิดเคส';
    return '';
  }

  if (sys === 'BN' || sys === 'ECR' || sys === 'KK') {
    if (loan && close) return 'เสร็จสมบูรณ์';
    if (loan) return 'อนุมัติ-รอปิดเคส';
    return '';
  }

  return '';
}

function safeCell(row, map, header) {
  const index = map[header];
  if (index === undefined || index < 0) return '';
  return row[index] ?? '';
}

function recordFromRow(row, index, headers) {
  const map = getHeaderMap(headers);
  const contractNo = clean(safeCell(row, map, 'เลขสัญญา')).toUpperCase();
  if (!contractNo) return null;

  const date = parseDate(safeCell(row, map, 'วันที่'));
  const loan = clean(safeCell(row, map, 'อนุมัติใบสินเชื่อ'));
  const doc = clean(safeCell(row, map, 'อนุมัติเอกสาร'));
  const close = clean(safeCell(row, map, 'อนุมัติปิดเคส'));

  return {
    row: index + 2,
    date: date ? dateKey(date) : '',
    dateThai: date ? thaiDate(date) : '',
    month: date ? monthKey(date) : clean(safeCell(row, map, 'เดือน')),
    loanApproval: loan,
    docApproval: doc,
    closeApproval: close,
    shop: clean(safeCell(row, map, 'ร้านค้า')),
    province: clean(safeCell(row, map, 'จังหวัด')),
    contractNo,
    system: getSystem(contractNo),
    price: Number(String(safeCell(row, map, 'ราคาสินค้า') || 0).replace(/,/g, '')) || 0,
    note: clean(safeCell(row, map, 'หมายเหตุ')),
    caseStatus: clean(safeCell(row, map, 'สถานะเคส')) || getCaseStatus(contractNo, loan, doc, close),
    loanEvidence: clean(safeCell(row, map, 'หลักฐานใบสินเชื่อ')),
    docEvidence: clean(safeCell(row, map, 'หลักฐานเอกสาร')),
    closeEvidence: clean(safeCell(row, map, 'หลักฐานปิดเคส')),
    caseReceivedAt: clean(safeCell(row, map, 'เวลารับเคส')),
    loanCompletedAt: clean(safeCell(row, map, 'เวลาอนุมัติใบสินเชื่อ')),
    docCompletedAt: clean(safeCell(row, map, 'เวลาอนุมัติเอกสาร')),
    closeCompletedAt: clean(safeCell(row, map, 'เวลาปิดเคส')),
    slaMinutes: Number(safeCell(row, map, 'SLA นาที')) || SLA_MINUTES,
    slaStatus: clean(safeCell(row, map, 'ผล SLA')),
    tatMinutes: clean(safeCell(row, map, 'TAT นาที')),
    docRequired: isDocRequiredSystem(contractNo)
  };
}

async function getRecordsRaw() {
  await ensureMainHeaders();
  const values = await sheets.getValues(SHEETS.MAIN, `A:${headerColumnLetter(HEADERS.length - 1)}`);
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((row, i) => recordFromRow(row, i, headers)).filter(Boolean);
}

function mergeDataWithExisting(data = {}, existing = null) {
  return {
    date: clean(data.date) || existing?.date || '',
    loanApproval: clean(data.loanApproval) || existing?.loanApproval || '',
    docApproval: clean(data.docApproval),
    closeApproval: clean(data.closeApproval),
    shop: clean(data.shop) || existing?.shop || '',
    province: clean(data.province) || existing?.province || '',
    contractNo: clean(data.contractNo || existing?.contractNo).toUpperCase(),
    price: data.price !== undefined ? data.price : existing?.price || 0,
    note: clean(data.note) || existing?.note || '',
    loanEvidence: clean(data.loanEvidence) || existing?.loanEvidence || '',
    docEvidence: clean(data.docEvidence) || existing?.docEvidence || '',
    closeEvidence: clean(data.closeEvidence) || existing?.closeEvidence || '',
    caseReceivedAt: data.caseReceivedAt !== undefined ? clean(data.caseReceivedAt) : existing?.caseReceivedAt || '',
    loanCompletedAt: data.loanCompletedAt !== undefined ? clean(data.loanCompletedAt) : existing?.loanCompletedAt || '',
    docCompletedAt: data.docCompletedAt !== undefined ? clean(data.docCompletedAt) : existing?.docCompletedAt || '',
    closeCompletedAt: data.closeCompletedAt !== undefined ? clean(data.closeCompletedAt) : existing?.closeCompletedAt || '',
    slaMinutes: Number(data.slaMinutes || existing?.slaMinutes || SLA_MINUTES) || SLA_MINUTES,
    slaStatus: data.slaStatus !== undefined ? clean(data.slaStatus) : existing?.slaStatus || '',
    tatMinutes: data.tatMinutes !== undefined ? clean(data.tatMinutes) : existing?.tatMinutes || ''
  };
}

function validateSameApproverAndEvidence(data, existing = null) {
  const next = mergeDataWithExisting(data, existing);
  const loan = clean(next.loanApproval);
  const doc = clean(next.docApproval);
  const close = clean(next.closeApproval);
  const contractNo = clean(next.contractNo).toUpperCase();
  const docRequired = isDocRequiredSystem(contractNo);

  if (!clean(next.date)) throw new Error('กรุณากรอกวันที่');
  if (!contractNo) throw new Error('กรุณากรอกเลขสัญญา');
  if (!clean(next.shop)) throw new Error("กรุณากรอกร้านค้า");
  if (!loan) throw new Error("กรุณาเลือกอนุมัติใบสินเชื่อ");
  if (!(Number(String(next.price || 0).replace(/,/g, "")) > 0)) throw new Error("กรุณากรอกราคาสินค้า");

  if (!EMPLOYEES.includes(loan)) {
    throw new Error('รายชื่อผู้อนุมัติใบสินเชื่อไม่ถูกต้อง');
  }

  if (!clean(next.loanEvidence)) {
    throw new Error('กรุณาแนบหลักฐานใบสินเชื่อก่อนบันทึก');
  }

  if (doc) {
    if (doc !== loan) throw new Error('ผู้อนุมัติเอกสารต้องเป็นคนเดียวกับผู้อนุมัติใบสินเชื่อ');
    if (!clean(next.docEvidence)) throw new Error('กรุณาแนบหลักฐานอนุมัติเอกสารก่อนบันทึกขั้นตอนเอกสาร');
  }

  if (close) {
    if (close !== loan) throw new Error('ผู้อนุมัติปิดเคสต้องเป็นคนเดียวกับผู้อนุมัติใบสินเชื่อ');
    if (!clean(next.closeEvidence)) throw new Error('กรุณาแนบหลักฐานปิดเคสก่อนบันทึกขั้นตอนปิดเคส');
    if (docRequired && (!doc || !clean(next.docEvidence))) {
      throw new Error('ระบบ MV/CSR ต้องอนุมัติเอกสารและแนบหลักฐานเอกสารก่อนปิดเคส');
    }
  }

  return next;
}

function normalizeRecord(data, existing = null) {
  const next = validateSameApproverAndEvidence(data, existing);
  const date = parseDate(next.date);
  const contractNo = clean(next.contractNo).toUpperCase();
  const price = Number(String(next.price || 0).replace(/,/g, '')) || 0;

  return [
    date ? dateKey(date) : '',
    date ? monthKey(date) : '',
    clean(next.loanApproval),
    clean(next.docApproval),
    clean(next.closeApproval),
    clean(next.shop),
    clean(next.province),
    contractNo,
    price,
    clean(next.note),
    getCaseStatus(contractNo, next.loanApproval, next.docApproval, next.closeApproval),
    clean(next.loanEvidence),
    clean(next.docEvidence),
    clean(next.closeEvidence),
    clean(next.caseReceivedAt),
    clean(next.loanCompletedAt),
    clean(next.docCompletedAt),
    clean(next.closeCompletedAt),
    Number(next.slaMinutes) || SLA_MINUTES,
    clean(next.slaStatus),
    clean(next.tatMinutes)
  ];
}

async function findRowByContract(contractNo) {
  const records = await getRecordsRaw();
  const found = records.find((r) => r.contractNo === clean(contractNo).toUpperCase());
  return found ? found.row : -1;
}

async function getRecordByContract(contractNo) {
  const records = await getRecordsRaw();
  return records.find((r) => r.contractNo === clean(contractNo).toUpperCase()) || null;
}


async function deleteRecord(contractNoOrRow) {
  const text = clean(contractNoOrRow);
  if (!text) throw new Error('ไม่พบข้อมูลสำหรับลบ');

  let existing = await getRecordByContract(text);
  let row = -1;
  if (!existing && /^\d+$/.test(text)) {
    row = Number(text);
    const records = await getRecordsRaw();
    existing = records.find((record) => Number(record.row) === row) || null;
  }
  if (!existing) throw new Error('ไม่พบเลขสัญญาหรือแถวที่ต้องการลบ');

  return callAppsScript('deleteRecord', {
    contractNo: existing.contractNo,
    row: existing.row,
    evidenceUrls: [existing.loanEvidence, existing.docEvidence, existing.closeEvidence].filter(Boolean)
  });
}

async function saveRecord(data) {
  await ensureMainHeaders();
  const existing = await getRecordByContract(data.contractNo);
  const rowData = normalizeRecord(data, existing);

  if (existing?.row) {
    await sheets.updateValues(SHEETS.MAIN, `A${existing.row}:${headerColumnLetter(HEADERS.length - 1)}${existing.row}`, [rowData]);
    return { row: existing.row, duplicated: true };
  }

  await sheets.appendValues(SHEETS.MAIN, [rowData]);
  return { duplicated: false };
}

module.exports = {
  getRecordsRaw,
  saveRecord,
  deleteRecord,
  findRowByContract,
  getRecordByContract,
  getSystem,
  getCaseStatus,
  normalizeRecord,
  validateSameApproverAndEvidence,
  isDocRequiredSystem,
  ensureMainHeaders
};
