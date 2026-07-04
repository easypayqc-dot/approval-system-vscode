# EasyPay Approval Control Center — VS Code + Apps Script Webhook

โครงสร้างระบบเวอร์ชันนี้คือ

```text
Browser / localhost:3100
→ Express / Node.js บนเครื่องคุณ
→ Apps Script Webhook
→ Google Sheet เป็นฐานข้อมูล
→ Google Drive เก็บรูปหลักฐานแยก 3 โฟลเดอร์
```

## ไฟล์หลังบ้านที่เชื่อมแล้ว

| หน้าในเมนู | API ฝั่ง VS Code | Sheet/Drive ที่ใช้ |
|---|---|---|
| ภาพรวม | `GET /api/dashboard` | อ่านเคส + ร้านค้า + พนักงาน + ค่าคอม + เป้าหมาย |
| บันทึก/แก้ไขเคส | `GET/POST/DELETE /api/approvals` | แท็บ `เคสอนุมัติประจำวัน❤️` + Drive รูป 3 โฟลเดอร์ |
| ตารางสรุป | `GET /api/dashboard`, `POST /api/reports/status`, `POST /api/reports/daily` | อ่าน/อัปเดตสถานะ + เขียนรายงานรายวัน |
| Dashboard KPI | `GET /api/dashboard` | อ่านข้อมูลเคสและคำนวณ KPI |
| เสร็จสมบูรณ์ / รอปิดเคส | `GET /api/dashboard` | กรองข้อมูลจากเคสทั้งหมด |
| พนักงาน | `GET /api/employees`, `GET/POST /api/employees/attendance`, `POST /api/employees/status` | แท็บ `สถานะพนักงาน`, `สถิติพนักงานรายวัน` |
| เป้าหมายระบบ | `GET /api/dashboard` | คำนวณยอดตามระบบ MV/CSR/BN/ECR/KK |
| ร้านค้า Top Sale | `GET/POST /api/shops` | แท็บ `ร้านอยู่จังหวัดไหน` |
| รายงานค่าคอม | `GET/POST /api/reports/commission` | แท็บ `Commission_ประจำเดือน`, `ตรวจเลขสัญญาซ้ำ` |
| Top 10 Ranking | `GET /api/dashboard` | คำนวณจากรายการเคสทั้งหมด |

## ตั้งค่า .env

อย่าใช้ `service-account.json` ในเวอร์ชันนี้ ให้ใช้ Apps Script Web App URL เท่านั้น

```env
PORT=3100
HOST=0.0.0.0

APPS_SCRIPT_WEBAPP_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
APPS_SCRIPT_WEBAPP_TOKEN=APPROVAL_PHASE1_SECRET
APPS_SCRIPT_WEBAPP_TIMEOUT_MS=30000
```

## Apps Script

เอาไฟล์นี้ไปวางใน Apps Script:

```text
apps-script/Code.gs
```

จากนั้น Deploy ใหม่:

```text
Deploy → Manage deployments → Edit → Version: New version → Deploy
```

ตั้งค่า Web App:

```text
Execute as: Me
Who has access: Anyone หรือ Anyone with the link
```

เปิด URL `/exec` ต้องได้ JSON ประมาณนี้:

```json
{"ok":true,"app":"Approval Phase 1 Apps Script Webhook"}
```

## รันระบบ

```powershell
npm.cmd install
npm.cmd run check
npm.cmd start
```

เปิด:

```text
http://localhost:3100
```

## หมายเหตุ

- Google Drive Folder ID อยู่ใน `apps-script/Code.gs`
- รูปหลักฐานถูกอัปโหลดเข้า Drive ผ่าน Apps Script
- ลบเคสจะลบแถวใน Sheet และย้ายรูปใน Drive เข้า Trash
- ถ้า error `Apps Script response is not JSON` ให้เช็กว่า `.env` ใช้ URL `/exec` ล่าสุด และ URL นั้นเปิดแล้วได้ JSON
