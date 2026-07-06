'use strict';

const { SHEETS, HEADERS, EMPLOYEES, SLA_MINUTES } = require('../config/constants');
const sheets = require('../integrations/googleSheetsClient');
const { callAppsScript } = require('../integrations/appsScriptClient');
const { isSupabaseEnabled } = require('../integrations/supabaseClient');
const caseRepository = require('../repositories/caseRepository');
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

async function getRecordsRawFromSheet() {
  await ensureMainHeaders();
  const values = await sheets.getValues(SHEETS.MAIN, `A:${headerColumnLetter(HEADERS.length - 1)}`);
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((row, i) => recordFromRow(row, i, headers)).filter(Boolean);
}

async function getRecordsRaw() {
  if (isSupabaseEnabled()) {
    return caseRepository.listCases();
  }
  return getRecordsRawFromSheet();
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
  if (!clean(next.shop)) throw new Error('กรุณากรอกร้านค้า');
  if (!loan) throw new Error('กรุณาเลือกอนุมัติใบสินเชื่อ');
  if (!(Number(String(next.price || 0).replace(/,/g, '')) > 0)) throw new Error('กรุณากรอกราคาสินค้า');

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

function normalizedObject(data, existing = null) {
  const next = validateSameApproverAndEvidence(data, existing);
  const date = parseDate(next.date);
  const contractNo = clean(next.contractNo).toUpperCase();
  const price = Number(String(next.price || 0).replace(/,/g, '')) || 0;
  const dateText = date ? dateKey(date) : clean(next.date);
  const loan = clean(next.loanApproval);
  const doc = clean(next.docApproval);
  const close = clean(next.closeApproval);

  return {
    date: dateText,
    dateThai: date ? thaiDate(date) : '',
    month: date ? monthKey(date) : (dateText ? dateText.slice(0, 7) : ''),
    system: getSystem(contractNo),
    loanApproval: loan,
    docApproval: doc,
    closeApproval: close,
    shop: clean(next.shop),
    province: clean(next.province),
    contractNo,
    price,
    note: clean(next.note),
    caseStatus: getCaseStatus(contractNo, loan, doc, close),
    loanEvidence: clean(next.loanEvidence),
    docEvidence: clean(next.docEvidence),
    closeEvidence: clean(next.closeEvidence),
    caseReceivedAt: clean(next.caseReceivedAt),
    loanCompletedAt: clean(next.loanCompletedAt),
    docCompletedAt: clean(next.docCompletedAt),
    closeCompletedAt: clean(next.closeCompletedAt),
    slaMinutes: Number(next.slaMinutes) || SLA_MINUTES,
    slaStatus: clean(next.slaStatus),
    tatMinutes: clean(next.tatMinutes),
    docRequired: isDocRequiredSystem(contractNo)
  };
}

function normalizeRecord(data, existing = null) {
  const record = normalizedObject(data, existing);
  return [
    record.date,
    record.month,
    record.loanApproval,
    record.docApproval,
    record.closeApproval,
    record.shop,
    record.province,
    record.contractNo,
    record.price,
    record.note,
    record.caseStatus,
    record.loanEvidence,
    record.docEvidence,
    record.closeEvidence,
    record.caseReceivedAt,
    record.loanCompletedAt,
    record.docCompletedAt,
    record.closeCompletedAt,
    record.slaMinutes,
    record.slaStatus,
    record.tatMinutes
  ];
}

async function findSheetRowByContract(contractNo) {
  const records = await getRecordsRawFromSheet();
  const found = records.find((r) => r.contractNo === clean(contractNo).toUpperCase());
  return found ? found.row : -1;
}

async function getSheetRecordByContract(contractNo) {
  const records = await getRecordsRawFromSheet();
  return records.find((r) => r.contractNo === clean(contractNo).toUpperCase()) || null;
}

async function findRowByContract(contractNo) {
  if (isSupabaseEnabled()) {
    const found = await caseRepository.findCaseByContract(contractNo);
    return found ? found.row : -1;
  }
  return findSheetRowByContract(contractNo);
}

async function getRecordByContract(contractNo) {
  if (isSupabaseEnabled()) {
    return caseRepository.findCaseByContract(contractNo);
  }
  return getSheetRecordByContract(contractNo);
}

async function saveRecordToSheet(data) {
  await ensureMainHeaders();
  const existing = await getSheetRecordByContract(data.contractNo);
  const rowData = normalizeRecord(data, existing);

  if (existing?.row) {
    await sheets.updateValues(SHEETS.MAIN, `A${existing.row}:${headerColumnLetter(HEADERS.length - 1)}${existing.row}`, [rowData]);
    return { row: existing.row, duplicated: true };
  }

  const result = await sheets.appendValues(SHEETS.MAIN, [rowData]);
  return { row: result?.startRow || null, duplicated: false };
}

async function deleteRecordFromSheetAndDrive(existing) {
  return callAppsScript('deleteRecord', {
    contractNo: existing.contractNo,
    row: existing.row,
    evidenceUrls: [existing.loanEvidence, existing.docEvidence, existing.closeEvidence].filter(Boolean)
  });
}

async function trashEvidenceOnly(existing) {
  const evidenceUrls = [existing.loanEvidence, existing.docEvidence, existing.closeEvidence].filter(Boolean);
  if (!evidenceUrls.length) return null;
  try {
    return await callAppsScript('trashDriveFiles', { urls: evidenceUrls });
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function deleteRecord(contractNoOrRow) {
  const text = clean(contractNoOrRow);
  if (!text) throw new Error('ไม่พบข้อมูลสำหรับลบ');

  if (isSupabaseEnabled()) {
    let existing = await caseRepository.findCaseByContract(text);
    if (!existing && /^\d+$/.test(text)) {
      existing = await caseRepository.findCaseById(Number(text));
    }
    if (!existing) throw new Error('ไม่พบเลขสัญญาหรือแถวที่ต้องการลบ');

    const deleted = await caseRepository.deleteCaseByContract(existing.contractNo);

    let sheetResult = null;
    try {
      sheetResult = await deleteRecordFromSheetAndDrive(existing);
    } catch (err) {
      sheetResult = {
        success: false,
        message: err.message,
        trashFallback: await trashEvidenceOnly(existing)
      };
    }

    return {
      deleted: Boolean(deleted),
      source: 'supabase',
      contractNo: existing.contractNo,
      sheetSync: sheetResult
    };
  }

  let existing = await getSheetRecordByContract(text);
  let row = -1;
  if (!existing && /^\d+$/.test(text)) {
    row = Number(text);
    const records = await getRecordsRawFromSheet();
    existing = records.find((record) => Number(record.row) === row) || null;
  }
  if (!existing) throw new Error('ไม่พบเลขสัญญาหรือแถวที่ต้องการลบ');

  return deleteRecordFromSheetAndDrive(existing);
}

async function saveRecord(data) {
  if (isSupabaseEnabled()) {
    const existing = await caseRepository.findCaseByContract(data.contractNo);
    const record = normalizedObject(data, existing);

    const saved = await caseRepository.upsertCase({ ...record, sheetSyncStatus: 'pending' });

    let sheetSync = { ok: false, skipped: false, message: '' };
    try {
      const sheetResult = await saveRecordToSheet(record);
      sheetSync = { ok: true, ...sheetResult };
      await caseRepository.updateSheetSyncStatus(record.contractNo, 'synced', '');
    } catch (err) {
      sheetSync = { ok: false, message: err.message };
      try {
        await caseRepository.updateSheetSyncStatus(record.contractNo, 'failed', err.message);
      } catch (_syncErr) {
        // ถ้า update sync status ไม่สำเร็จ ห้ามทำให้การบันทึกหลักล้ม
      }
    }

    return {
      ...saved,
      duplicated: Boolean(existing),
      source: 'supabase',
      sheetSync
    };
  }

  return saveRecordToSheet(data);
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
  ensureMainHeaders,
  getRecordsRawFromSheet,
  saveRecordToSheet
};
