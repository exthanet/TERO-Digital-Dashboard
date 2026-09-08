# โครงสร้างไฟล์และคู่มือแก้ไข TERO Digital Dashboard

## เริ่มจากไฟล์ไหน

`app/page.tsx` เปิด Dashboard และ `app/dashboard.tsx` ประกอบส่วนต่าง ๆ ของหน้าจอ ส่วน state, ตัวกรอง, การคำนวณ และคำสั่งนำเข้าอยู่ใน `hooks/useDashboard.ts`

| ต้องการแก้                                          | ไฟล์                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| ลำดับส่วนต่าง ๆ ของหน้า                             | `app/dashboard.tsx`                                                            |
| เมนูด้านซ้าย                                        | `components/dashboard/sections/DashboardSidebar.tsx`                           |
| ตัวกรอง รายการ วันที่ แพลตฟอร์ม และคำค้น            | `components/dashboard/sections/DashboardFilters.tsx`                           |
| แหล่งข้อมูลและข้อความสถานะ                          | `components/dashboard/sections/DataStatus.tsx`                                 |
| KPI สรุป                                            | `components/dashboard/sections/KpiSummary.tsx`                                 |
| Executive Insights และ Analysis                     | `components/dashboard/sections/ExecutiveInsights.tsx`, `ExecutiveAnalysis.tsx` |
| กราฟภาพรวม TV เทียบ Digital                         | `components/dashboard/sections/ExecutiveCharts.tsx`                            |
| กราฟรายวัน รายการ แพลตฟอร์ม และ Top Content         | `components/dashboard/sections/PerformanceSections.tsx`                        |
| ตารางเปรียบเทียบ การเรียงและเปลี่ยนหน้า             | `components/dashboard/sections/CompareTable.tsx`                               |
| หน้าต่างนำเข้า Excel/CSV และ Google Sheets          | `components/dashboard/sections/DataSourceModal.tsx`                            |
| หน้าต่างสถานะ API Sync                              | `components/dashboard/sections/IntegrationsModal.tsx`                          |
| Affiliate และ TV Zone Map                           | `components/dashboard/AffiliateReport.tsx`, `TvRatingChoropleth.tsx`           |
| การ์ด ตัวเลือก สถานะว่าง หัวตาราง                   | `components/dashboard/shared/`                                                 |
| Tooltip และกราฟวงกลมที่ใช้ร่วมกัน                   | `components/dashboard/charts/`                                                 |
| state, การกรองข้อมูล, สูตร KPI, การนำเข้าและ export | `hooks/useDashboard.ts`                                                        |
| ชนิดข้อมูลและคอลัมน์                                | `lib/dashboard/types.ts`                                                       |
| ชื่อรายการ สีกราฟ และรายชื่อค่าตั้งค่า API          | `lib/dashboard/constants.ts`                                                   |
| แปลงข้อมูลต้นฉบับและชื่อคอลัมน์                     | `lib/dashboard/normalize.ts`                                                   |
| แปลง CSV                                            | `lib/dashboard/csv.ts`                                                         |
| รูปแบบตัวเลขและวันที่ที่แสดง                        | `lib/dashboard/format.ts`                                                      |
| ช่วงวันที่สำเร็จรูป                                 | `lib/dashboard/dates.ts`                                                       |
| รวมยอด จับคู่หัวข้อ และเลือกรูปแบบที่ได้ผล          | `lib/dashboard/analytics.ts`                                                   |
| สีพื้นฐานและ Tailwind theme                         | `styles/theme.css`                                                             |
| Layout และหน้าตา Dashboard หลัก                     | `styles/dashboard.css`                                                         |
| Affiliate, TV Map และการปรับขนาดรายงาน              | `styles/reports.css`                                                           |
| Animation และ scrolling utilities                   | `styles/utilities.css`                                                         |
| ลำดับโหลด CSS                                       | `app/globals.css`                                                              |
| ข้อมูลเริ่มต้น                                      | `public/master-data.json`, `public/affiliate-data.json`                        |
| API ฝั่งเซิร์ฟเวอร์                                 | `app/api/`                                                                     |

## หลักการแยกไฟล์

- `app/dashboard.tsx` ประกอบหน้าจอและส่งค่าจาก hook ไปให้แต่ละส่วน
- Component รับ props แบบ `Pick<DashboardModel, ...>` ทำให้รู้ว่าต้องใช้ค่าใดจาก hook และ TypeScript ตรวจการเปลี่ยนชื่อให้ได้
- `hooks/useDashboard.ts` เป็นศูนย์กลาง state และการกระทำ เพื่อให้ตัวกรองทุกส่วนทำงานร่วมกัน
- `lib/dashboard/` เก็บฟังก์ชันที่ไม่ผูกกับหน้าจอและทดสอบแยกได้
- `components/ui/` เป็นชุด UI พื้นฐาน หากแก้เฉพาะรายงาน ให้เริ่มจาก `components/dashboard/`
- คง URL, section ID, นิยาม metric และไฟล์ข้อมูลเดิมไว้ การจัดโครงสร้างครั้งนี้ไม่เปลี่ยนสูตรวิเคราะห์

## รันและทดสอบ

ใช้ Node.js ตาม `package.json` แล้วรันจากโฟลเดอร์โปรเจกต์:

```sh
npm ci
npm run dev
npm test
```

`npm test` จะ build ก่อน แล้วทดสอบผล HTML, UI พื้นฐาน และการแปลง/รวมข้อมูล ส่วน `npm run build` ใช้ตรวจ build อย่างเดียว

คำสั่ง dev และ build รองรับ Windows โดยเรียก Node โดยตรง ส่วน Linux/Sites ยังคงใช้สคริปต์ bounded build เดิม แนะนำเก็บโปรเจกต์บน Windows ในพาธสั้น ๆ เช่น `C:\Projects\TERO-Digital-Dashboard` เพราะ dependency บางตัวมี postinstall ที่ไม่รองรับอักขระ `&` ในชื่อโฟลเดอร์

## ส่งการแก้ไขขึ้น GitHub

1. แก้ไฟล์ตามตารางด้านบน
2. รัน `npm test`
3. ตรวจ diff และไม่เพิ่ม `.env`, token, ไฟล์ credentials, `node_modules`, `dist` หรือ `work`
4. Commit และ push ไป repository `exthanet/TERO-Digital-Dashboard`
5. ตรวจ Dashboard CI ในแท็บ Actions และรักษา repository เป็น Private

GitHub เก็บ source code ส่วนการเผยแพร่เว็บ Sites เป็นอีกขั้นตอนหนึ่ง ไม่ควรเปลี่ยนเป็น GitHub Pages หรือเปลี่ยนสิทธิ์เว็บโดยอัตโนมัติ
