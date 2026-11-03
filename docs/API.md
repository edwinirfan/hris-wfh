# Kontrak API — HRIS WFH

Base URL: `http://localhost:3000/api/v1` · Swagger: `http://localhost:3000/api/docs`

Semua endpoint (kecuali yang ditandai **Public**) butuh header `Authorization: Bearer <accessToken>`.

## Envelope

Sukses:
```json
{ "success": true, "message": "string | null", "data": <T> }
```
Gagal:
```json
{ "success": false, "statusCode": 409, "message": "Anda sudah check-in hari ini", "errors": ["..."], "path": "/api/v1/attendance/check-in", "timestamp": "ISO" }
```
`errors` hanya ada untuk error validasi (400). Daftar paginasi:
```json
{ "items": [<T>], "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }
```

Kode status yang dipakai: 400 validasi · 401 token tidak valid/kedaluwarsa · 403 role tidak cukup / wajib ganti password (`message` = `"PASSWORD_CHANGE_REQUIRED"`) · 404 · 409 konflik (duplikat, sudah check-in, versi data berubah) · 413 file terlalu besar · 423 akun terkunci · 429 rate limit · 503/504 service mati/timeout.

## Tipe data

```ts
type Role = 'ADMIN_HR' | 'EMPLOYEE';
type AuthUser = { id: string; employeeId: string; email: string; role: Role; isActive: boolean;
  mustChangePassword: boolean; lastLoginAt: string | null; lockedUntil: string | null };
type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number /* detik */; user: AuthUser };

type Department = { id: string; code: string; name: string };
type Position = { id: string; name: string; departmentId: string };
type Employee = { id: string; employeeCode: string; fullName: string; email: string; phone: string;
  gender: 'MALE' | 'FEMALE'; birthDate: string /* YYYY-MM-DD */; joinDate: string;
  employmentType: 'PERMANENT' | 'CONTRACT' | 'INTERN'; isActive: boolean; version: number;
  department: Department; position: { id: string; name: string }; createdAt: string; updatedAt: string };
type EmployeeDetail = Employee & { account: Pick<AuthUser, 'role' | 'isActive' | 'mustChangePassword' | 'lastLoginAt' | 'lockedUntil'> | null };

type Schedule = { workStart: string /* "08:00" */; workEnd: string; lateToleranceMinutes: number; timezone: string };
type AttendanceStatus = 'PRESENT' | 'LATE';
type AttendanceRecord = { id: string; employeeId: string; attendanceDate: string; checkInAt: string;
  checkOutAt: string | null; status: AttendanceStatus; lateMinutes: number; workMinutes: number | null;
  employee: { employeeCode: string; fullName: string; departmentName: string; positionName: string };
  checkInPhotoUrl: string | null; checkOutPhotoUrl: string | null };
type AttendanceLog = { id: string; type: 'CHECK_IN' | 'CHECK_OUT'; recordedAt: string; clientTime: string | null;
  clockDriftSeconds: number | null; photoUrl: string; photoSize: number; photoWidth: number; photoHeight: number;
  faceCount: number; faceConfidence: number; livenessPassed: boolean; latitude: number | null;
  longitude: number | null; locationAccuracyM: number | null; ipAddress: string | null; userAgent: string | null; note: string | null };
type AttendanceDetail = AttendanceRecord & { logs: AttendanceLog[] };
```
`*PhotoUrl` adalah URL absolut bertanda tangan (berlaku 5 menit) — langsung pakai di `<img src>`.

## Auth
| Method | Path | Akses | Body / Query | Response `data` |
|---|---|---|---|---|
| POST | `/auth/login` | Public, 10 req/menit/IP | `{ email, password }` | `TokenPair` |
| POST | `/auth/refresh` | Public | `{ refreshToken }` | `TokenPair` (refresh token lama dicabut) |
| POST | `/auth/logout` | Public | `{ refreshToken }` | `null` |
| POST | `/auth/change-password` | Login (boleh saat wajib ganti) | `{ currentPassword, newPassword }` | `TokenPair` baru |
| GET | `/auth/me` | Login (boleh saat wajib ganti) | – | `{ user: AuthUser, employee: Employee \| null }` |

Login gagal → 401 `"Email atau password salah"`; 5x gagal → 423 `"Akun terkunci sampai HH:mm"`. Akun nonaktif → 403.

