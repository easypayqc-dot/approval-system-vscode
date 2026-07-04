/***** Approval Phase 1 | Setup Google Sheet Tables + Apps Script Webhook *****/

const SPREADSHEET_ID = '1rw3iYcSnPRsFnlhxg12Lfu2KbtQHK6EaewLJvqDpuZQ';
// ถ้า Apps Script ผูกกับ Google Sheet ใหม่อยู่แล้ว ให้ปล่อยว่าง
// ถ้าเป็น Apps Script แยก ให้ใส่ Spreadsheet ID ของชีตใหม่

const TIMEZONE = 'Asia/Bangkok';
const SLA_MINUTES = 20;

// ต้องตรงกับค่า APPS_SCRIPT_WEBAPP_TOKEN ในไฟล์ .env ของ VS Code
const WEBHOOK_TOKEN = 'APPROVAL_PHASE1_SECRET';

// Google Drive Folder ID แยกตามประเภทหลักฐาน
const DRIVE_FOLDER_IDS = {
  loan: '1cn3e63BNGlytrhwLV5V9bdiq84Xwqsu-',  // อนุมัติสินเชื่อ
  doc: '1T3UfSMN9stH6G7nCocrP0leiWwDuA1bd',    // อนุมัติเอกสาร
  close: '1rmJo4l1pUTHXcAwLfror5L5xx4fFwDv_'   // อนุมัติปิดเคส
};

// false = คนเปิดรูปต้องมีสิทธิ์ใน Drive Folder
// true = คนที่มีลิงก์เปิดรูปได้ง่ายขึ้น แต่เสี่ยงข้อมูลรั่วมากกว่า
const MAKE_DRIVE_FILE_PUBLIC = false;

const MAIN_SHEET = 'เคสอนุมัติประจำวัน❤️';
const SHOP_SHEET = 'ร้านอยู่จังหวัดไหน';
const LOG_SHEET = 'ImportLog';
const DAILY_REPORT_SHEET = 'รายการเคสอนุมัติประจำวัน';
const COMMISSION_SHEET = 'Commission_ประจำเดือน';
const DUPLICATE_SHEET = 'ตรวจเลขสัญญาซ้ำ';
const EMPLOYEE_STATUS_SHEET = 'สถานะพนักงาน';
const ATTENDANCE_SHEET = 'สถิติพนักงานรายวัน';

const MAIN_HEADERS = [
  'วันที่',
  'เดือน',
  'อนุมัติใบสินเชื่อ',
  'อนุมัติเอกสาร',
  'อนุมัติปิดเคส',
  'ร้านค้า',
  'จังหวัด',
  'เลขสัญญา',
  'ราคาสินค้า',
  'หมายเหตุ',
  'สถานะเคส',
  'หลักฐานใบสินเชื่อ',
  'หลักฐานเอกสาร',
  'หลักฐานปิดเคส',
  'เวลารับเคส',
  'เวลาอนุมัติใบสินเชื่อ',
  'เวลาอนุมัติเอกสาร',
  'เวลาปิดเคส',
  'SLA นาที',
  'ผล SLA',
  'TAT นาที'
];

const SHOP_HEADERS = ['ร้านค้า', 'จังหวัด'];

const LOG_HEADERS = [
  'วันที่เวลา',
  'Action',
  'เลขสัญญา',
  'จำนวนข้อมูล',
  'สถานะ',
  'หมายเหตุ'
];

const DAILY_REPORT_HEADERS = [
  'วันที่',
  'เลขที่สัญญา',
  'อนุมัติใบสินเชื่อ',
  'อนุมัติเอกสาร',
  'อนุมัติปิดเคส',
  'สถานะเคส',
  'หมายเหตุ',
  'ผล SLA',
  'TAT นาที'
];

const COMMISSION_HEADERS = [
  'พนักงาน',
  'อนุมัติใบสินเชื่อ',
  'อนุมัติเอกสาร',
  'อนุมัติปิดเคส',
  'รวมงาน',
  'ค่าคอมรวม (บาท)',
  'KPI'
];

