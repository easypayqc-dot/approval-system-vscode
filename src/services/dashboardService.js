'use strict';

const dayjs = require('dayjs');
const approvalService = require('./approvalService');
const shopService = require('./shopService');
const employeeService = require('./employeeService');
const { buildCommissionSummary } = require('./commissionService');
const { TARGETS, RATES } = require('../config/constants');
const { dateKey, dateTime } = require('../utils/format');

function buildTargetSummary(records) {
  const result = Object.keys(TARGETS).map((system) => ({ system, target: TARGETS[system], current: 0, count: 0, contracts: [] }));
  const map = new Map(result.map((x) => [x.system, x]));

  records.forEach((record) => {
    const item = map.get(record.system);
    if (!item) return;
    const price = Number(record.price) || 0;
    item.current += price;
    item.count += 1;
    item.contracts.push({
      date: record.date || '',
      dateThai: record.dateThai || '',
      contractNo: record.contractNo || '',
      shop: record.shop || '',
      province: record.province || '',
      price,
      caseStatus: record.caseStatus || ''
    });
  });

  result.forEach((x) => {
    x.remaining = x.target - x.current;
    x.percent = x.target ? (x.current / x.target) * 100 : 0;
    x.status = x.percent >= 100 ? 'เกินเป้าหมาย' : (x.percent >= 90 ? 'ใกล้ถึงเป้าหมาย' : 'ยังไม่ถึงเป้า');
    x.contracts.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.contractNo).localeCompare(String(a.contractNo)));
  });

  return result;
}

function calculateKpi(records, commissionSummary) {
  return {
    total: records.length,
    totalPrice: records.reduce((sum, record) => sum + (Number(record.price) || 0), 0),
    loanApproved: records.filter((record) => record.loanApproval).length,
    docApproved: records.filter((record) => record.docApproval).length,
    closed: records.filter((record) => record.closeApproval).length,
    complete: records.filter((record) => record.caseStatus === 'เสร็จสมบูรณ์').length,
    waitClose: records.filter((record) => record.caseStatus === 'อนุมัติ-รอปิดเคส').length,
    commissionTotal: commissionSummary ? commissionSummary.totalCommission : 0
  };
}

async function getInitialData({ month = dayjs().format('YYYY-MM'), attendanceDate = dateKey(new Date()) } = {}) {
  const records = await approvalService.getRecordsRaw();
  const shops = await shopService.getShops().catch(() => []);
  const statusMap = await employeeService.getEmployeeStatusMap().catch(() => ({}));
  const employeeSummary = employeeService.buildEmployeeSummary(records, statusMap);
  const commissionSummary = buildCommissionSummary(records, month, false);
  const targetSummary = buildTargetSummary(records);
  const attendanceSummary = await employeeService.getAttendanceSummary(attendanceDate).catch(() => employeeService.defaultAttendanceSummary(attendanceDate));

  return {
    records,
    shops,
    employees: employeeService.EMPLOYEES,
    employeeStatusOptions: employeeService.EMPLOYEE_STATUS_OPTIONS,
    employeeSummary,
    commissionSummary,
    targetSummary,
    attendanceSummary,
    kpi: calculateKpi(records, commissionSummary),
    currentMonth: month,
    rates: RATES,
    targets: TARGETS,
    lastSync: dateTime(new Date()),
    appVersion: 'vscode-dashboard-connected-v1'
  };
}

module.exports = { getInitialData, buildTargetSummary, calculateKpi };
