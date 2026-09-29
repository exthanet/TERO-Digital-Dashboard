# คู่มือจัดการผู้ใช้ (Firebase Authentication)

บัญชีผู้ใช้เก็บใน Firebase Authentication ของโปรเจกต์ `entertainment-dashboard-733e5`
login ด้วย **อีเมล + รหัสผ่าน** ได้จากทุกเครื่อง ส่วนสิทธิ์ (role) เก็บใน Firestore ที่ `users/{uid}`

| role | ทำอะไรได้ |
|---|---|
| `viewer` | ดู dashboard ทุกหน้า เปลี่ยนรหัสผ่านตัวเอง |
| `admin` | ทุกอย่างของ viewer + นำเข้า/บันทึกข้อมูลขึ้น Cloud + จัดการผู้ใช้ + ดูประวัติการเข้าใช้ |

สิทธิ์ถูกบังคับที่ `firestore.rules` (ฝั่ง server) ไม่ใช่แค่ซ่อนปุ่มในหน้าเว็บ

## ตั้ง admin คนแรก (ทำครั้งเดียวใน Firebase Console)

1. Authentication → Users → **Add user** ใส่อีเมลจริงและรหัสผ่านของ admin
2. คัดลอก **User UID** ของบัญชีที่เพิ่งสร้าง
3. Firestore Database → Start collection `users` (หรือเปิด collection ที่มีอยู่) → **Add document**
   - Document ID: วาง UID จากข้อ 2
   - fields (ใส่ให้ตรงชื่อและชนิด ห้ามมี field อื่น):

     | field | type | value |
     |---|---|---|
     | `email` | string | อีเมลจากข้อ 1 (ตัวพิมพ์เล็ก) |
     | `name` | string | ชื่อที่แสดง |
     | `role` | string | `admin` |
     | `active` | boolean | `true` |

4. เปิด dashboard แล้ว login ด้วยอีเมล/รหัสผ่านจากข้อ 1

## งานประจำของ admin (ในหน้าเว็บ)

เมนูผู้ใช้มุมขวาบน → **จัดการผู้ใช้งาน**

- **เพิ่มผู้ใช้:** กรอกอีเมล (โดเมนไหนก็ได้) + ชื่อ + role → ระบบสร้างบัญชีและส่งอีเมลให้ผู้ใช้ตั้งรหัสผ่านเอง admin ไม่ต้องรู้รหัสของใคร
- **ลืมรหัสผ่าน:** ผู้ใช้กด "ลืมรหัสผ่าน?" ที่หน้า login เอง หรือ admin กด **ส่งอีเมลรีเซ็ตรหัส** ให้
- **ปิดบัญชี:** กด **ปิดบัญชี** ผู้ใช้ถูก logout ทันทีและอ่านข้อมูลไม่ได้อีก เปิดคืนได้ภายหลัง
- **เปลี่ยน role:** เลือก viewer / admin ในตาราง
- **การเข้าใช้เดือนนี้:** แท็บที่สอง แสดงจำนวนครั้งและเวลาเข้าใช้ล่าสุดของแต่ละคน คนที่ยังไม่เข้าเดือนนี้จะขึ้นสีส้ม

admin ปิดบัญชีหรือลดสิทธิ์ตัวเองไม่ได้ เพื่อไม่ให้ระบบไม่มี admin เหลือ ถ้าต้องการเปลี่ยน admin ให้เพิ่ม admin คนใหม่ก่อน แล้วให้คนใหม่ปรับบัญชีเดิม

## ข้อควรรู้

- อีเมลเชิญ/รีเซ็ตรหัส ส่งจาก `noreply@entertainment-dashboard-733e5.firebaseapp.com` อาจเข้า Junk ได้
  แก้ข้อความอีเมลได้ที่ Console → Authentication → Templates
- เปลี่ยนอีเมลของบัญชีเดิมทำจากหน้าเว็บไม่ได้ ให้ปิดบัญชีเดิมแล้วเชิญอีเมลใหม่
- ลบบัญชีถาวร: Console → Authentication → ลบ user และลบ document ใน `users` คู่กัน

## ทดสอบในเครื่อง (ไม่แตะ production)

ต้องมี Java 11+ สำหรับ Firestore emulator

```bash
firebase emulators:exec --only auth,firestore "node scripts/test-auth-emulator.mjs"
```

เปิดหน้าเว็บกับ emulator: รัน `firebase emulators:start --only auth,firestore` แล้วรัน dev server ด้วย `FIREBASE_EMULATOR=true`