const DUPLICATE_HEADERS = [
  'เลขที่สัญญา',
  'ประเภทงาน',
  'ผู้ทำรายการ',
  'วันที่',
  'แถวต้นทาง'
];

const EMPLOYEE_STATUS_HEADERS = [
  'พนักงาน',
  'สถานะ',
  'วันที่อัปเดต'
];

const ATTENDANCE_HEADERS = [
  'วันที่',
  'พนักงาน',
  'สถานะ',
  'หมายเหตุ',
  'วันที่เวลาอัปเดต'
];

const EMPLOYEES = [
  'กรองกาญจน์ ถิ่นถา (อิ๋ว)',
  'พรทิพย์ โป๊ะโดย (แป้ง)',
  'จารุพัฒน์ หมื่นกัณฑ์ (เจมส์)',
  'อนุพงศ์ กันทา (โจ)',
  'แพรพรรณ แก้วมา (พิม)',
  'ธวัชชัย อรรถโสภา (ก้อง)',
  'ชฎาทิพย์ ติรวงษ์ดนุพล (นัท)',
  'นฏกร ทานกระโทก (ฟ้า)',
  'ณัฐพงษ์ มะโนวรรณา (นัท)',
  'นรบดี ใจงาม (ไบร์ท)',
  'ณัฐชนน กันทหล้า (น้อย)'
];

const EMPLOYEE_STATUS_OPTIONS = [
  'ปฏิบัติงาน',
  'หยุด',
  'ลา',
  'ลาป่วย'
];

const CASE_STATUS_OPTIONS = [
  'เสร็จสมบูรณ์',
  'อนุมัติ-รอปิดเคส'
];

const SLA_RESULT_OPTIONS = [
  'RUNNING',
  'PASS',
  'FAIL'
];

const EMPLOYEE_STATUS_DEFAULT = 'ปฏิบัติงาน';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ระบบอนุมัติ')
    .addItem('สร้าง/อัปเดตตารางทั้งหมด', 'setupNewApprovalWorkbook')
    .addItem('ล้างข้อมูลแล้วสร้างใหม่', 'resetApprovalWorkbook')
    .addSeparator()
    .addItem('ทดสอบ Webhook / Drive', 'testWebhookConfig')
    .addToUi();
}

function setupNewApprovalWorkbook() {
  return setupApprovalWorkbook_(false);
}

function resetApprovalWorkbook() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'ยืนยันการล้างข้อมูล',
    'ระบบจะล้างข้อมูลทุกแท็บแล้วสร้างตารางใหม่ทั้งหมด ต้องการทำต่อหรือไม่?',
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) return;

  return setupApprovalWorkbook_(true);
}

function setupApprovalWorkbook_(reset) {
  const ss = getWorkbook_();

  const sheetConfigs = [
    [MAIN_SHEET, MAIN_HEADERS, '#0f2563'],
    [SHOP_SHEET, SHOP_HEADERS, '#0f766e'],
    [LOG_SHEET, LOG_HEADERS, '#111827'],
    [DAILY_REPORT_SHEET, DAILY_REPORT_HEADERS, '#0f766e'],
    [COMMISSION_SHEET, COMMISSION_HEADERS, '#1f2937'],
    [DUPLICATE_SHEET, DUPLICATE_HEADERS, '#991b1b'],
    [EMPLOYEE_STATUS_SHEET, EMPLOYEE_STATUS_HEADERS, '#075985'],
    [ATTENDANCE_SHEET, ATTENDANCE_HEADERS, '#0f766e']
  ];

  sheetConfigs.forEach(([name, headers, color]) => {
    setupSheet_(ss, name, headers, color, reset);
  });

  setupMainSheet_(ss.getSheetByName(MAIN_SHEET));
  setupShopSheet_(ss.getSheetByName(SHOP_SHEET));
  setupLogSheet_(ss.getSheetByName(LOG_SHEET));
  setupDailyReportSheet_(ss.getSheetByName(DAILY_REPORT_SHEET));
  setupCommissionSheet_(ss.getSheetByName(COMMISSION_SHEET));
  setupDuplicateSheet_(ss.getSheetByName(DUPLICATE_SHEET));
  setupEmployeeStatusSheet_(ss.getSheetByName(EMPLOYEE_STATUS_SHEET));
  setupAttendanceSheet_(ss.getSheetByName(ATTENDANCE_SHEET));

  reorderSheets_(ss);

  SpreadsheetApp.flush();

  const message =
    'สร้าง/อัปเดตตารางเรียบร้อย ✅\n\n' +
    'Spreadsheet ID:\n' + ss.getId() + '\n\n' +
    'URL:\n' + ss.getUrl();

  Logger.log(message);

  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (err) {}

  return message;
}

