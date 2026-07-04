'use strict';

const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboardService');
const { ok, fail } = require('../utils/response');

router.get('/', async (req, res) => {
  try {
    const data = await dashboardService.getInitialData({
      month: req.query.month,
      attendanceDate: req.query.attendanceDate
    });
    res.json(ok('โหลดข้อมูล Dashboard เรียบร้อย', data));
  } catch (err) {
    res.status(500).json(fail(err));
  }
});

module.exports = router;
