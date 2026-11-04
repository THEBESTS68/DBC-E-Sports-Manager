# DBC NextGen E-Sport Manager

เว็บจัดการทัวร์นาเมนต์ E-Sport ของชมรม DBC NextGen รองรับ eFootball, Garena RoV และ Free Fire
ข้อมูลซิงค์แบบเรียลไทม์ ผู้ชมทุกคนเห็นคะแนนอัปเดตทันที

## โครงสร้างไฟล์

```
index.html                      โครงหน้าเว็บ
css/style.css                   สไตล์ทั้งหมด + ธีมสีของแต่ละเกม
js/config.js                    ตั้งค่า: เลือก backend (firebase / supabase) และคีย์ต่างๆ
js/store/store.js               ชั้นข้อมูลกลาง (หน้าเว็บเรียกผ่านตัวนี้เท่านั้น)
js/store/firebase-store.js      adapter Firebase (ระบบเดิม)
js/store/supabase-store.js      adapter Supabase (ระบบใหม่)
js/store/demo-store.js          โหมดทดลอง ไม่บันทึกลงฐานข้อมูลจริง
js/ui.js                        toast, dialog, modal
js/rules.js                     กติกาการแข่งขันฉบับเต็ม
js/app.js                       ระบบหลัก: สายแข่ง, ตาราง Free Fire, โปรไฟล์, ล็อกอิน
js/effects.js                   เอฟเฟกต์ UI
supabase/schema.sql             โครงสร้างฐานข้อมูล + สิทธิ์ (RLS) สำหรับ Supabase
scripts/migrate-firebase-to-supabase.mjs   สคริปต์ย้ายข้อมูล
images/                         รูปพื้นหลังและไอคอน
```

## รันบนเครื่อง

เป็นเว็บ static ไม่ต้อง build:

```bash
npx http-server@14.1.1 . -p 5173 -c-1
```

- `http://localhost:5173/` — ใช้ฐานข้อมูลจริงตาม `js/config.js`
- `http://localhost:5173/?backend=demo` — **โหมดทดลอง** โหลดข้อมูลจริงมาแสดง แต่การแก้ไขทั้งหมดอยู่ในเบราว์เซอร์เท่านั้น (ใช้ได้เฉพาะ localhost)

## ย้ายไป Supabase

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) (เลือก region Singapore)
2. เปิด **SQL Editor** แล้วรันไฟล์ `supabase/schema.sql`
3. **Authentication > Users > Add user** สร้างบัญชีกรรมการ (อีเมล + รหัสผ่าน)
   แล้วรันใน SQL Editor:
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'อีเมลกรรมการ';
   ```
4. (ไม่บังคับ — ข้ามได้ถ้าต้องการเริ่มแบบว่าง) ย้ายข้อมูลจาก Firebase (ลอง `--dry-run` ก่อน):
   ```powershell
   $env:SUPABASE_URL="https://xxxx.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="service_role key"
   node scripts/migrate-firebase-to-supabase.mjs --dry-run
   node scripts/migrate-firebase-to-supabase.mjs
   ```
   > service_role key มีสิทธิ์เต็ม ใช้เฉพาะตอนรันสคริปต์บนเครื่อง ห้ามใส่ในโค้ดหรือ commit
5. แก้ `js/config.js`: ใส่ `supabase.url`, `supabase.anonKey` แล้วเปลี่ยน `backend: 'supabase'`
6. ทดสอบบน localhost แล้วค่อย push / deploy
7. เมื่อใช้งาน Supabase ได้แล้ว ให้ปิดสิทธิ์อ่าน/เขียนของ Firebase (Realtime Database > Rules) เพื่อไม่ให้ข้อมูลส่วนตัวรั่ว

### สิ่งที่ได้หลังย้าย
- กรรมการล็อกอินด้วยอีเมล/รหัสผ่านจริง ฐานข้อมูลตรวจสิทธิ์เองด้วย Row Level Security
- ชื่อจริง / ตำแหน่ง / Bio แยกไปตาราง `profile_private` อ่านได้เฉพาะกรรมการ

## หมายเหตุโหมด Firebase (ปัจจุบัน)
การตรวจรหัสกรรมการยังทำในเบราว์เซอร์ และฐานข้อมูลเปิดให้อ่าน/เขียนได้ ควรย้ายไป Supabase โดยเร็ว
เปลี่ยนรหัสกรรมการชั่วคราวได้ที่ `adminPasscodeSha256` ใน `js/config.js`
