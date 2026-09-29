# คู่มือ Build และ Deploy

## ขั้นตอนตรวจสอบ
1. รัน `npm ci`
2. รัน `npm test`
3. ตรวจ `git status` ว่าไม่มีไฟล์ลับหรือ `.env` ติดไป

## Environment
ค่าลับของ YouTube, Meta, TikTok, Metricool และ Database ต้องอยู่ใน Server Environment เท่านั้น ห้ามใส่ใน `public/` หรือ commit ลง Git

## Docker
รัน `docker compose up -d --build` แล้วเปิด `http://localhost:8080`

## บัญชีผู้ใช้และ Firestore rules
บัญชีอยู่ใน Firebase Authentication ดูวิธีตั้ง admin และจัดการผู้ใช้ที่ [USERS_TH.md](USERS_TH.md)

`firestore.rules` ไม่ได้ deploy ไปกับ Docker ต้อง deploy แยก:

```bash
firebase deploy --only firestore:rules
```

ลำดับเมื่อเปลี่ยนทั้งแอปและ rules: ตั้ง admin ใน Console → deploy แอป → deploy rules

## Privacy
Repository สำหรับ source code ต้องตั้งเป็น Private และห้ามใส่ access token ใน remote URL, source code, log หรือ documentation
