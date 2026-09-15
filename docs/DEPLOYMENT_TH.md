# คู่มือ Build และ Deploy

## ขั้นตอนตรวจสอบ
1. รัน `npm ci`
2. รัน `npm test`
3. ตรวจ `git status` ว่าไม่มีไฟล์ลับหรือ `.env` ติดไป

## Environment
ค่าลับของ YouTube, Meta, TikTok, Metricool และ Database ต้องอยู่ใน Server Environment เท่านั้น ห้ามใส่ใน `public/` หรือ commit ลง Git

## Docker และบัญชี admin
1. คัดลอก `.env.example` เป็น `.env` แล้วตั้ง `ADMIN_USERNAME` และ `ADMIN_PASSWORD` (อย่างน้อย 6 ตัวอักษร)
2. รัน `docker compose up -d --build` แล้วเปิด `http://localhost:8080`
3. เปลี่ยนรหัสผ่าน: แก้ `.env` แล้วรัน `docker compose up -d` ไม่ต้อง build ใหม่

ตอน container start จะสร้าง `/runtime-config` ที่มีเฉพาะ hash ของรหัสผ่าน เมื่อค่าใน `.env` เปลี่ยน บัญชี admin ในทุก browser จะถูกรีเซ็ตเป็นค่าใหม่ในการเปิดครั้งถัดไป

ไฟล์นี้ตั้งใจไม่ใส่นามสกุล `.js` เพราะ Cloudflare จะให้ browser cache ไฟล์ `.js` นาน 4 ชั่วโมง ทำให้รหัสใหม่ใช้ไม่ได้ในเครื่องที่เคยเปิดเว็บ ห้ามเปลี่ยนกลับ

build ที่ไม่มี `/runtime-config` เช่น GitHub Pages จะไม่มีบัญชี admin ตั้งต้น

## Privacy
Repository สำหรับ source code ต้องตั้งเป็น Private และห้ามใส่ access token ใน remote URL, source code, log หรือ documentation
