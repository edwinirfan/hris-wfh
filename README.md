# HRIS WFH — Absensi & Monitoring Karyawan

Jawaban **Dexa Group Fullstack Developer Skill Test**. Dua use case di soal (Absensi WFH dan Monitoring Karyawan) digabung menjadi **satu aplikasi HRIS** dengan dua role:

| Role | Bisa melakukan |
|---|---|
| `EMPLOYEE` | Login, check-in/check-out dengan swafoto terverifikasi (deteksi wajah + liveness kedip), melihat riwayat absensi sendiri |
| `ADMIN_HR` | Semua fitur karyawan + CRUD master karyawan, dashboard monitoring realtime, melihat (view-only) seluruh absensi beserta foto & metadata verifikasi |

**Stack:** NestJS 11 (TypeScript, monorepo 4 app) · MySQL 8.4 · RabbitMQ 4 · object storage S3-compatible · React 19 + Vite + Tailwind v4 + shadcn/ui · MediaPipe Face Landmarker · Docker Compose.

---

## Menjalankan

### Opsi A — Docker (disarankan)

```bash
docker compose up -d --build
```

| Layanan | URL |
|---|---|
| Aplikasi web | http://localhost:8080 |
| API Gateway | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/api/docs |
| Health check | http://localhost:3000/api/v1/health |
| RabbitMQ UI | http://localhost:15673 (`hris` / `hris_rabbit_pass`) |

Migration database dan data awal berjalan otomatis saat service start.

### Opsi B — Lokal tanpa Docker

Butuh Node 22, MySQL 8 dan RabbitMQ yang sudah berjalan.

```bash
# 1. buat 3 database (atau jalankan docker/mysql/init.sql)
mysql -uroot -e "CREATE DATABASE hris_auth_db; CREATE DATABASE hris_employee_db; CREATE DATABASE hris_attendance_db;"

# 2. backend (4 proses sekaligus)
cd backend && cp .env.example .env   # sesuaikan kredensial DB/RabbitMQ & isi kedua secret
npm install && npm run dev

# 3. frontend (terminal lain)
cd frontend && cp .env.example .env
npm install && npm run dev           # http://localhost:5173
```

> Kamera browser hanya diizinkan di `https://` atau `localhost`. Untuk mencoba dari HP di jaringan yang sama, gunakan tunnel HTTPS (mis. `ngrok http 8080`).

### Akun demo

| Role | Email | Password |
|---|---|---|
| Admin HR | `admin@hris.local` | `Admin@12345` |
| Karyawan | `budi@hris.local`, `siti@hris.local`, `andi@hris.local`, `dewi@hris.local`, `fajar@hris.local` | `Karyawan@123` |
| Karyawan nonaktif (untuk uji login ditolak) | `agus@hris.local` | `Karyawan@123` |

Seed juga mengisi riwayat absensi 10 hari terakhir (tanpa foto) supaya grafik dan tabel monitoring tidak kosong. Matikan dengan `SEED_DEMO_DATA=false`.

---

## Arsitektur

```
 React SPA (Vite, :8080) ──HTTP REST + Socket.IO──► API Gateway :3000 (NestJS)
                                                     │ JWT · RBAC · rate limit · helmet · Swagger
                                                     │ upload & validasi foto · saga · WebSocket
              ┌───────────────── TCP ────────────────┼──────────────── TCP ─────────────────┐
              ▼                                      ▼                                      ▼
      auth-service :4001                  employee-service :4002                attendance-service :4003
       hris_auth_db                         hris_employee_db                      hris_attendance_db
              ▲                                      │ publish employee.*                ▲      │ publish
              │                                      ▼                                   │      │ attendance.recorded
              └──────────── RabbitMQ · topic exchange `hris.events` ─────────────────────┘      │
                                     ▲  (queue durable per consumer, ack manual)                │
                                     └──────────── api-gateway consume attendance.* ◄───────────┘
 Object storage S3-compatible (RustFS) — bucket privat, foto diakses lewat URL bertanda tangan
```

### Pola microservices yang dipakai

