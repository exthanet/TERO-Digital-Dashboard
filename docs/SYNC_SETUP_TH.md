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

## ส่วนที่ 6: อ่านไฟล์ rating TV จาก SharePoint (Microsoft Graph)

ทำโดย**ผู้ดูแล Microsoft 365 (Global Admin)** ครั้งเดียว ระบบจะอ่านได้เฉพาะ site ที่อนุญาต ไม่ใช่ทุกไฟล์ในองค์กร

> แนะนำ: ย้ายไฟล์ rating ไปไว้ใน SharePoint site / Teams ของทีมก่อน (ไม่ใช่ OneDrive ส่วนตัว) ถ้าบัญชีเจ้าของไฟล์ถูกปิด sync จะหยุด

18. เปิด https://entra.microsoft.com → **Applications** → **App registrations** → **New registration**
    - Name: `TERO Dashboard Sync` · Supported account types: **Single tenant** · Redirect URI: เว้นว่าง → **Register**
19. หน้า Overview จด **Application (client) ID** และ **Directory (tenant) ID**
20. **Certificates & secrets** → **New client secret** (อายุ 24 เดือน) → จด **Value** ทันที (แสดงครั้งเดียว)
21. **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions** → เลือก `Sites.Selected` → **Add** → **Grant admin consent**
22. ให้สิทธิ์ "อ่าน" แก่แอปบน site ที่เก็บไฟล์ (ตัวอย่างด้วย PnP PowerShell):

    ```powershell
    Grant-PnPAzureADAppSitePermission -AppId <client-id> -DisplayName "TERO Dashboard Sync" -Site https://teroentertainment.sharepoint.com/sites/<site> -Permissions Read
    ```

    (OneDrive ส่วนตัวคือ site `https://teroentertainment-my.sharepoint.com/personal/<ชื่อ>`)
23. เพิ่ม GitHub secrets 3 ตัว: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
24. ใน dashboard: **เครื่องมือ admin** → **แหล่งข้อมูล TV** → เพิ่มแถวละ 1 แท็บ (ชื่อ, รายการ, ช่อง, ลิงก์ไฟล์, ชื่อแท็บ) → **บันทึก**

การทำงานของ TV sync (ตกลงกันไว้):
- ไฟล์เป็นเจ้าของเฉพาะ `TV_Rating_*` และ `TV_Audience_*` · Topic, Episode_ID และคอลัมน์อื่นที่ทีมกรอกไม่ถูกแก้ · เทปใหม่ใช้ประเด็นจากไฟล์
- Audience = rating × 700,000 ทุกเขต · Audience รวมของ One31 ใช้คอลัมน์ "Viewership (15+)" ถ้ามีค่า
- "งด" = ไม่ได้ออกอากาศ ข้าม · ช่องที่ยังไม่มีเรตติ้ง ข้ามไว้ก่อน เติมเองเมื่อไฟล์มีตัวเลข · แถว "เฉลี่ยเดือน" ไม่นำเข้า
- เทปเดียวกันหลายแถว (เช่น "ONE31" กับ "One31") รวมเป็นแถวเดียวเมื่อ rating ตรงกัน ถ้าไม่ตรงปล่อยไว้และแจ้งให้คนตรวจ
- ข้อมูลคู่แข่งเก็บแยกใน `tvCompetitors` (ไม่ปนกับ masterData)
- ตรวจเพิ่ม 5 ข้อ (12–16) ไม่ผ่านข้อใดข้อหนึ่ง = ไม่เขียนอะไรเลย · แท็บที่อ่านไม่ได้จะถูกข้ามและแจ้งในหน้า "แหล่งข้อมูล TV"

ทดสอบในเครื่องด้วยไฟล์ที่ดาวน์โหลดมา (ไม่ต้องใช้ Microsoft Graph):

```bash
node scripts/metricool-sync.mjs --since=2026-09-01 --baseline=firestore --tv-file="ไฟล์.xlsx"
```

## ส่วนที่ 7: อัปโหลดไฟล์ TV เอง (ใช้ได้ทันที ไม่ต้องตั้งค่า Microsoft)

1. dashboard → **เครื่องมือ admin** → **อัปโหลดไฟล์ TV** → เลือกไฟล์ rating (.xlsx)
2. ระบบอ่านเฉพาะแท็บที่ตั้งไว้ใน "แหล่งข้อมูล TV" (ในเบราว์เซอร์ แท็บอื่นไม่ถูกส่งขึ้น) แล้วแสดงผลให้ตรวจ: จำนวนเทป, เทปใหม่, rating ที่เปลี่ยน
3. กด **บันทึก** → รอบ sync ถัดไป (ประมาณ 05:17 น. หรือ GitHub → Run workflow) รวมเข้า masterData พร้อมตรวจ 5 ข้อ (12–16)
4. ถ้าตั้งค่า SharePoint (ส่วนที่ 6) แล้วด้วย ระบบใช้ข้อมูลที่ใหม่กว่า และใช้ไฟล์ที่อัปโหลดแทนเมื่ออ่าน SharePoint ไม่ได้

## ส่วนที่ 8: อีเมลแจ้งผลการ sync (Google Apps Script)

