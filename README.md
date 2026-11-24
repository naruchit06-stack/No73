# No.73

เว็บฟังนิยายเสียงแบบ Full-stack รองรับหลายเรื่องและหลายตอน พร้อมบัญชีผู้ใช้ การฟังต่อจากตำแหน่งเดิม และหลังบ้านสำหรับผู้ดูแล

## ฟีเจอร์

- คลังนิยายพร้อมค้นหาและกรองตามหมวดหมู่
- รายละเอียดเรื่อง สารบัญตอน และเล่นตอนถัดไปอัตโนมัติ
- เครื่องเล่นแบบติดด้านล่าง ปรับตำแหน่ง ความเร็ว และระดับเสียง
- เข้าสู่ระบบด้วย Kimi และบันทึกตำแหน่งการฟังลงฐานข้อมูลทุก 5 วินาที
- หลังบ้านสำหรับเพิ่มนิยาย อัปโหลดปกและเสียง ดูรายการตอน และลบข้อมูล
- ไฟล์อัปโหลดจัดเก็บใน Object Storage โดยฐานข้อมูลเก็บเฉพาะ key
- รองรับเดสก์ท็อปและมือถือ รวมถึง safe-area และ reduced motion

## โครงสร้าง

- `src/` — React pages, components และ audio player provider
- `api/` — Hono + tRPC routers และการเชื่อม Object Storage
- `db/` — Drizzle schema และข้อมูลนิยายตัวอย่าง
- `contracts/` — ค่าที่ใช้ร่วมกันระหว่าง frontend และ backend

## คำสั่ง

```bash
npm install
npm run db:push
npx tsx db/seed.ts
npm run dev
```

ตรวจสอบและสร้าง production:

```bash
npm run check
npm run build
npm start
```

เว็บพัฒนาใช้พอร์ต `3000` ผู้สร้างแอปได้รับสิทธิ์ผู้ดูแลเมื่อเข้าสู่ระบบครั้งแรก ไฟล์ปกรองขนาดไม่เกิน 5 MB และไฟล์เสียงไม่เกิน 30 MB ต่อไฟล์

## ตั้งค่าล็อกอินด้วย Google
1. ไปที่ Google Cloud Console → APIs & Services → Credentials → Create Credentials → OAuth client ID (Web application)
2. เพิ่ม Authorized redirect URI: `https://โดเมนของคุณ/api/oauth/callback` (ทดสอบในเครื่อง: `http://localhost:3000/api/oauth/callback`)
3. ใส่ค่าใน `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_SECRET`, `OWNER_EMAIL` (อีเมล Google ของแอดมิน), `DATABASE_URL`
4. อีเมลที่ตรงกับ `OWNER_EMAIL` จะได้สิทธิ์แอดมิน (หลังบ้าน) เมื่อล็อกอิน

## ติดตั้งเป็นแอพ (PWA)
ต้องเปิดผ่าน HTTPS (หรือ localhost) — Android/Chrome จะมีปุ่ม “ติดตั้งแอพ” บนเมนู, iPhone ใช้ Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม

## ที่เก็บไฟล์ (ปก + เสียง)
ใช้ S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO) — สร้างบัคเก็ตแบบ **private** แล้วใส่ `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (และ `S3_ENDPOINT`/`S3_REGION` ตามผู้ให้บริการ) ใน `.env` เว็บจะสร้างลิงก์ชั่วคราวให้เบราว์เซอร์เองโดยอัตโนมัติ

หมายเหตุ: ไฟล์ที่อัปโหลดไว้ในที่เก็บไฟล์เดิมของ Kimi จะไม่ย้ายมาเอง ต้องดาวน์โหลดแล้วอัปโหลดเข้าบัคเก็ตใหม่ด้วยคีย์เดิม (เช่น `novels/covers/...`, `novels/audio/...`)
