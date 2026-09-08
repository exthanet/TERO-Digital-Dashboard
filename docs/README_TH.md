# คู่มือ TERO Digital Dashboard (ภาษาไทย)

คู่มือเลือกไฟล์ที่ต้องแก้: [โครงสร้างโปรเจกต์ภาษาไทย](PROJECT_STRUCTURE_TH.md)

## ภาพรวม

โปรเจกต์นี้เป็น React/Vinext Dashboard สำหรับวิเคราะห์ Performance ของรายการ TV และ Digital Platform รวมถึง Affiliate Program Report

## โครงสร้างไฟล์

- `app/dashboard.tsx` — ประกอบส่วนต่าง ๆ ของหน้าจอ
- `hooks/useDashboard.ts` — state, ตัวกรอง และคำสั่งจัดการข้อมูล
- `lib/dashboard/` — ชนิดข้อมูล สูตรคำนวณ และการแปลงข้อมูล
- `app/globals.css` — ลำดับนำเข้า CSS จาก `styles/`
- `components/dashboard/` — แยกเป็น sections, shared, charts รวมถึง Affiliate และ TV Zone Map
- `public/master-data.json` — ข้อมูล Performance หลัก
- `public/affiliate-data.json` — ข้อมูล Affiliate ที่พร้อมใช้ในเว็บ
- `scripts/` — สคริปต์รวม/แปลงข้อมูล
- `docs/` — คู่มือและ Data Dictionary

## รันในเครื่อง

`npm install` แล้วรัน `npm run dev` จากนั้นเปิด `http://localhost:5173`

## ตรวจสอบก่อนส่งงาน

รัน `npm test` เพื่อ Build โปรเจกต์และรัน UI tests ทั้งหมด

## อัปเดต Affiliate Data

KPI ใช้แถว `Total` จากไฟล์ต้นฉบับ ส่วน Content/Product table เป็นรายการ Top 500 และต้องดู Coverage ประกอบเสมอ สคริปต์หลักคือ `scripts/build-affiliate-data.cjs`

## TV Rating Zone Map

ระบบใช้ Segment ที่มีอยู่จริง ได้แก่ BKK, Urban, BKK & Urban และ Rural สีเข้มหมายถึง Rating สูงกว่า โซน BKK/Urban อาจทับซ้อนกันตามนิยามต้นฉบับ จึงห้ามนำไปบวกเป็นประชากรรวมโดยตรง

## หลักการแก้ไขโค้ด

- แก้ลำดับ UI ที่ `app/dashboard.tsx` และเนื้อหาแต่ละส่วนที่ `components/dashboard/sections/`
- แก้ Affiliate ที่ `components/dashboard/AffiliateReport.tsx`
- แก้แผนที่ TV ที่ `components/dashboard/TvRatingChoropleth.tsx`
- แก้สี/spacing/layout ที่ `styles/`
- ก่อน commit ทุกครั้งให้รัน `npm test`