ทำครั้งเดียวในบัญชี Google ที่จะเป็นผู้ส่ง (เช่น terodigital@gmail.com) ไม่มีการเก็บรหัสผ่านอีเมลที่ไหน

25. เปิด https://script.google.com → **New project** → ลบโค้ดเดิม แล้ววางโค้ดจากไฟล์ `scripts/apps-script/notify.gs`
26. **Project Settings** (รูปเฟือง) → **Script Properties** → **Add script property**
    - Property: `NOTIFY_TOKEN` · Value: ข้อความสุ่มยาวๆ (เช่น 40 ตัวอักษร) จดไว้
27. **Deploy** → **New deployment** → เลือก type **Web app**
    - Execute as: **Me** · Who has access: **Anyone** → **Deploy** → อนุญาตสิทธิ์ส่งอีเมล (Google จะเตือนว่าแอปยังไม่ยืนยัน → Advanced → ไปต่อ)
    - copy **Web app URL**
28. GitHub secrets 2 ตัว: `NOTIFY_WEBHOOK_URL` = Web app URL · `NOTIFY_TOKEN` = ค่าจากข้อ 26
29. dashboard → **เครื่องมือ admin** → **การแจ้งเตือน** → ใส่อีเมลผู้รับ (สูงสุด 10) · เลือก "ทุกรอบ" หรือ "เฉพาะเมื่อมีปัญหา" → **บันทึก**
30. ทดสอบ: GitHub → Actions → **Data sync** → **Run workflow** → mode `test-email` → ควรได้อีเมล "🧪 อีเมลทดสอบ" ผลการส่งจะแสดงในหน้า "การแจ้งเตือน"

หมายเหตุ: Gmail ส่วนตัวส่งได้ประมาณ 100 ผู้รับต่อวัน (เกินพอสำหรับวันละ 1 ฉบับ) · ถ้าส่งไม่สำเร็จ sync ยังทำงานตามปกติ

## ทดสอบในเครื่อง (test-run)

```bash
node scripts/metricool-sync.mjs --since=2026-08-01
```

รันแบบนี้เป็น test-run เสมอ: ดึงข้อมูลจริงและสรุปผลใน `output/metricool-test-run/` แต่ไม่เขียน Firestore

ถ้าต้องการเทียบกับข้อมูลจริงใน Firestore (แทนไฟล์ `public/master-data.json`) ให้เก็บไฟล์ key ของ service account
(จากข้อ 7) ไว้ที่ `.secrets/firebase-sync.json` ในโฟลเดอร์โปรเจกต์ โฟลเดอร์ `.secrets/` อยู่ใน `.gitignore`

## รันอัตโนมัติ (GitHub Actions: `data-sync.yml`)

- รันเองทุกวัน **ประมาณ 05:17 น.** ดึงข้อมูลย้อนหลัง 90 วัน แล้วเขียนเข้า Firestore (GitHub อาจเริ่มช้ากว่ากำหนด ตั้งไม่ตรงชั่วโมงพอดีเพื่อลดการเลื่อน)
- สั่งรันเอง: dashboard → **สถานะการ Sync** → **รันตอนนี้** (หรือ GitHub → Actions → Data sync → **Run workflow**)
  เลือก `test-run` = ตรวจอย่างเดียว ไม่เขียน · ใส่ `since` ได้ถ้าต้องการดึงย้อนหลังไกลกว่า 90 วัน
- Secrets ที่ต้องมี: `FIREBASE_SERVICE_ACCOUNT`, `METRICOOL_API_TOKEN`, `METRICOOL_USER_ID`, `YOUTUBE_API_KEY`, (TV) `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, (อีเมล) `NOTIFY_WEBHOOK_URL`, `NOTIFY_TOKEN`
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
- **TV: "SharePoint 403/404"**: แอปยังไม่ได้รับสิทธิ์บน site นั้น (ข้อ 22) หรือลิงก์ผิด · ถ้าลิงก์แชร์ใช้กับ Graph ไม่ได้ ให้ใช้ลิงก์จากปุ่ม Copy link ของไฟล์ใน site ทีม
- **กุญแจหลุด**: กลับไปที่ `dashboard-sync` → KEYS → ลบ key นั้นทันที แล้วสร้างใหม่ตามข้อ 7–8

## การเก็บข้อมูล (ที่ตกลงกันไว้)

- `masterData`: ข้อมูลล่าสุดที่ dashboard อ่าน
- `snapshots/{YYYY-MM-DD}__{nn}`: ตัวเลขรายวันของแต่ละโพสต์ ไม่เขียนทับวันก่อน (รันซ้ำวันเดียวกันจะรวมเข้าด้วยกัน) เก็บย้อนหลัง **1 ปี**
  บันทึกเฉพาะโพสต์ที่ตัวเลขเปลี่ยนจากวันก่อน ใช้คำนวณยอดเพิ่มรายวัน/รายสัปดาห์
- Metricool อัปเดตเฉพาะตัวเลข (Views, Likes, Comments, Shares, Engagement)
  คอลัมน์ที่ทีมกรอก (Program, Topic, Topic_Type, VDO_Type, Episode_ID, Best_of_Month, Revenue, Notes) ไม่ถูกเขียนทับ
