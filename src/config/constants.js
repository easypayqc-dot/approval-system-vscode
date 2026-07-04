'use strict';

const SHEETS = {
  MAIN: 'เคสอนุมัติประจำวัน❤️',
  SHOPS: 'ร้านอยู่จังหวัดไหน',
  LOG: 'ImportLog',
  DAILY_REPORT: 'รายการเคสอนุมัติประจำวัน',
  COMMISSION: 'Commission_ประจำเดือน',
  DUPLICATE: 'ตรวจเลขสัญญาซ้ำ',
  EMPLOYEE_STATUS: 'สถานะพนักงาน',
  ATTENDANCE: 'สถิติพนักงานรายวัน'
};

const HEADERS = [
  'วันที่', 'เดือน', 'อนุมัติใบสินเชื่อ', 'อนุมัติเอกสาร', 'อนุมัติปิดเคส',
  'ร้านค้า', 'จังหวัด', 'เลขสัญญา', 'ราคาสินค้า', 'หมายเหตุ', 'สถานะเคส',
  'หลักฐานใบสินเชื่อ', 'หลักฐานเอกสาร', 'หลักฐานปิดเคส',
  'เวลารับเคส', 'เวลาอนุมัติใบสินเชื่อ', 'เวลาอนุมัติเอกสาร', 'เวลาปิดเคส',
  'SLA นาที', 'ผล SLA', 'TAT นาที'
];

const SHOP_HEADERS = ['ร้านค้า', 'จังหวัด'];
const LOG_HEADERS = ['วันที่เวลา', 'Action', 'เลขสัญญา', 'จำนวนข้อมูล', 'สถานะ', 'หมายเหตุ'];
const DAILY_REPORT_HEADERS = ['วันที่', 'เลขที่สัญญา', 'อนุมัติใบสินเชื่อ', 'อนุมัติเอกสาร', 'อนุมัติปิดเคส', 'สถานะเคส', 'หมายเหตุ', 'ผล SLA', 'TAT นาที'];
const COMMISSION_HEADERS = ['พนักงาน', 'อนุมัติใบสินเชื่อ', 'อนุมัติเอกสาร', 'อนุมัติปิดเคส', 'รวมงาน', 'ค่าคอมรวม (บาท)', 'KPI'];
const DUPLICATE_HEADERS = ['เลขที่สัญญา', 'ประเภทงาน', 'ผู้ทำรายการ', 'วันที่', 'แถวต้นทาง'];
const EMPLOYEE_STATUS_HEADERS = ['พนักงาน', 'สถานะ', 'วันที่อัปเดต'];
const ATTENDANCE_HEADERS = ['วันที่', 'พนักงาน', 'สถานะ', 'หมายเหตุ', 'วันที่เวลาอัปเดต'];

const EMPLOYEE_STATUS_OPTIONS = ['ปฏิบัติงาน', 'หยุด', 'ลา', 'ลาป่วย'];
const EMPLOYEE_STATUS_DEFAULT = 'ปฏิบัติงาน';
const CASE_STATUS_OPTIONS = ['เสร็จสมบูรณ์', 'อนุมัติ-รอปิดเคส'];
const SLA_RESULT_OPTIONS = ['RUNNING', 'PASS', 'FAIL'];

const RATES = { loan: 2.50, doc: 2.50, close: 5.00 };
const TARGETS = { MV: 1500000, CSR: 1500000, BN: 500000, ECR: 100000, KK: 300000 };
const SYSTEMS = ['MV', 'CSR', 'BN', 'ECR', 'KK'];
const SLA_MINUTES = 20;

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

module.exports = {
  SHEETS,
  HEADERS,
  SHOP_HEADERS,
  LOG_HEADERS,
  DAILY_REPORT_HEADERS,
  COMMISSION_HEADERS,
  DUPLICATE_HEADERS,
  EMPLOYEE_STATUS_HEADERS,
  ATTENDANCE_HEADERS,
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYEE_STATUS_DEFAULT,
  CASE_STATUS_OPTIONS,
  SLA_RESULT_OPTIONS,
  RATES,
  TARGETS,
  SYSTEMS,
  SLA_MINUTES,
  EMPLOYEES
};
