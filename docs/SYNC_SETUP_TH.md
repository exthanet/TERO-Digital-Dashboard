# ตั้งค่าระบบ Sync ข้อมูลอัตโนมัติ (Service Account + Secrets)

ระบบ sync รันบน GitHub Actions ทุกวัน ดึงข้อมูลจาก Metricool และ Google Sheet ของ Nielsen
แล้วเขียนเข้า Firestore ต้องมี **service account** (บัญชีสำหรับโปรแกรม) และค่า secret ใน GitHub

ใช้บัญชีเฉพาะที่มีสิทธิ์แค่อ่าน/เขียน Firestore ไม่ใช้บัญชี admin ที่ Firebase สร้างให้ (สิทธิ์กว้างเกินไป)

## ส่วนที่ 1: สร้าง service account (Google Cloud Console)

1. เปิด https://console.cloud.google.com แล้ว login ด้วยบัญชีเจ้าของโปรเจกต์ Firebase
2. แถบบน เลือกโปรเจกต์ **entertainment-dashboard-733e5**
3. เมนูซ้าย → **IAM & Admin** → **Service Accounts**
4. กด **+ CREATE SERVICE ACCOUNT**
   - Service account name: `dashboard-sync`
   - Description: `Daily data sync from GitHub Actions`
   - กด **CREATE AND CONTINUE**
5. **Grant this service account access to project** → Select a role → ค้นหา **Cloud Datastore User** แล้วเลือก
   (สิทธิ์อ่าน/เขียน Firestore อย่างเดียว) → **CONTINUE** → **DONE**
6. จดอีเมลของบัญชีไว้ รูปแบบ `dashboard-sync@entertainment-dashboard-733e5.iam.gserviceaccount.com`
   (ใช้แชร์ Google Sheet ในส่วนที่ 3)

## ส่วนที่ 2: สร้างกุญแจและใส่ใน GitHub

7. ในรายการ Service Accounts คลิก `dashboard-sync` → แท็บ **KEYS** → **ADD KEY** → **Create new key** → **JSON** → **CREATE**
   เบราว์เซอร์จะดาวน์โหลดไฟล์ `.json` ซึ่งเป็น**กุญแจ** ใครได้ไปจะเขียนข้อมูลเข้า Firestore ได้
8. เปิด https://github.com/exthanet/TERO-Digital-Dashboard → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: เปิดไฟล์ `.json` ด้วย Notepad แล้ว copy เนื้อหา**ทั้งหมด** (ตั้งแต่ `{` ถึง `}`) มาวาง
   - กด **Add secret**
9. ลบไฟล์ `.json` ออกจากเครื่อง (รวมถึงถังขยะ) หรือเก็บใน password manager
   **ห้ามส่งทางแชท/อีเมล และห้าม commit เข้า Git** (repo นี้เป็น public)

## ส่วนที่ 3: เปิดการอ่าน Google Sheet (Nielsen)

10. Google Cloud Console → **APIs & Services** → **Library** → ค้นหา **Google Sheets API** → **ENABLE**
11. เปิด Google Sheet ของ Nielsen → **Share** → ใส่อีเมลจากข้อ 6 → สิทธิ์ **Viewer** →
    ยกเลิกติ๊ก "Notify people" → **Share**
    ไม่ต้องตั้งลิงก์เป็นสาธารณะ

## ส่วนที่ 4: ค่า Metricool (ที่เดียวกับข้อ 8)

12. เพิ่ม repository secret อีก 3 ตัว (Metricool → Account settings → API):

| Secret | ค่า |
|---|---|
| `METRICOOL_API_TOKEN` | API token |
| `METRICOOL_USER_ID` | user id |
| `METRICOOL_BLOG_ID` | id ของ brand ถกไม่เถียง |

## ปัญหาที่อาจเจอ

- **ข้อ 7 สร้าง key ไม่ได้** ("Service account key creation is disabled"): องค์กรห้ามสร้าง key
  ให้เปลี่ยนไปใช้ Workload Identity Federation (เชื่อม GitHub กับ Google แบบไม่ใช้ key)
- **กุญแจหลุด**: กลับไปที่ `dashboard-sync` → KEYS → ลบ key นั้นทันที แล้วสร้างใหม่ตามข้อ 7–8

## การเก็บข้อมูล (ที่ตกลงกันไว้)

- `masterData`: ข้อมูลล่าสุดที่ dashboard อ่าน
- `snapshots/{YYYY-MM-DD}`: ตัวเลขรายวันของแต่ละโพสต์ ไม่เขียนทับ เก็บย้อนหลัง **1 ปี**
  บันทึกเฉพาะโพสต์ที่ตัวเลขเปลี่ยนจากวันก่อน ใช้คำนวณยอดเพิ่มรายวัน/รายสัปดาห์
- Metricool อัปเดตเฉพาะตัวเลข (Views, Likes, Comments, Shares, Engagement)
  คอลัมน์ที่ทีมกรอก (Program, Topic, Topic_Type, VDO_Type, Episode_ID, Best_of_Month, Revenue, Notes) ไม่ถูกเขียนทับ
