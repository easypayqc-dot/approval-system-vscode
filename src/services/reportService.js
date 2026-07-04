'use strict';

const sheets = require('../integrations/googleSheetsClient');
const {
  SHEETS,
  HEADERS,
  DAILY_REPORT_HEADERS,
  COMMISSION_HEADERS,
  DUPLICATE_HEADERS
} = require('../config/constants');
const { dateKey } = require('../utils/format');
const approvalService = require('./approvalService');
const { buildCommissionSummary } = require('./commissionService');

function colLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

async function clearBelowHeader(sheetName, columnCount, maxRows = 999) {
  const empty = Array.from({ length: maxRows }, () => Array.from({ length: columnCount }, () => ''));
  await sheets.updateValues(sheetName, `A2:${colLetter(columnCount - 1)}${maxRows + 1}`, empty);
}

async function updateCaseStatuses() {
  const records = await approvalService.getRecordsRaw();
  if (!records.length) return { count: 0 };
  const rows = records.map((record) => [approvalService.getCaseStatus(record.contractNo, record.loanApproval, record.docApproval, record.closeApproval)]);
  await sheets.updateValues(SHEETS.MAIN, `K2:K${rows.length + 1}`, rows);
  return { count: rows.length };
}

async function createDailyApprovalReport(targetDate = dateKey(new Date())) {
  await updateCaseStatuses();
  const records = await approvalService.getRecordsRaw();
  const seen = new Set();
  const rows = records.filter((record) => {
    if (record.date !== targetDate) return false;
    if (!record.contractNo || (!record.loanApproval && !record.docApproval && !record.closeApproval)) return false;
    const key = `${record.contractNo}|${record.loanApproval}|${record.docApproval}|${record.closeApproval}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((record) => [
    record.dateThai,
    record.contractNo,
    record.loanApproval,
    record.docApproval,
    record.closeApproval,
    record.caseStatus,
    record.note,
    record.slaStatus,
    record.tatMinutes
  ]);

  await sheets.updateValues(SHEETS.DAILY_REPORT, `A1:${colLetter(DAILY_REPORT_HEADERS.length - 1)}1`, [DAILY_REPORT_HEADERS]);
  await clearBelowHeader(SHEETS.DAILY_REPORT, DAILY_REPORT_HEADERS.length, Math.max(rows.length + 20, 200));
  if (rows.length) await sheets.updateValues(SHEETS.DAILY_REPORT, `A2:${colLetter(DAILY_REPORT_HEADERS.length - 1)}${rows.length + 1}`, rows);
  return { date: targetDate, count: rows.length, rows };
}

async function calculateMonthlyCommission(month, includeDuplicates = true) {
  await updateCaseStatuses();
  const records = await approvalService.getRecordsRaw();
  const result = buildCommissionSummary(records, month, includeDuplicates);
  const commissionRows = result.items.map((item) => [item.employee, item.loan, item.doc, item.close, item.total, item.amount, item.kpi]);

  await sheets.updateValues(SHEETS.COMMISSION, `A1:${colLetter(COMMISSION_HEADERS.length - 1)}1`, [COMMISSION_HEADERS]);
  await clearBelowHeader(SHEETS.COMMISSION, COMMISSION_HEADERS.length, Math.max(commissionRows.length + 20, 100));
  if (commissionRows.length) await sheets.updateValues(SHEETS.COMMISSION, `A2:${colLetter(COMMISSION_HEADERS.length - 1)}${commissionRows.length + 1}`, commissionRows);

  await sheets.updateValues(SHEETS.DUPLICATE, `A1:${colLetter(DUPLICATE_HEADERS.length - 1)}1`, [DUPLICATE_HEADERS]);
  await clearBelowHeader(SHEETS.DUPLICATE, DUPLICATE_HEADERS.length, Math.max((result.duplicates || []).length + 20, 100));
  if (result.duplicates?.length) await sheets.updateValues(SHEETS.DUPLICATE, `A2:${colLetter(DUPLICATE_HEADERS.length - 1)}${result.duplicates.length + 1}`, result.duplicates);

  return result;
}

async function runAll(month, date) {
  const status = await updateCaseStatuses();
  const daily = await createDailyApprovalReport(date || dateKey(new Date()));
  const commission = await calculateMonthlyCommission(month || String(dateKey(new Date())).slice(0, 7));
  return { status, daily, commission };
}

module.exports = { updateCaseStatuses, createDailyApprovalReport, calculateMonthlyCommission, runAll };
