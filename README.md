# วิธีนำระบบไปรันใน Google Apps Script

ใช้ไฟล์ในโฟลเดอร์นี้ทั้งหมดกับโปรเจกต์ Google Apps Script

## ไฟล์ที่ต้องสร้างใน Apps Script

1. `Code.gs`
2. `Index.html`
3. `Styles.html`
4. `App.html`
5. `appsscript.json` ถ้าเปิดการแก้ไข manifest ไว้

## ขั้นตอน

1. เปิด Google Apps Script แล้วสร้างโปรเจกต์ใหม่
2. วางเนื้อหาไฟล์ `Code.gs`
3. เพิ่มไฟล์ HTML ชื่อ `Index`, `Styles`, และ `App`
4. วางเนื้อหาจาก `Index.html`, `Styles.html`, และ `App.html` ลงในไฟล์ชื่อเดียวกัน
5. กด Save
6. เลือก Deploy > New deployment
7. เลือกชนิดเป็น Web app
8. ตั้งค่า Execute as เป็น Me
9. ตั้งค่า Who has access เป็น Anyone
10. กด Deploy แล้วอนุญาตสิทธิ์ Google Sheet และ Google Drive

## ปลายทางข้อมูล

- Google Sheet ID: `13n595E2MEwZfeg0rOL0f61JPsVCAwNhkiAT8YqIKzmc`
- Google Drive Folder ID: `1kz-st8yztlN2yTjYZxdW6vf1J7pDbvu5`

เมื่อผู้ขอส่งคำขอ ระบบจะบันทึกลงแท็บ `Requests` ใน Google Sheet และอ้างอิงโฟลเดอร์ Drive สำหรับจัดเก็บไฟล์เอกสาร