function getWorkbook_() {
  const id = String(SPREADSHEET_ID || '').trim();

  if (id) {
    return SpreadsheetApp.openById(id);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('ไม่พบ Google Sheet กรุณาเปิด Apps Script จากไฟล์ Google Sheet หรือใส่ SPREADSHEET_ID');
  }

  return ss;
}

function setupSheet_(ss, sheetName, headers, color, reset) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (reset) {
    sheet.clear();
  }

  ensureSheetSize_(sheet, 1000, headers.length);

  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground(color)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);
  sheet.setTabColor(color);

  sheet.getRange(1, 1, sheet.getMaxRows(), headers.length)
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setVerticalAlignment('middle');

  createFilter_(sheet, headers.length);
  sheet.autoResizeColumns(1, headers.length);

  return sheet;
}

function setupMainSheet_(sheet) {
  const rows = sheet.getMaxRows() - 1;

  sheet.getRange(2, 1, rows, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(2, 2, rows, 1).setNumberFormat('@');
  sheet.getRange(2, 8, rows, 1).setNumberFormat('@');
  sheet.getRange(2, 9, rows, 1).setNumberFormat('#,##0');
  sheet.getRange(2, 12, rows, 3).setNumberFormat('@');
  sheet.getRange(2, 15, rows, 4).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  sheet.getRange(2, 19, rows, 1).setNumberFormat('0');
  sheet.getRange(2, 21, rows, 1).setNumberFormat('0.00');

  applyDropdown_(sheet, 3, EMPLOYEES);
  applyDropdown_(sheet, 4, EMPLOYEES);
  applyDropdown_(sheet, 5, EMPLOYEES);
  applyDropdown_(sheet, 11, CASE_STATUS_OPTIONS);
  applyDropdown_(sheet, 20, SLA_RESULT_OPTIONS);

  const slaNumberRule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThan(0)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(2, 19, rows, 1).setDataValidation(slaNumberRule);

  sheet.getRange('S1').setNote('SLA ของระบบกำหนดไว้ 20 นาที');
  sheet.getRange('T1').setNote('RUNNING / PASS / FAIL');
  sheet.getRange('U1').setNote('TAT นาที จากเวลารับเคสถึงเวลาปิดเคส');

  setColumnWidths_(sheet, {
    1: 120,
    2: 100,
    3: 210,
    4: 210,
    5: 210,
    6: 240,
    7: 130,
    8: 170,
    9: 120,
    10: 240,
    11: 160,
    12: 230,
    13: 230,
    14: 230,
    15: 170,
    16: 190,
    17: 190,
    18: 170,
    19: 90,
    20: 100,
    21: 100
  });

  applyMainConditionalFormats_(sheet);
}

function setupShopSheet_(sheet) {
  setColumnWidths_(sheet, {
    1: 260,
    2: 160
  });

  sheet.getRange('A1').setNote('ใส่ชื่อร้านค้า');
  sheet.getRange('B1').setNote('ใส่จังหวัดของร้านค้า');
}

function setupLogSheet_(sheet) {
  const rows = sheet.getMaxRows() - 1;

  sheet.getRange(2, 1, rows, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');

  setColumnWidths_(sheet, {
    1: 170,
    2: 140,
    3: 170,
    4: 120,
    5: 120,
    6: 300
  });
}

function setupDailyReportSheet_(sheet) {
  const rows = sheet.getMaxRows() - 1;

  sheet.getRange(2, 1, rows, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(2, 9, rows, 1).setNumberFormat('0.00');

  applyDropdown_(sheet, 8, SLA_RESULT_OPTIONS);

  setColumnWidths_(sheet, {
    1: 120,
    2: 170,
    3: 210,
    4: 210,
    5: 210,
    6: 160,
    7: 260,
    8: 100,
    9: 100
  });
}

function setupCommissionSheet_(sheet) {
  const rows = sheet.getMaxRows() - 1;

  sheet.getRange(2, 6, rows, 1).setNumberFormat('#,##0.00');

  setColumnWidths_(sheet, {
    1: 260,
    2: 150,
    3: 150,
    4: 150,
    5: 110,
    6: 150,
    7: 120
  });
}

function setupDuplicateSheet_(sheet) {
  setColumnWidths_(sheet, {
    1: 180,
    2: 180,
    3: 240,
    4: 120,
    5: 110
  });
}

function setupEmployeeStatusSheet_(sheet) {
  const rows = sheet.getMaxRows() - 1;

  applyDropdown_(sheet, 2, EMPLOYEE_STATUS_OPTIONS);

  sheet.getRange(2, 3, rows, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');

  const lastRow = sheet.getLastRow();
  const existing = new Set();

  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 1)
      .getValues()
      .flat()
      .forEach(name => {
        const text = clean_(name);
        if (text) existing.add(text);
      });
  }

  const now = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss');

  const insertRows = EMPLOYEES
    .filter(name => !existing.has(name))
    .map(name => [name, EMPLOYEE_STATUS_DEFAULT, now]);

  if (insertRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, insertRows.length, EMPLOYEE_STATUS_HEADERS.length)
      .setValues(insertRows);
  }

  setColumnWidths_(sheet, {
    1: 280,
    2: 140,
    3: 180
  });
}

function setupAttendanceSheet_(sheet) {
  const rows = sheet.getMaxRows() - 1;

  sheet.getRange(2, 1, rows, 1).setNumberFormat('yyyy-MM-dd');
  sheet.getRange(2, 5, rows, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');

  applyDropdown_(sheet, 2, EMPLOYEES);
  applyDropdown_(sheet, 3, EMPLOYEE_STATUS_OPTIONS);

  setColumnWidths_(sheet, {
    1: 130,
    2: 280,
    3: 140,
    4: 260,
    5: 180
  });
}

function ensureSheetSize_(sheet, targetRows, targetCols) {
  const currentRows = sheet.getMaxRows();
  const currentCols = sheet.getMaxColumns();

  if (currentRows < targetRows) {
    sheet.insertRowsAfter(currentRows, targetRows - currentRows);
  }

  if (currentCols < targetCols) {
    sheet.insertColumnsAfter(currentCols, targetCols - currentCols);
  }
}

function createFilter_(sheet, cols) {
  const existingFilter = sheet.getFilter();

  if (existingFilter) {
    existingFilter.remove();
  }

  sheet.getRange(1, 1, sheet.getMaxRows(), cols).createFilter();
}

function applyDropdown_(sheet, col, options) {
  const rows = sheet.getMaxRows() - 1;

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(2, col, rows, 1).setDataValidation(rule);
}

function setColumnWidths_(sheet, widths) {
  Object.keys(widths).forEach(col => {
    sheet.setColumnWidth(Number(col), widths[col]);
  });
}

function applyMainConditionalFormats_(sheet) {
  const rows = sheet.getMaxRows() - 1;

  const statusRange = sheet.getRange(2, 11, rows, 1);
  const slaRange = sheet.getRange(2, 20, rows, 1);

  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('เสร็จสมบูรณ์')
      .setBackground('#dcfce7')
      .setFontColor('#166534')
      .setRanges([statusRange])
      .build(),

    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('อนุมัติ-รอปิดเคส')
      .setBackground('#ffedd5')
      .setFontColor('#9a3412')
      .setRanges([statusRange])
      .build(),

    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('PASS')
      .setBackground('#dcfce7')
      .setFontColor('#166534')
      .setRanges([slaRange])
      .build(),

    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('FAIL')
      .setBackground('#fee2e2')
      .setFontColor('#991b1b')
      .setRanges([slaRange])
      .build(),

    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('RUNNING')
      .setBackground('#dbeafe')
      .setFontColor('#1e40af')
      .setRanges([slaRange])
      .build()
  ];

  sheet.setConditionalFormatRules(rules);
}

function reorderSheets_(ss) {
  const order = [
    MAIN_SHEET,
    SHOP_SHEET,
    DAILY_REPORT_SHEET,
    COMMISSION_SHEET,
    DUPLICATE_SHEET,
    EMPLOYEE_STATUS_SHEET,
    ATTENDANCE_SHEET,
    LOG_SHEET
  ];

  order.forEach((name, index) => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;

    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(index + 1);
  });

  ss.setActiveSheet(ss.getSheetByName(MAIN_SHEET));
}


