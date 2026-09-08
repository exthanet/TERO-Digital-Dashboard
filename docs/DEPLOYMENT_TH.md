# คู่มือ Build และ Deploy

## ขั้นตอนตรวจสอบ
1. รัน `npm ci`
2. รัน `npm test`
3. ตรวจ `git status` ว่าไม่มีไฟล์ลับหรือ `.env` ติดไป

## Environment
ค่าลับของ YouTube, Meta, TikTok, Metricool และ Database ต้องอยู่ใน Server Environment เท่านั้น ห้ามใส่ใน `public/` หรือ commit ลง Git

## Privacy
Repository สำหรับ source code ต้องตั้งเป็น Private และห้ามใส่ access token ใน remote URL, source code, log หรือ documentation
