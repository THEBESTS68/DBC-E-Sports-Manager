# DBC NextGen E-Sport Manager

เว็บจัดการทัวร์นาเมนต์ E-Sport ของชมรม DBC NextGen รองรับ eFootball, Garena RoV และ Free Fire
ข้อมูลซิงค์แบบเรียลไทม์ผ่าน Firebase Realtime Database

## โครงสร้างไฟล์

```
index.html              หน้าเว็บหลัก (โครง HTML)
css/style.css           สไตล์ทั้งหมด + ธีมสีของแต่ละเกม
js/firebase-config.js   ตั้งค่าและเชื่อมต่อ Firebase
js/app.js               ระบบหลัก: ล็อกอินกรรมการ, สายแข่ง, ตาราง Free Fire, โปรไฟล์
js/effects.js           เอฟเฟกต์ UI (ripple, 3D tilt, ปิด modal ด้วย Esc)
images/                 รูปพื้นหลังและไอคอนเกม
```

## การรัน

เป็นเว็บ static ไม่ต้อง build เปิด `index.html` ผ่าน local server หรือ deploy ขึ้น Vercel ได้ทันที
