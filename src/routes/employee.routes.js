'use strict';

const express = require('express');
const router = express.Router();
const approvalService = require('../services/approvalService');
const employeeService = require('../services/employeeService');
const { ok, fail } = require('../utils/response');
const { dateKey } = require('../utils/format');

router.get('/', async (_req, res) => {
  try {
    const records = await approvalService.getRecordsRaw();
    const statusMap = await employeeService.getEmployeeStatusMap().catch(() => ({}));
    res.json(ok('โหลดรายชื่อพนักงานเรียบร้อย', {
      employees: employeeService.EMPLOYEES,
      employeeStatusOptions: employeeService.EMPLOYEE_STATUS_OPTIONS,
      employeeSummary: employeeService.buildEmployeeSummary(records, statusMap),
      statusMap
    }));
  } catch (err) { res.status(500).json(fail(err)); }
});

router.get('/attendance', async (req, res) => {
  try {
    const date = req.query.date || dateKey(new Date());
    res.json(ok('โหลดสถิติพนักงานรายวันเรียบร้อย', { attendanceSummary: await employeeService.getAttendanceSummary(date) }));
  } catch (err) { res.status(500).json(fail(err)); }
});

router.post('/attendance', async (req, res) => {
  try {
    res.json(ok('บันทึกสถิติพนักงานรายวันเรียบร้อย', await employeeService.setDailyEmployeeAttendance(req.body || {})));
  } catch (err) { res.status(400).json(fail(err)); }
});

router.post('/status', async (req, res) => {
  try {
    res.json(ok('อัปเดตสถานะพนักงานเรียบร้อย', await employeeService.setEmployeeStatus(req.body.employee, req.body.status)));
  } catch (err) { res.status(400).json(fail(err)); }
});

module.exports = router;
