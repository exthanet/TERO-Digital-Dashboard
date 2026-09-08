# Dashboard Components

โฟลเดอร์นี้เก็บ component ที่แยกจาก `app/dashboard.tsx` เพื่อให้แก้ไขง่ายและลดความเสี่ยงกระทบ filter หลัก

- `AffiliateReport.tsx` — รายงาน Affiliate Program
- `TvRatingChoropleth.tsx` — แผนที่ Rating ตาม Audience Zone

ถ้าจะเพิ่มกราฟใหม่ ให้สร้าง component แยกในโฟลเดอร์นี้ แล้ว import เข้าที่ `app/dashboard.tsx`