| Pola | Implementasi |
|---|---|
| **API Gateway** | Satu pintu masuk HTTP; autentikasi JWT diverifikasi lokal di gateway (tanpa RPC per request) |
| **Request–response (TCP)** | `@MessagePattern` gateway → service, timeout 8 dtk; error service diterjemahkan jadi HTTP status yang tepat (`libs/common/src/rpc`) |
| **Event-driven (RabbitMQ topic exchange)** | `employee.created/updated/status_changed/deleted`, `attendance.recorded`; tiap consumer punya queue durable sendiri, ack/nack manual |
| **Database per service** | 3 database, 3 user MySQL dengan hak akses terpisah, tanpa join lintas database |
| **Event-carried state transfer** | `employee_refs` di attendance-service = replika data karyawan yang disinkronkan lewat event; bila event hilang, attendance-service menarik data via TCP (self-healing) |
| **Saga (orchestration) + kompensasi** | Tambah karyawan: employee-service membuat data → auth-service membuat akun. Bila langkah kedua gagal, gateway menghapus data karyawan |
| **API composition** | `GET /employees/:id` & `GET /auth/me` menggabungkan data dari auth-service + employee-service |

### Alur check-in

1. Browser menyalakan kamera (`getUserMedia`, **tanpa** opsi pilih file). MediaPipe Face Landmarker berjalan di perangkat: harus ada tepat 1 wajah, cukup dekat, dan cukup terang, lalu karyawan diminta **berkedip** (liveness, untuk mencegah absen pakai foto dari layar/cetakan). Foto diambil otomatis setelah kedipan terdeteksi.
2. Gateway memvalidasi file dari isinya (magic bytes + decode penuh dengan `sharp`, min 320×240, maks 2 MB), lalu **re-encode** ke JPEG. Re-encode ini membuang EXIF/GPS dan menetralkan payload tersembunyi di file.
3. Gateway meminta precheck ke attendance-service (karyawan aktif? sudah check-in?) **sebelum** menyimpan foto.
4. Foto disimpan ke object storage, lalu absensi dicatat. Bila pencatatan gagal, foto dihapus (kompensasi).
5. attendance-service mem-publish `attendance.recorded`. Gateway meneruskannya lewat Socket.IO ke dashboard HR **tanpa refresh**.

---

## Validasi

| Area | Aturan |
|---|---|
| **Global** | `ValidationPipe` whitelist + `forbidNonWhitelisted` (field asing seperti `employeeId` / `isActive` ditolak); format error konsisten; helmet; CORS whitelist; env divalidasi Joi saat boot; pagination maks 100 & kolom sort di-whitelist |
| **Login** | Pesan generik "Email atau password salah" + waktu respons disamakan (anti user-enumeration); 5x gagal → akun terkunci 15 menit (423); rate limit 10 login/menit/IP; status nonaktif baru dicek setelah password benar |
| **Sesi** | Access token 15 menit; refresh token opaque 7 hari, disimpan sebagai hash, dirotasi setiap dipakai. Refresh token lama yang dipakai ulang dianggap pencurian → semua sesi user dicabut |
| **Password** | bcrypt cost 12; min 8 karakter + huruf besar/kecil/angka; akun baru menerima password sementara dan **wajib menggantinya** sebelum bisa mengakses endpoint lain |
| **Otorisasi** | `@Roles(ADMIN_HR)`; `employeeId` selalu diambil dari JWT, tidak pernah dari body/query (cegah IDOR); karyawan yang membuka absensi orang lain mendapat 404; HR view-only — memang tidak ada route ubah/hapus absensi |
| **Master karyawan** | NIK `^[A-Z0-9][A-Z0-9-]{2,19}$` unik; email unik; HP Indonesia `^(\+62\|62\|0)8[1-9]\d{6,10}$`; tanggal valid (tolak 30 Februari); usia 17–70; tanggal bergabung ≤ hari ini + 30; jabatan harus milik departemen; HR tidak bisa menonaktifkan dirinya sendiri; tidak ada hard delete (nonaktifkan agar histori absensi utuh); **optimistic locking** (409 bila data diubah HR lain) |
| **Absensi** | **Jam server = sumber kebenaran**; tanggal absen dihitung di Asia/Jakarta; 1 check-in per hari (cek service + UNIQUE constraint); check-out hanya setelah check-in di hari yang sama dan hanya sekali; karyawan harus aktif; status `LATE` dihitung server (jam masuk 08:00, toleransi 15 menit) |
| **Foto** | Magic bytes JPEG/PNG/WebP + decode utuh + format harus cocok; maks 2 MB; min 320×240; re-encode & strip metadata; hash SHA-256 unik (foto tidak bisa dipakai ulang); bucket privat, URL foto ditandatangani HMAC dan berlaku 5 menit |
| **Metadata verifikasi** | `faceCount` harus 1, `faceConfidence` ≥ 0.5, `livenessPassed` harus true; latitude & longitude harus berpasangan; selisih jam perangkat vs server disimpan dan ditandai di UI HR bila > 5 menit |

