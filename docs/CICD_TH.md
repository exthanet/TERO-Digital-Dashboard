# CI/CD ด้วย GitHub Actions + Dokploy

## ภาพรวม

| Workflow | ทำงานเมื่อ | ทำอะไร |
|---|---|---|
| `ci.yml` | เปิด Pull Request เข้า `main` | `npm test` + ทดสอบ `docker build` + แจ้ง Discord |
| `deploy.yml` | push เข้า `main` หรือกดรันเอง | `npm test` → สั่ง Dokploy build/deploy → รอผล → เช็ก `/healthz` → แจ้ง Discord |

เส้นทาง:

```
GitHub Actions ──API──> dokploy.terodigital.com (Dokploy บน dockerlab 192.168.10.113)
                              │ clone main + docker build (Dockerfile ใน repo)
                              ▼
ผู้ใช้ ──> Cloudflare ──tunnel──> Traefik ──> container :8080
          digital-dashboard.terodigital.com
```

- Dokploy clone `main` ล่าสุดตอน build ถ้ามี push ซ้อนระหว่างรอ อาจได้ commit ที่ใหม่กว่าที่ test ผ่าน
- ถ้า deploy ล้มเหลว Dokploy จะคง container เดิมไว้ ไม่มีช่วงที่เว็บดับ

## ค่าที่ต้องตั้งใน GitHub

Settings → Secrets and variables → Actions

| ชื่อ | ประเภท | ค่า |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | Secret | Discord webhook (ตั้งแล้ว) |
| `DOKPLOY_API_KEY` | Secret | Dokploy → Settings → Profile → API/CLI → Generate |
| `DOKPLOY_URL` | Variable | `https://dokploy.terodigital.com` |
| `DOKPLOY_APPLICATION_ID` | Variable | id ของแอปใน Dokploy (อยู่ใน URL หน้าแอป) |

## ค่าที่ตั้งใน Dokploy (Environment ของแอป)

ไม่ต้องตั้งค่าใด ๆ บัญชีผู้ใช้ย้ายไป Firebase Authentication แล้ว ([USERS_TH.md](USERS_TH.md))
ค่า `ADMIN_USERNAME` / `ADMIN_PASSWORD` เดิมไม่ถูกใช้แล้ว ลบออกได้

## ⚠️ ความปลอดภัย

- เว็บเปิดสาธารณะโดยไม่ใช้ Cloudflare Access ข้อมูลใน Firestore อ่านได้เฉพาะผู้ที่ login แล้ว (`firestore.rules`) แต่ไฟล์ใน `public/` ยังเปิดอยู่
  ไฟล์ข้อมูล `master-data.json`, `affiliate-data.json` และ `youtube-revenue.json` ไม่ได้ขึ้นเว็บแล้ว (ตั้งแต่ ต.ค. 2569):
  หน้า Performance, Revenue และ Affiliate อ่านจาก Firestore เท่านั้น ไฟล์เก็บไว้ในเครื่องที่โฟลเดอร์ `data/` (อยู่ใน `.gitignore`)
  และ `nginx.conf` ตอบ 404 ถ้ามีไฟล์ชื่อเหล่านี้หลุดเข้ามาใน build
- repo `exthanet/TERO-Digital-Dashboard` เป็น Public ข้อมูลชุดเดียวกันอยู่ใน Git ด้วย
- หน้า admin ของ Dokploy (`dokploy.terodigital.com`) เปิดสู่ internet ควรใช้รหัสแข็งแรงและเปิด 2FA

## ใช้งานประจำวัน

- deploy: merge PR เข้า `main`
- deploy เอง: Actions → *Deploy dashboard* → **Run workflow** หรือกด Deploy ใน Dokploy
- rollback: `git revert <commit>` แล้ว push เข้า `main`
- ดู log: Dokploy → แอป → Logs / Deployments
