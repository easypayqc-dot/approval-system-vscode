'use strict';

const { callAppsScript } = require('./appsScriptClient');

async function getValues(sheetName, range = 'A:ZZ') {
  const result = await callAppsScript('getValues', { sheetName, range });
  if (Array.isArray(result)) return result;
  return result.values || [];
}

async function updateValues(sheetName, range, values) {
  return callAppsScript('updateValues', { sheetName, range, values });
}

async function appendValues(sheetName, values) {
  return callAppsScript('appendValues', { sheetName, values });
}

// เก็บชื่อ function เดิมไว้เพื่อไม่ให้ service เก่าเรียกแล้วพัง
async function getSheetsClient() {
  return { mode: 'apps-script-webapp' };
}

function spreadsheetId() {
  return process.env.SPREADSHEET_ID || 'managed-by-apps-script';
}

module.exports = {
  getValues,
  updateValues,
  appendValues,
  getSheetsClient,
  spreadsheetId
};