> **Batasan yang disadari:** deteksi wajah berjalan di browser, sehingga bisa dilewati oleh orang yang memanggil API langsung. Karena itu server tidak bergantung padanya: waktu absen dari jam server, foto divalidasi dan di-hash di server, metadata disimpan sebagai jejak audit, dan HR tetap bisa memeriksa foto secara manual.

---

## Pengujian

```bash
cd backend
npm test                      # 59 unit test
bash scripts/smoke-test.sh    # 56 skenario end-to-end via HTTP (butuh stack berjalan, curl, jq)
```

- **Unit test:** perhitungan keterlambatan dan batas tanggal WIB (23:59 vs 00:00), aturan check-in/out, lockout login, custom validator DTO, validasi dan re-encode gambar, signed URL (tamper, kedaluwarsa, path traversal), saga dan kompensasinya.
- **Smoke test:** alur lengkap dari login HR, tambah karyawan, login pertama, ganti password, check-in/out, sampai monitoring, ditambah kasus negatif: file `.jpg` palsu, foto dipakai ulang, check-in ganda, IDOR, refresh-token reuse, lockout, dan sinkronisasi event saat karyawan dinonaktifkan.

---

## Struktur project

```
hris-wfh/
├── backend/                         NestJS monorepo
│   ├── apps/api-gateway/            REST, Socket.IO, upload & validasi foto, saga, guard
│   ├── apps/auth-service/           akun, login, token, lockout
│   ├── apps/employee-service/       master karyawan, departemen, jabatan
│   ├── apps/attendance-service/     absensi, jadwal kerja, replika karyawan, rekap
│   ├── libs/common/                 kontrak bersama: pattern/event, DTO + validator, helper RPC
│   └── scripts/                     smoke test
├── frontend/                        React SPA
│   └── src/components/              CameraCapture, DataTable<T>, LiveClock, PhotoViewer, ...
├── docker/mysql/init.sql            database + user per service
├── docs/API.md                      kontrak API lengkap
├── docs/ERD.md                      struktur database
└── docker-compose.yml
```

## Keputusan desain & trade-off

- **MySQL** dipilih dari opsi yang disebut di soal (Oracle/MySQL) karena setup-nya ringan di Docker. Seluruh akses data lewat TypeORM, sehingga pindah ke Oracle cukup mengganti driver dan migration.
- **TCP + RabbitMQ:** TCP sederhana untuk request–response; RabbitMQ untuk event async supaya service tidak saling menunggu.
- **Object storage:** image MinIO community tidak lagi didistribusikan, jadi compose memakai **RustFS** (S3-compatible). Driver `s3` di gateway memakai SDK `minio` sehingga bisa diarahkan ke MinIO/AWS S3 hanya lewat env. Untuk dev tanpa Docker tersedia driver `local`.
- **Event dikirim setelah commit, tanpa outbox:** bila RabbitMQ mati, data utama tetap tersimpan dan replika dipulihkan oleh fallback on-demand. Peningkatan berikutnya: transactional outbox.
- **Access token stateless:** akun yang dinonaktifkan langsung kehilangan refresh token dan tidak bisa absen (replika ikut nonaktif), tetapi access token yang sudah terbit tetap berlaku hingga maks 15 menit.

## Rencana lanjutan

Face match dengan foto profil karyawan, cek kehadiran acak di jam kerja, manajemen jadwal kerja/shift & hari libur, pengajuan cuti/izin, notifikasi email, geofence alamat rumah, transactional outbox, ekspor laporan.