/***** Apps Script Webhook: VS Code Server -> Google Sheet + Google Drive *****/

function doGet() {
  return json_({
    ok: true,
    app: 'Approval Phase 1 Apps Script Webhook',
    mainSheet: MAIN_SHEET,
    time: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
  });
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    verifyToken_(payload.token);

    const action = clean_(payload.action);
    const data = payload.data || {};

    let result;
    switch (action) {
      case 'ping':
        result = {
          pong: true,
          mainSheet: MAIN_SHEET,
          time: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
        };
        break;
      case 'setupWorkbook':
      case 'setupNewApprovalWorkbook':
        result = setupNewApprovalWorkbook();
        break;
      case 'getValues':
        result = getValuesForWebhook_(data);
        break;
      case 'updateValues':
        result = updateValuesForWebhook_(data);
        break;
      case 'appendValues':
        result = appendValuesForWebhook_(data);
        break;
      case 'uploadEvidenceImage':
      case 'uploadImage':
        result = uploadEvidenceImageForWebhook_(data);
        break;
      case 'deleteRecord':
      case 'deleteApprovalRecord':
      case 'deleteRecordByContract':
        result = deleteRecordForWebhook_(data);
        break;
      case 'deleteRow':
      case 'deleteValues':
        result = deleteRecordForWebhook_(data);
        break;
      case 'trashEvidenceFiles':
      case 'trashDriveFiles':
        result = trashDriveFilesForWebhook_(data.urls || data.fileUrls || data.fileIds || data.files || []);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }

    return json_({ ok: true, success: true, data: result });
  } catch (err) {
    return json_({
      ok: false,
      success: false,
      error: err && err.message ? err.message : String(err),
      message: err && err.message ? err.message : String(err)
    });
  }
}

