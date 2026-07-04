# Backend Connection Map

## Core flow

```text
Browser → Express API → Apps Script Webhook → Google Sheet / Google Drive
```

## Main connections

| Feature | Browser trigger | Express API | Service | Apps Script action | Sheet / Drive |
|---|---|---|---|---|---|
| โหลดทุกหน้า | `loadAll()` | `GET /api/dashboard` | `dashboardService.getInitialData()` | `getValues` | อ่านทุกแท็บที่เกี่ยวข้อง |
| โหลดเคส | `loadAll()` / Refresh | `GET /api/approvals` | `approvalService.getRecordsRaw()` | `getValues` | `เคสอนุมัติประจำวัน❤️` |
| บันทึกเคส | Submit form | `POST /api/approvals` | `approvalService.saveRecord()` | `uploadEvidenceImage`, `appendValues`, `updateValues` | Sheet หลัก + Drive 3 โฟลเดอร์ |
| ลบเคส | Delete button | `DELETE /api/approvals/:contractNo` | `approvalService.deleteRecord()` | `deleteRecord` | ลบแถว + ย้ายรูปเข้า Trash |
| ร้านค้า/จังหวัด | Sync/Add shop | `GET/POST /api/shops` | `shopService` | `getValues`, `appendValues`, `updateValues` | `ร้านอยู่จังหวัดไหน` |
| พนักงาน | Employees page | `GET /api/employees` | `employeeService` | `getValues` | `สถานะพนักงาน` |
| สถิติรายวัน | Attendance API | `GET/POST /api/employees/attendance` | `employeeService` | `getValues`, `appendValues`, `updateValues` | `สถิติพนักงานรายวัน` |
| อัปเดตสถานะเคส | Summary action | `POST /api/reports/status` | `reportService.updateCaseStatuses()` | `updateValues` | column `สถานะเคส` |
| รายงานประจำวัน | Summary action | `POST /api/reports/daily` | `reportService.createDailyApprovalReport()` | `updateValues` | `รายการเคสอนุมัติประจำวัน` |
| ค่าคอม | Commission action | `GET/POST /api/reports/commission` | `reportService.calculateMonthlyCommission()` | `updateValues` | `Commission_ประจำเดือน`, `ตรวจเลขสัญญาซ้ำ` |

## Apps Script stays thin

Apps Script should not serve the UI anymore. It only exposes JSON actions:

- `getValues`
- `updateValues`
- `appendValues`
- `uploadEvidenceImage`
- `deleteRecord`
- `trashDriveFiles`

If `/exec` returns HTML, the deployment is wrong. It must return JSON.
