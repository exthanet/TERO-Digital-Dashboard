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

12. เพิ่ม repository secret อีก 2 ตัว (Metricool → Account settings → API):

| Secret | ค่า |
|---|---|
| `METRICOOL_API_TOKEN` | API token |
| `METRICOOL_USER_ID` | user id |

ไม่ต้องใส่ blog id: ระบบดึงรายชื่อ brand เอง และเลือก brand ที่จะดึงใน `config/metricool-brands.json`

## ส่วนที่ 5: YouTube Data API key (เติมคลิปที่ Metricool ไม่มี)

Metricool ไม่มีข้อมูล YouTube บางคลิป (ประมาณ 11% ในเดือน ส.ค.) และช้า 2–3 วัน
YouTube Data API ให้ยอดสะสมล่าสุดของทุกคลิป ฟรีวันละ 10,000 units (ระบบใช้ประมาณ 200)

13. Google Cloud Console (โปรเจกต์เดียวกัน) → **APIs & Services** → **Library** → ค้นหา **YouTube Data API v3** → **ENABLE**
14. **APIs & Services** → **Credentials** → **+ CREATE CREDENTIALS** → **API key**
15. กด **Edit API key** (หรือ Restrict key):
    - **API restrictions** → **Restrict key** → เลือก **YouTube Data API v3** อย่างเดียว → **Save**
16. เพิ่ม repository secret `YOUTUBE_API_KEY` = key ที่ได้
17. ทดสอบในเครื่อง: เปิด `.env.local` แล้วใส่ `YOUTUBE_API_KEY=...` ในบรรทัดใหม่

## ทดสอบในเครื่อง (test-run)

```bash
node scripts/metricool-sync.mjs --since=2026-08-01
```

รันแบบนี้เป็น test-run เสมอ: ดึงข้อมูลจริงและสรุปผลใน `output/metricool-test-run/` แต่ไม่เขียน Firestore

ถ้าต้องการเทียบกับข้อมูลจริงใน Firestore (แทนไฟล์ `public/master-data.json`) ให้เก็บไฟล์ key ของ service account
(จากข้อ 7) ไว้ที่ `.secrets/firebase-sync.json` ในโฟลเดอร์โปรเจกต์ โฟลเดอร์ `.secrets/` อยู่ใน `.gitignore`

## รันอัตโนมัติ (GitHub Actions: `data-sync.yml`)

- รันเองทุกวัน **06:00 น.** ดึงข้อมูลย้อนหลัง 90 วัน แล้วเขียนเข้า Firestore
- สั่งรันเอง: dashboard → **สถานะการ Sync** → **รันตอนนี้** (หรือ GitHub → Actions → Data sync → **Run workflow**)
  เลือก `test-run` = ตรวจอย่างเดียว ไม่เขียน · ใส่ `since` ได้ถ้าต้องการดึงย้อนหลังไกลกว่า 90 วัน
- Secrets ที่ต้องมี: `FIREBASE_SERVICE_ACCOUNT`, `METRICOOL_API_TOKEN`, `METRICOOL_USER_ID`, `YOUTUBE_API_KEY`
  และ `DISCORD_WEBHOOK_URL` (ไม่บังคับ: แจ้งเตือนเมื่อ sync ไม่สำเร็จ)

ทุกรอบที่เขียนข้อมูล ระบบจะ:
1. สำรอง masterData ไว้ใน `masterDataBackups` ก่อน (เก็บ 7 รอบล่าสุด)
2. ตรวจความถูกต้อง 11 ข้อ ถ้าไม่ผ่านข้อใดข้อหนึ่ง **จะไม่เขียนอะไรเลย**
3. เขียนแบบมีเงื่อนไข: ถ้ามีคนแก้ masterData ระหว่างรัน จะหยุด ไม่เขียนทับ
4. อ่านกลับมาตรวจ ถ้าไม่ตรง จะกู้คืนจากสำรองอัตโนมัติ
5. บันทึกรายงานใน `syncRuns` (เก็บ 90 วัน, admin เห็นในหน้า "สถานะการ Sync") และสถานะสั้นใน `syncStatus/latest`

กู้คืนเอง (ถ้าจำเป็น) ใช้ runId จากหน้า "สถานะการ Sync":

```bash
node scripts/metricool-sync.mjs --restore-backup=2026-09-30T08-14-25Z
```

หลังแก้ `firestore.rules` ต้อง deploy ครั้งเดียว: `firebase deploy --only firestore:rules`

## ปัญหาที่อาจเจอ

- **ข้อ 7 สร้าง key ไม่ได้** ("Service account key creation is disabled"): องค์กรห้ามสร้าง key
  ให้เปลี่ยนไปใช้ Workload Identity Federation (เชื่อม GitHub กับ Google แบบไม่ใช้ key)
- **กุญแจหลุด**: กลับไปที่ `dashboard-sync` → KEYS → ลบ key นั้นทันที แล้วสร้างใหม่ตามข้อ 7–8

## การเก็บข้อมูล (ที่ตกลงกันไว้)

- `masterData`: ข้อมูลล่าสุดที่ dashboard อ่าน
- `snapshots/{YYYY-MM-DD}__{nn}`: ตัวเลขรายวันของแต่ละโพสต์ ไม่เขียนทับวันก่อน (รันซ้ำวันเดียวกันจะรวมเข้าด้วยกัน) เก็บย้อนหลัง **1 ปี**
  บันทึกเฉพาะโพสต์ที่ตัวเลขเปลี่ยนจากวันก่อน ใช้คำนวณยอดเพิ่มรายวัน/รายสัปดาห์
- Metricool อัปเดตเฉพาะตัวเลข (Views, Likes, Comments, Shares, Engagement)
  คอลัมน์ที่ทีมกรอก (Program, Topic, Topic_Type, VDO_Type, Episode_ID, Best_of_Month, Revenue, Notes) ไม่ถูกเขียนทับ