function parsePayload_(e) {
  const text = e && e.postData && e.postData.contents ? e.postData.contents : '';

  if (text) {
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error('Invalid JSON payload');
    }
  }

  if (e && e.parameter && Object.keys(e.parameter).length) {
    return e.parameter;
  }

  return {};
}

function verifyToken_(token) {
  if (String(token || '') !== String(WEBHOOK_TOKEN || '')) {
    throw new Error('Invalid webhook token');
  }
}

function getWebhookSheet_(sheetName) {
  const name = clean_(sheetName);
  if (!name) throw new Error('Missing sheetName');

  const ss = getWorkbook_();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function getValuesForWebhook_(data) {
  const sheet = getWebhookSheet_(data.sheetName);
  const rangeA1 = clean_(data.range) || 'A:ZZ';
  const values = sheet.getRange(rangeA1).getValues();

  return {
    sheetName: sheet.getName(),
    range: rangeA1,
    values: trimTrailingEmptyRowsForWebhook_(values)
  };
}

function updateValuesForWebhook_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const sheet = getWebhookSheet_(data.sheetName);
    const rangeA1 = clean_(data.range);
    const values = sanitizeValuesForWebhook_(normalizeValuesForWebhook_(data.values));

    if (!rangeA1) throw new Error('Missing range');
    if (!values.length || !values[0].length) throw new Error('Missing values');

    sheet.getRange(rangeA1).setValues(values);

    webhookLog_('UPDATE_VALUES', clean_(data.sheetName), values.length, 'SUCCESS', rangeA1);

    return {
      sheetName: sheet.getName(),
      range: rangeA1,
      updatedRows: values.length,
      updatedColumns: values[0].length
    };
  } finally {
    lock.releaseLock();
  }
}

