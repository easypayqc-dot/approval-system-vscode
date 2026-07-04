'use strict';

const express = require('express');
const dayjs = require('dayjs');
const router = express.Router();
const approvalService = require('../services/approvalService');
const { buildCommissionSummary } = require('../services/commissionService');
const reportService = require('../services/reportService');
const { ok, fail } = require('../utils/response');

router.post('/status', async (_req, res) => {
  try { res.json(ok('อัปเดตสถานะเคสเรียบร้อย', await reportService.updateCaseStatuses())); }
  catch (err) { res.status(500).json(fail(err)); }
});

router.post('/daily', async (req, res) => {
  try { res.json(ok('สร้างรายงานประจำวันเรียบร้อย', await reportService.createDailyApprovalReport(req.body.date))); }
  catch (err) { res.status(500).json(fail(err)); }
});

router.get('/commission', async (req, res) => {
  try {
    const month = req.query.month || dayjs().format('YYYY-MM');
    const records = await approvalService.getRecordsRaw();
    res.json(ok('โหลด Commission เรียบร้อย', buildCommissionSummary(records, month, false)));
  } catch (err) { res.status(500).json(fail(err)); }
});

router.post('/commission', async (req, res) => {
  try {
    const month = req.body.month || dayjs().format('YYYY-MM');
    res.json(ok('คำนวณและบันทึก Commission ลง Sheet เรียบร้อย', await reportService.calculateMonthlyCommission(month, true)));
  } catch (err) { res.status(500).json(fail(err)); }
});

router.post('/run-all', async (req, res) => {
  try { res.json(ok('รันระบบหลังบ้านทั้งหมดเรียบร้อย', await reportService.runAll(req.body.month, req.body.date))); }
  catch (err) { res.status(500).json(fail(err)); }
});

module.exports = router;