## Utility
| GET | `/time` | Public | – | `{ serverTime: ISO, epochMs: number, timezone: "Asia/Jakarta" }` |
|---|---|---|---|---|
| GET | `/health` | Public | – | status terminus tiap service |

## Master data (ADMIN_HR)
| Method | Path | Body / Query | Response `data` |
|---|---|---|---|
| GET | `/departments` | – | `Department[]` |
| GET | `/positions` | `?departmentId` | `Position[]` |
| GET | `/employees` | `?page&limit&search&departmentId&isActive&sortBy(fullName\|employeeCode\|joinDate\|createdAt)&sortOrder(ASC\|DESC)` | `Paginated<Employee>` |
| GET | `/employees/:id` | – | `EmployeeDetail` |
| POST | `/employees` | `{ employeeCode, fullName, email, phone, gender, birthDate, departmentId, positionId, joinDate, employmentType, role? }` | `{ employee: Employee, account: { email, role, temporaryPassword } }` |
| PATCH | `/employees/:id` | field opsional dari create (tanpa `role`) + **`version` wajib** | `Employee` |
| PATCH | `/employees/:id/status` | `{ isActive: boolean, reason? }` | `Employee` |
| POST | `/employees/:id/reset-password` | – | `{ temporaryPassword }` |

Validasi: NIK `^[A-Z0-9][A-Z0-9-]{2,19}$` unik · email unik · HP `^(\+62|62|0)8[1-9]\d{6,10}$` · usia 17–70 · joinDate ≤ hari ini + 30 · jabatan harus milik departemen · `version` beda → 409.

## Absensi — karyawan (data milik sendiri, employeeId dari token)
| Method | Path | Body / Query | Response `data` |
|---|---|---|---|
| GET | `/attendance/schedule` | – | `Schedule` |
| GET | `/attendance/today` | – | `{ date, serverTime, schedule: Schedule, attendance: AttendanceDetail \| null, canCheckIn: boolean, canCheckOut: boolean }` |
| POST | `/attendance/check-in` | multipart (lihat bawah) | `AttendanceDetail` |
| POST | `/attendance/check-out` | multipart | `AttendanceDetail` |
| GET | `/attendance/me` | `?from&to&page&limit` (default 30 hari terakhir) | `Paginated<AttendanceRecord>` |
| GET | `/attendance/:id` | – (HR: semua; karyawan: hanya miliknya) | `AttendanceDetail` |

Multipart fields: `photo` (file jpeg/png/webp ≤ 2 MB, min 320×240) · `faceCount` (harus `1`) · `faceConfidence` (0.5–1) · `livenessPassed` (harus `true`) · `clientTime` (ISO, opsional) · `latitude`, `longitude` (berpasangan, opsional) · `accuracy` (meter, opsional) · `note` (≤255, opsional).

Error penting: 409 `"Anda sudah check-in hari ini"` · 409 `"Anda belum check-in hari ini"` · 409 `"Anda sudah check-out hari ini"` · 409 `"Foto ini sudah pernah digunakan"` · 403 `"Karyawan tidak aktif"` · 400 `"File bukan gambar yang valid"`.

## Monitoring absensi (ADMIN_HR, view-only — hanya GET)
| GET | `/attendance` | `?from&to&departmentId&employeeId&status&search&page&limit&sortBy(attendanceDate\|checkInAt\|fullName)&sortOrder` (default hari ini) | `Paginated<AttendanceRecord>` |
|---|---|---|---|
| GET | `/attendance/summary` | `?date` (default hari ini) | `{ date, totalActive, checkedIn, onTime, late, notCheckedIn, checkedOut }` |
| GET | `/attendance/stats` | `?days` (1–31, default 7) | `{ days: [{ date, onTime, late, absent, isWeekend }] }` (Sabtu/Minggu: absent = 0) |
| GET | `/attendance/absentees` | `?date` | `[{ employeeId, employeeCode, fullName, departmentName, positionName }]` |

## Realtime (Socket.IO)
- URL: `http://localhost:3000/realtime`, `io(url, { auth: { token: accessToken } })`
- ADMIN_HR otomatis masuk room `hr`; karyawan masuk room miliknya sendiri.
- Event `attendance:recorded`:
```ts
{ attendanceId, employeeId, employeeCode, fullName, departmentName, type: 'CHECK_IN' | 'CHECK_OUT',
  status: AttendanceStatus, lateMinutes, attendanceDate, recordedAt, photoUrl, livenessPassed, faceConfidence }
```