function appendValuesForWebhook_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const sheet = getWebhookSheet_(data.sheetName);
    const values = sanitizeValuesForWebhook_(normalizeValuesForWebhook_(data.values));

    if (!values.length || !values[0].length) throw new Error('Missing values');

    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, values.length, values[0].length).setValues(values);

    webhookLog_('APPEND_VALUES', clean_(data.sheetName), values.length, 'SUCCESS', 'startRow=' + startRow);

    return {
      sheetName: sheet.getName(),
      startRow: startRow,
      appendedRows: values.length
    };
  } finally {
    lock.releaseLock();
  }
}

function uploadEvidenceImageForWebhook_(data) {
  const evidenceType = normalizeEvidenceTypeForWebhook_(data.evidenceType || data.image_type || data.type);
  const folderId = DRIVE_FOLDER_IDS[evidenceType];
  if (!folderId) throw new Error('Missing Drive folder ID for evidence type: ' + evidenceType);

  const originalName = clean_(data.originalName || data.original_name || 'evidence.png');
  const mimeType = clean_(data.mimeType || data.mime_type || 'image/png');
  const base64 = stripBase64Prefix_(String(data.base64 || '').trim());
  if (!base64) throw new Error('Missing image base64');

  const contractNo = clean_(data.contractNo || data.contract_no || data.case_id || 'NO_CONTRACT').toUpperCase();
  const fileName = buildEvidenceFileNameForWebhook_(contractNo, evidenceType, originalName);
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);

  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(blob);

  if (MAKE_DRIVE_FILE_PUBLIC) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  webhookLog_('UPLOAD_IMAGE', contractNo, 1, 'SUCCESS', evidenceType + ' -> ' + file.getId());

  return {
    id: file.getId(),
    file_id: file.getId(),
    name: file.getName(),
    file_name: file.getName(),
    url: file.getUrl(),
    file_url: file.getUrl(),
    webViewLink: file.getUrl(),
    mimeType: mimeType,
    mime_type: mimeType,
    evidenceType: evidenceType,
    folderId: folderId,
    folder_id: folderId
  };
}


function deleteRecordForWebhook_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const sheet = getWebhookSheet_(data.sheetName || MAIN_SHEET);
    const rowNumber = findDeleteRowForWebhook_(sheet, data);

    if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
      throw new Error('ไม่พบข้อมูลที่ต้องการลบ');
    }

    const record = readRecordForDeleteWebhook_(sheet, rowNumber);
    const requestedContract = clean_(data.contractNo || data.contract_no).toUpperCase();

    if (requestedContract && record.contractNo && requestedContract !== record.contractNo) {
      throw new Error('เลขสัญญาไม่ตรงกับแถวที่ต้องการลบ');
    }

    const evidenceInputs = [];

    if (Array.isArray(data.evidenceUrls)) {
      data.evidenceUrls.forEach(function (url) { evidenceInputs.push(url); });
    }
    if (Array.isArray(data.fileUrls)) {
      data.fileUrls.forEach(function (url) { evidenceInputs.push(url); });
    }
    if (Array.isArray(data.fileIds)) {
      data.fileIds.forEach(function (id) { evidenceInputs.push(id); });
    }

    record.evidenceUrls.forEach(function (url) { evidenceInputs.push(url); });

    const trashResult = trashDriveFilesForWebhook_(evidenceInputs);

    sheet.deleteRow(rowNumber);

    webhookLog_(
      'DELETE_RECORD',
      record.contractNo || requestedContract || ('row=' + rowNumber),
      1,
      'SUCCESS',
      'row=' + rowNumber + ', trashed=' + trashResult.trashed.length + ', failed=' + trashResult.failed.length
    );

    return {
      sheetName: sheet.getName(),
      deleted: true,
      deletedRow: rowNumber,
      row: rowNumber,
      contractNo: record.contractNo || requestedContract,
      trashedFiles: trashResult.trashed,
      failedFiles: trashResult.failed
    };
  } finally {
    lock.releaseLock();
  }
}

