'use strict';

const path = require('path');
const { callAppsScript } = require('./appsScriptClient');

const EVIDENCE_TYPE_LABELS = {
  loan: 'อนุมัติสินเชื่อ',
  doc: 'อนุมัติเอกสาร',
  close: 'อนุมัติปิดเคส'
};

function normalizeEvidenceType(evidenceType) {
  const text = String(evidenceType || '').trim().toLowerCase();
  if (text === 'loan' || text === 'loanevidence' || text === 'สินเชื่อ' || text === 'อนุมัติสินเชื่อ') return 'loan';
  if (text === 'doc' || text === 'document' || text === 'docevidence' || text === 'เอกสาร' || text === 'อนุมัติเอกสาร') return 'doc';
  if (text === 'close' || text === 'closeevidence' || text === 'ปิดเคส' || text === 'อนุมัติปิดเคส') return 'close';
  return text || 'loan';
}

function cleanFilePart(value, fallback = 'file') {
  const text = String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 90);
  return text || fallback;
}

function localFileNamePreview(file, meta = {}) {
  const contractNo = cleanFilePart(meta.contractNo, 'NO_CONTRACT');
  const type = normalizeEvidenceType(meta.evidenceType);
  const evidenceLabel = cleanFilePart(EVIDENCE_TYPE_LABELS[type] || type, 'evidence');
  const originalExt = path.extname(file.originalname || '');
  const ext = originalExt || (file.mimetype === 'image/jpeg' ? '.jpg' : '.png');
  return `${Date.now()}_${contractNo}_${evidenceLabel}${ext}`;
}

async function uploadEvidenceImage(file, meta = {}) {
  if (!file) return null;
  if (!Buffer.isBuffer(file.buffer)) {
    throw new Error('ไม่พบข้อมูลไฟล์รูปภาพสำหรับอัปโหลด');
  }

  const evidenceType = normalizeEvidenceType(meta.evidenceType);
  const result = await callAppsScript('uploadEvidenceImage', {
    contractNo: meta.contractNo || 'NO_CONTRACT',
    evidenceType,
    originalName: file.originalname || localFileNamePreview(file, { ...meta, evidenceType }),
    mimeType: file.mimetype || 'application/octet-stream',
    base64: file.buffer.toString('base64')
  });

  const url = result.url || result.file_url || result.webViewLink || '';

  return {
    id: result.id || result.file_id || '',
    name: result.name || result.file_name || '',
    mimeType: result.mimeType || result.mime_type || file.mimetype || '',
    evidenceType,
    folderId: result.folderId || result.folder_id || '',
    webViewLink: result.webViewLink || url,
    webContentLink: result.webContentLink || '',
    url
  };
}

// ชื่อ function เดิม เผื่อ code อื่นเรียกใช้
async function getDriveClient() {
  return { mode: 'apps-script-webapp' };
}

function driveFolderId(evidenceType = 'loan') {
  const type = normalizeEvidenceType(evidenceType);
  const map = {
    loan: process.env.GOOGLE_DRIVE_LOAN_FOLDER_ID || 'managed-by-apps-script',
    doc: process.env.GOOGLE_DRIVE_DOC_FOLDER_ID || 'managed-by-apps-script',
    close: process.env.GOOGLE_DRIVE_CLOSE_FOLDER_ID || 'managed-by-apps-script'
  };
  return map[type] || 'managed-by-apps-script';
}

module.exports = {
  getDriveClient,
  uploadEvidenceImage,
  driveFolderId,
  normalizeEvidenceType
};
