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

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<รหัสจริง อย่างน้อย 6 ตัว>
```

แก้ค่าแล้วต้องกด Redeploy

## ⚠️ ความปลอดภัย

- เว็บเปิดสาธารณะโดยไม่ใช้ Cloudflare Access login ในเว็บเป็นแค่ฝั่ง browser
  `https://digital-dashboard.terodigital.com/master-data.json` และ `affiliate-data.json` (มี Revenue) ใครมี URL ก็โหลดได้
- repo `exthanet/TERO-Digital-Dashboard` เป็น Public ข้อมูลชุดเดียวกันอยู่ใน Git ด้วย
- หน้า admin ของ Dokploy (`dokploy.terodigital.com`) เปิดสู่ internet ควรใช้รหัสแข็งแรงและเปิด 2FA

## ใช้งานประจำวัน

- deploy: merge PR เข้า `main`
- deploy เอง: Actions → *Deploy dashboard* → **Run workflow** หรือกด Deploy ใน Dokploy
- rollback: `git revert <commit>` แล้ว push เข้า `main`
- ดู log: Dokploy → แอป → Logs / Deployments
