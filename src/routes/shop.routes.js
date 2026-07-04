'use strict';

const express = require('express');
const router = express.Router();
const shopService = require('../services/shopService');
const { ok, fail } = require('../utils/response');

router.get('/', async (_req, res) => {
  try {
    res.json(ok('โหลดรายการร้านค้าเรียบร้อย', { shops: await shopService.getShops() }));
  } catch (err) {
    res.status(500).json(fail(err));
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await shopService.addShop(req.body || {});
    res.json(ok(result.updated ? 'อัปเดตร้านค้าเรียบร้อย' : 'เพิ่มร้านค้าเรียบร้อย', result));
  } catch (err) {
    res.status(400).json(fail(err));
  }
});

module.exports = router;
