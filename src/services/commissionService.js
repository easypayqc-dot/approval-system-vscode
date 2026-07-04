'use strict';

const { EMPLOYEES, RATES } = require('../config/constants');
const { clean } = require('../utils/format');

function initEmployeeMap() {
  const map = new Map();
  EMPLOYEES.forEach((name) => map.set(name, { loan: 0, doc: 0, close: 0, total: 0, amount: 0 }));
  return map;
}

function getKpiLevel(total) {
  if (total >= 95) return 'Diamond';
  if (total >= 90) return 'Platinum';
  if (total >= 85) return 'Gold';
  if (total >= 75) return 'Silver';
  return 'Bronze';
}

function buildCommissionSummary(records, month, includeDuplicates = false) {
  const summary = initEmployeeMap();
  const used = new Set();
  const duplicates = [];
  const jobs = [
    { field: 'loanApproval', name: 'อนุมัติใบสินเชื่อ', key: 'loan', rate: RATES.loan },
    { field: 'docApproval', name: 'อนุมัติเอกสาร', key: 'doc', rate: RATES.doc },
    { field: 'closeApproval', name: 'อนุมัติปิดเคส', key: 'close', rate: RATES.close }
  ];
  records.forEach((r) => {
    if (!r.date || r.date.slice(0, 7) !== month) return;
    jobs.forEach((job) => {
      const employee = clean(r[job.field]);
      if (!employee || !summary.has(employee)) return;
      const uniqueKey = `${r.contractNo}|${job.name}`;
      if (used.has(uniqueKey)) {
        if (includeDuplicates) duplicates.push([r.contractNo, job.name, employee, r.dateThai, r.row]);
        return;
      }
      used.add(uniqueKey);
      const s = summary.get(employee);
      s[job.key] += 1;
      s.total += 1;
      s.amount += job.rate;
    });
  });
  const items = Array.from(summary.entries()).map(([employee, s]) => ({ employee, ...s, kpi: getKpiLevel(s.total) })).sort((a, b) => b.amount - a.amount);
  return { month, items, duplicates, totalCommission: items.reduce((sum, x) => sum + x.amount, 0) };
}

module.exports = { buildCommissionSummary, getKpiLevel, initEmployeeMap };
