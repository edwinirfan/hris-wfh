-- Database-per-service: satu instance MySQL, tiga database, tiga user dengan hak akses terpisah.
-- Setiap service hanya bisa membaca/menulis database miliknya sendiri.
CREATE DATABASE IF NOT EXISTS hris_auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS hris_employee_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS hris_attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'auth_svc'@'%' IDENTIFIED BY 'auth_svc_pass';
CREATE USER IF NOT EXISTS 'employee_svc'@'%' IDENTIFIED BY 'employee_svc_pass';
CREATE USER IF NOT EXISTS 'attendance_svc'@'%' IDENTIFIED BY 'attendance_svc_pass';

GRANT ALL PRIVILEGES ON hris_auth_db.* TO 'auth_svc'@'%';
GRANT ALL PRIVILEGES ON hris_employee_db.* TO 'employee_svc'@'%';
GRANT ALL PRIVILEGES ON hris_attendance_db.* TO 'attendance_svc'@'%';
FLUSH PRIVILEGES;