function findDeleteRowForWebhook_(sheet, data) {
  const rowNumber = Number(data.row || data.rowNumber || data.deletedRow || 0);
  if (rowNumber) return rowNumber;

  const contractNo = clean_(data.contractNo || data.contract_no).toUpperCase();
  if (!contractNo) throw new Error('Missing contractNo or row');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const headerMap = getWebhookHeaderMap_(sheet);
  const contractIndex = headerMap['เลขสัญญา'];
  if (contractIndex === undefined) throw new Error('ไม่พบคอลัมน์ เลขสัญญา');

  const values = sheet.getRange(2, contractIndex + 1, lastRow - 1, 1).getValues().flat();
  for (let i = 0; i < values.length; i++) {
    if (clean_(values[i]).toUpperCase() === contractNo) return i + 2;
  }

  return -1;
}

function readRecordForDeleteWebhook_(sheet, rowNumber) {
  const headerMap = getWebhookHeaderMap_(sheet);
  const values = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];

  const evidenceHeaders = [
    'หลักฐานใบสินเชื่อ',
    'หลักฐานเอกสาร',
    'หลักฐานปิดเคส'
  ];

  const evidenceUrls = [];
  evidenceHeaders.forEach(function (header) {
    const index = headerMap[header];
    if (index !== undefined) {
      const url = clean_(values[index]);
      if (url) evidenceUrls.push(url);
    }
  });

  const contractIndex = headerMap['เลขสัญญา'];

  return {
    contractNo: contractIndex !== undefined ? clean_(values[contractIndex]).toUpperCase() : '',
    evidenceUrls: uniqueForWebhook_(evidenceUrls)
  };
}

function getWebhookHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function (header, index) {
    const key = clean_(header);
    if (key) map[key] = index;
  });
  return map;
}

function trashDriveFilesForWebhook_(input) {
  const items = normalizeDriveFileInputsForWebhook_(input);
  const trashed = [];
  const failed = [];

  items.forEach(function (item) {
    const source = clean_(item);
    const fileId = extractDriveFileIdForWebhook_(source);

    if (!fileId) {
      if (source) failed.push({ source: source, message: 'ไม่พบ Google Drive file ID' });
      return;
    }

    try {
      DriveApp.getFileById(fileId).setTrashed(true);
      trashed.push({ fileId: fileId, source: source });
    } catch (err) {
      failed.push({ fileId: fileId, source: source, message: err && err.message ? err.message : String(err) });
    }
  });

  return {
    trashed: trashed,
    failed: failed
  };
}

function normalizeDriveFileInputsForWebhook_(input) {
  let values = input;

  if (values === null || values === undefined) return [];
  if (!Array.isArray(values)) values = [values];

  const flattened = [];
  values.forEach(function (item) {
    if (item === null || item === undefined) return;

    if (Array.isArray(item)) {
      item.forEach(function (nested) { flattened.push(nested); });
      return;
    }

    if (typeof item === 'object') {
      flattened.push(item.fileId || item.file_id || item.id || item.url || item.file_url || item.webViewLink || '');
      return;
    }

    flattened.push(item);
  });

  return uniqueForWebhook_(flattened);
}

function extractDriveFileIdForWebhook_(value) {
  const text = clean_(value);
  if (!text) return '';

  // กรณีส่งมาเป็น file ID ตรง ๆ
  if (/^[A-Za-z0-9_-]{20,}$/.test(text) && text.indexOf('http') !== 0) return text;

  let match = text.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];

  match = text.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (match) return match[1];

  match = text.match(/\/open\?id=([A-Za-z0-9_-]+)/);
  if (match) return match[1];

  match = text.match(/\/uc\?export=download&id=([A-Za-z0-9_-]+)/);
  if (match) return match[1];

  return '';
}

