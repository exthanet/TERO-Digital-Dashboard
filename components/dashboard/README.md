# Dashboard Components

อ่าน [คู่มือโครงสร้างภาษาไทย](../../docs/PROJECT_STRUCTURE_TH.md) สำหรับตารางเลือกไฟล์ที่ต้องแก้

- `sections/` — ส่วนต่าง ๆ ของหน้าจอ เช่น ตัวกรอง KPI กราฟ ตาราง และหน้าต่างนำเข้า
- `shared/` — การ์ด ตัวเลือก สถานะว่าง และหัวตารางที่ใช้ร่วมกัน
- `charts/` — Tooltip และกราฟวงกลมที่ใช้ร่วมกัน
- `AffiliateReport.tsx` — รายงาน Affiliate Program
- `TvRatingChoropleth.tsx` — แผนที่ Rating ตาม Audience Zone

State และคำสั่งต่าง ๆ อยู่ใน `hooks/useDashboard.ts` ส่วน `app/dashboard.tsx` ประกอบหน้าจอจาก components เหล่านี้
