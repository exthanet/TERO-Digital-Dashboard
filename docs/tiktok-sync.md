# TikTok Daily Sync

ระบบดึงคลิป TikTok ทั้งหมดของบัญชีที่อนุญาตผ่าน TikTok Display API แล้วสร้างไฟล์รายวันใน `data/tiktok/`

## ตั้งค่าครั้งเดียว

เพิ่ม GitHub Actions Secrets ใน repository:

- `TIKTOK_ACCESS_TOKEN` ใช้แบบง่ายสำหรับทดสอบ
- หรือใช้ชุดที่แนะนำสำหรับงานจริง: `TIKTOK_REFRESH_TOKEN`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`

แอป TikTok ต้องได้รับ scope `video.list` และบัญชีต้องอนุญาตให้แอปอ่านรายการวิดีโอ

## การทำงาน

- Workflow: `.github/workflows/tiktok-sync.yml`
- ตั้งเวลารันทุกวันเวลา 09:15 น. ประเทศไทย
- ดึงทีละ 20 รายการและวน cursor จนครบ
- สร้างไฟล์:
  - `data/tiktok/tiktok-content-latest.xlsx`
  - `data/tiktok/tiktok-content-latest.csv`
  - `data/tiktok/tiktok-content-latest.json`
- Commit ไฟล์กลับเข้า branch `main`
- หากต้องการทดสอบทันที ให้เปิด GitHub Actions แล้วกด Run workflow

## หมายเหตุข้อมูล

API คืนค่าจำนวน Views/Likes/Comments/Shares ณ เวลาที่ดึงข้อมูล ระบบจึงเก็บเป็น daily snapshot ไม่ใช่ประวัติย้อนหลังที่ TikTok ไม่ได้ส่งออกมา