function uniqueForWebhook_(values) {
  const seen = {};
  const result = [];

  values.forEach(function (value) {
    const text = clean_(value);
    if (!text || seen[text]) return;
    seen[text] = true;
    result.push(text);
  });

  return result;
}

function normalizeValuesForWebhook_(values) {
  if (!Array.isArray(values)) return [];
  if (!values.length) return [];
  if (!Array.isArray(values[0])) return [values];
  return values;
}

function sanitizeValuesForWebhook_(values) {
  return values.map(function (row) {
    return row.map(function (cell) {
      if (cell === undefined || cell === null) return '';
      return cell;
    });
  });
}

function trimTrailingEmptyRowsForWebhook_(values) {
  let last = values.length;
  while (last > 0 && values[last - 1].every(function (cell) { return clean_(cell) === ''; })) {
    last--;
  }
  return values.slice(0, last);
}

function normalizeEvidenceTypeForWebhook_(value) {
  const text = clean_(value).toLowerCase();
  if (['loan', 'loanevidence', 'loan_evidence', 'สินเชื่อ', 'อนุมัติสินเชื่อ', 'หลักฐานใบสินเชื่อ', 'before'].indexOf(text) > -1) return 'loan';
  if (['doc', 'document', 'docevidence', 'doc_evidence', 'เอกสาร', 'อนุมัติเอกสาร', 'หลักฐานเอกสาร'].indexOf(text) > -1) return 'doc';
  if (['close', 'closeevidence', 'close_evidence', 'ปิดเคส', 'อนุมัติปิดเคส', 'หลักฐานปิดเคส', 'after'].indexOf(text) > -1) return 'close';
  return text || 'loan';
}

function evidenceLabelForWebhook_(type) {
  if (type === 'loan') return 'อนุมัติสินเชื่อ';
  if (type === 'doc') return 'อนุมัติเอกสาร';
  if (type === 'close') return 'อนุมัติปิดเคส';
  return 'หลักฐาน';
}

function buildEvidenceFileNameForWebhook_(contractNo, evidenceType, originalName) {
  const stamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd_HHmmss');
  const extMatch = String(originalName || '').match(/\.[A-Za-z0-9]{1,8}$/);
  const ext = extMatch ? extMatch[0] : '.png';
  return [stamp, sanitizeFilePartForWebhook_(contractNo), sanitizeFilePartForWebhook_(evidenceLabelForWebhook_(evidenceType))].join('_') + ext;
}

function sanitizeFilePartForWebhook_(value) {
  return clean_(value)
    .replace(/[\\/:*?"<>|#%{}^~\[\]`]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'file';
}

function stripBase64Prefix_(value) {
  const text = String(value || '').trim();
  const marker = 'base64,';
  const index = text.indexOf(marker);
  return index > -1 ? text.slice(index + marker.length) : text;
}

function webhookLog_(action, target, count, status, note) {
  try {
    const sheet = getWorkbook_().getSheetByName(LOG_SHEET) || getWorkbook_().insertSheet(LOG_SHEET);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
    }
    sheet.appendRow([
      Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss'),
      action || '',
      target || '',
      count || 0,
      status || '',
      note || ''
    ]);
  } catch (err) {
    // ไม่ให้ log error ทำให้การบันทึกหลักล้มเหลว
  }
}

function testWebhookConfig() {
  const ss = getWorkbook_();
  const folderTests = Object.keys(DRIVE_FOLDER_IDS).map(function (type) {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_IDS[type]);
    return type + ': ' + folder.getName();
  });

  const message =
    'Webhook พร้อมใช้งาน ✅\n\n' +
    'Sheet: ' + ss.getName() + '\n' +
    'Spreadsheet ID: ' + ss.getId() + '\n\n' +
    'Drive folders:\n' + folderTests.join('\n');

  Logger.log(message);
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (err) {}
  return message;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function clean_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}