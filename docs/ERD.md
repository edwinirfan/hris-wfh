# Struktur Database

Satu instance MySQL 8.4, **tiga database terpisah** (database-per-service). Setiap service punya user MySQL sendiri yang hanya bisa mengakses database miliknya (`docker/mysql/init.sql`). Relasi lintas service (mis. `users.employee_id` → `employees.id`) adalah **referensi logis tanpa foreign key fisik**; konsistensinya dijaga lewat saga dan event.

Semua primary key `CHAR(36)` UUID (kecuali `work_schedules`). Semua `DATETIME` disimpan dalam UTC; `attendance_date` adalah tanggal kalender **Asia/Jakarta**. Skema dibuat lewat migration TypeORM yang ditulis manual (`apps/*/src/migrations`), `synchronize` dimatikan.

## auth-service → `hris_auth_db`

```mermaid
erDiagram
  users ||--o{ refresh_tokens : "punya"
  users {
    char36 id PK
    char36 employee_id UK "ref. logis ke employees"
    varchar150 email UK
    varchar100 password_hash "bcrypt"
    enum role "ADMIN_HR | EMPLOYEE"
    bool is_active
    bool must_change_password
    smallint failed_login_count
    datetime locked_until
    datetime last_login_at
    datetime password_changed_at
  }
  refresh_tokens {
    char36 id PK
    char36 user_id FK
    char64 token_hash UK "SHA-256, token asli tidak disimpan"
    datetime expires_at
    datetime revoked_at
    char36 replaced_by_id "jejak rotasi"
    varchar45 ip_address
    varchar255 user_agent
  }
```

## employee-service → `hris_employee_db`

```mermaid
erDiagram
  departments ||--o{ positions : "memiliki"
  departments ||--o{ employees : "menaungi"
  positions ||--o{ employees : "dijabat"
  departments {
    char36 id PK
    varchar10 code UK
    varchar100 name
  }
  positions {
    char36 id PK
    char36 department_id FK
    varchar100 name "UNIQUE(department_id, name)"
  }
  employees {
    char36 id PK
    varchar20 employee_code UK "NIK"
    varchar100 full_name
    varchar150 email UK
    varchar20 phone
    enum gender
    date birth_date
    char36 department_id FK
    char36 position_id FK
    date join_date
    enum employment_type "PERMANENT | CONTRACT | INTERN"
    bool is_active "soft delete"
    char36 created_by
    char36 updated_by
    int version "optimistic locking"
  }
```

## attendance-service → `hris_attendance_db`

```mermaid
erDiagram
  employee_refs ||--o{ attendances : "melakukan"
  attendances ||--|{ attendance_logs : "dirinci oleh"
  work_schedules {
    int id PK
    varchar50 name
    time work_start
    time work_end "CHECK work_end > work_start"
    smallint late_tolerance_minutes
    varchar50 timezone
    bool is_default
  }
  employee_refs {
    char36 employee_id PK "replika dari employee-service via event"
    varchar20 employee_code
    varchar100 full_name
    char36 department_id
    varchar100 department_name
    varchar100 position_name
    bool is_active
    datetime synced_at
  }
  attendances {
    char36 id PK
    char36 employee_id FK
    date attendance_date "UNIQUE(employee_id, attendance_date)"
    datetime check_in_at
    datetime check_out_at "CHECK > check_in_at"
    enum status "PRESENT | LATE"
    smallint late_minutes
    smallint work_minutes
  }
  attendance_logs {
    char36 id PK
    char36 attendance_id FK "UNIQUE(attendance_id, type)"
    enum type "CHECK_IN | CHECK_OUT"
    datetime recorded_at "jam server"
    datetime client_time "jam perangkat (audit)"
    int clock_drift_seconds
    varchar255 photo_key
    char64 photo_sha256 UK "foto tidak bisa dipakai ulang"
    int photo_size
    smallint photo_width
    smallint photo_height
    tinyint face_count
    decimal face_confidence
    bool liveness_passed
    decimal latitude
    decimal longitude
    decimal location_accuracy_m
    varchar45 ip_address
    varchar255 user_agent
    varchar255 note
  }
```

## Constraint yang menjaga aturan bisnis di level database

| Constraint | Aturan |
|---|---|
| `UQ_attendances_employee_date` | Satu check-in per karyawan per hari — pengaman terakhir dari race condition (dua request bersamaan) |
| `UQ_attendance_logs_attendance_type` | Satu check-in dan satu check-out per absensi |
| `UQ_attendance_logs_photo_sha256` | File foto yang sama tidak bisa dipakai absen dua kali |
| `CHK_attendances_checkout_after_checkin` | Jam check-out harus setelah check-in |
| `FK_attendances_employee_ref` (RESTRICT) | Replika karyawan yang sudah punya absensi tidak bisa terhapus |
| `UQ_employees_employee_code`, `UQ_employees_email` | NIK & email unik |
| `UQ_positions_department_name` + validasi service | Jabatan selalu milik departemen yang dipilih |
| `employees.version` | Optimistic locking: `UPDATE ... WHERE id = ? AND version = ?` |
| `UQ_users_email`, `UQ_users_employee_id` | Satu akun login per karyawan |
