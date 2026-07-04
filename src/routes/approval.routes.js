'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const approvalService = require('../services/approvalService');
const driveClient = require('../integrations/googleDriveClient');
const shopService = require('../services/shopService');
const { ok, fail } = require('../utils/response');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!String(file.mimetype || '').startsWith('image/')) {
      return cb(new Error('อัปโหลดได้เฉพาะไฟล์รูปภาพเท่านั้น'));
    }
    cb(null, true);
  }
});

const uploadEvidenceFields = upload.fields([
  { name: 'loanEvidenceFile', maxCount: 1 },
  { name: 'docEvidenceFile', maxCount: 1 },
  { name: 'closeEvidenceFile', maxCount: 1 }
]);

function handleUploadEvidence(req, res, next) {
  uploadEvidenceFields(req, res, (err) => {
    if (err) return res.status(400).json(fail(err));
    return next();
  });
}

async function uploadEvidenceFilesToDrive(req) {
  const body = req.body || {};
  const files = req.files || {};
  const contractNo = body.contractNo || 'NO_CONTRACT';
  const evidenceMap = [
    { bodyKey: 'loanEvidence', fieldName: 'loanEvidenceFile', existingKey: 'loanEvidenceExisting', evidenceType: 'loan' },
    { bodyKey: 'docEvidence', fieldName: 'docEvidenceFile', existingKey: 'docEvidenceExisting', evidenceType: 'doc' },
    { bodyKey: 'closeEvidence', fieldName: 'closeEvidenceFile', existingKey: 'closeEvidenceExisting', evidenceType: 'close' }
  ];

  const result = {};
  for (const item of evidenceMap) {
    const file = files[item.fieldName]?.[0];
    if (file) {
      const uploaded = await driveClient.uploadEvidenceImage(file, { contractNo, evidenceType: item.evidenceType });
      result[item.bodyKey] = uploaded?.url || '';
    } else {
      result[item.bodyKey] = body[item.existingKey] || '';
    }
  }
  return result;
}

async function buildPayload(req) {
  const body = req.body || {};
  const evidence = await uploadEvidenceFilesToDrive(req);

  return {
    date: body.date,
    loanApproval: body.loanApproval,
    docApproval: body.docApproval,
    closeApproval: body.closeApproval,
    shop: body.shop,
    province: body.province,
    contractNo: body.contractNo,
    price: body.price,
    note: body.note,
    loanEvidence: evidence.loanEvidence,
    docEvidence: evidence.docEvidence,
    closeEvidence: evidence.closeEvidence,
    caseReceivedAt: body.caseReceivedAt,
    loanCompletedAt: body.loanCompletedAt,
    docCompletedAt: body.docCompletedAt,
    closeCompletedAt: body.closeCompletedAt,
    slaMinutes: body.slaMinutes,
    slaStatus: body.slaStatus,
    tatMinutes: body.tatMinutes
  };
}

router.get('/', async (_req, res) => {
  try {
    res.json(ok('โหลดข้อมูลเรียบร้อย', { records: await approvalService.getRecordsRaw() }));
  } catch (err) {
    res.status(500).json(fail(err));
  }
});

router.post('/', handleUploadEvidence, async (req, res) => {
  try {
    const payload = await buildPayload(req);
    const result = await approvalService.saveRecord(payload);

    if (payload.shop && payload.province) {
      shopService.addShop({ shop: payload.shop, province: payload.province }).catch(() => {});
    }

    res.json(ok('บันทึกข้อมูลลง Google Sheet และอัปโหลดรูปไป Google Drive เรียบร้อย', result));
  } catch (err) {
    res.status(400).json(fail(err));
  }
});


router.delete('/:contractNo', async (req, res) => {
  try {
    const result = await approvalService.deleteRecord(req.params.contractNo);
    res.json(ok('ลบข้อมูลและย้ายรูปหลักฐานไปถังขยะเรียบร้อย', result));
  } catch (err) {
    res.status(400).json(fail(err));
  }
});

router.get('/duplicate/:contractNo', async (req, res) => {
  try {
    const row = await approvalService.findRowByContract(req.params.contractNo);
    res.json(ok('ตรวจสอบเลขสัญญาเรียบร้อย', { exists: row > -1, row }));
  } catch (err) {
    res.status(500).json(fail(err));
  }
});

router.get('/record/:contractNo', async (req, res) => {
  try {
    const record = await approvalService.getRecordByContract(req.params.contractNo);
    if (!record) return res.status(404).json(fail('ไม่พบเลขสัญญานี้'));
    res.json(ok('โหลดข้อมูลเคสเรียบร้อย', { record }));
  } catch (err) {
    res.status(500).json(fail(err));
  }
});

module.exports = router;
