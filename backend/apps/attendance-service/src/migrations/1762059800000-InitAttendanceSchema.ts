import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAttendanceSchema1762059800000 implements MigrationInterface {
  name = 'InitAttendanceSchema1762059800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`work_schedules\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`name\` varchar(50) NOT NULL,
        \`work_start\` time NOT NULL,
        \`work_end\` time NOT NULL,
        \`late_tolerance_minutes\` smallint unsigned NOT NULL DEFAULT 15,
        \`timezone\` varchar(50) NOT NULL DEFAULT 'Asia/Jakarta',
        \`is_default\` tinyint(1) NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`CHK_work_schedules_range\` CHECK (\`work_end\` > \`work_start\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`employee_refs\` (
        \`employee_id\` char(36) NOT NULL,
        \`employee_code\` varchar(20) NOT NULL,
        \`full_name\` varchar(100) NOT NULL,
        \`department_id\` char(36) NOT NULL,
        \`department_name\` varchar(100) NOT NULL,
        \`position_name\` varchar(100) NOT NULL,
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        \`synced_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`employee_id\`),
        KEY \`IDX_employee_refs_department\` (\`department_id\`),
        KEY \`IDX_employee_refs_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`attendances\` (
        \`id\` char(36) NOT NULL,
        \`employee_id\` char(36) NOT NULL,
        \`attendance_date\` date NOT NULL,
        \`check_in_at\` datetime(3) NOT NULL,
        \`check_out_at\` datetime(3) NULL,
        \`status\` enum('PRESENT','LATE') NOT NULL,
        \`late_minutes\` smallint unsigned NOT NULL DEFAULT 0,
        \`work_minutes\` smallint unsigned NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_attendances_employee_date\` (\`employee_id\`, \`attendance_date\`),
        KEY \`IDX_attendances_date_status\` (\`attendance_date\`, \`status\`),
        CONSTRAINT \`FK_attendances_employee_ref\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employee_refs\` (\`employee_id\`) ON DELETE RESTRICT,
        CONSTRAINT \`CHK_attendances_checkout_after_checkin\` CHECK (\`check_out_at\` IS NULL OR \`check_out_at\` > \`check_in_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`attendance_logs\` (
        \`id\` char(36) NOT NULL,
        \`attendance_id\` char(36) NOT NULL,
        \`type\` enum('CHECK_IN','CHECK_OUT') NOT NULL,
        \`recorded_at\` datetime(3) NOT NULL,
        \`client_time\` datetime(3) NULL,
        \`clock_drift_seconds\` int NULL,
        \`photo_key\` varchar(255) NOT NULL,
        \`photo_sha256\` char(64) NOT NULL,
        \`photo_size\` int unsigned NOT NULL,
        \`photo_width\` smallint unsigned NOT NULL,
        \`photo_height\` smallint unsigned NOT NULL,
        \`photo_mime\` varchar(30) NOT NULL,
        \`face_count\` tinyint unsigned NOT NULL,
        \`face_confidence\` decimal(5,4) NOT NULL,
        \`liveness_passed\` tinyint(1) NOT NULL,
        \`latitude\` decimal(10,7) NULL,
        \`longitude\` decimal(10,7) NULL,
        \`location_accuracy_m\` decimal(10,2) NULL,
        \`ip_address\` varchar(45) NULL,
        \`user_agent\` varchar(255) NULL,
        \`note\` varchar(255) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_attendance_logs_attendance_type\` (\`attendance_id\`, \`type\`),
        UNIQUE KEY \`UQ_attendance_logs_photo_sha256\` (\`photo_sha256\`),
        CONSTRAINT \`FK_attendance_logs_attendance\` FOREIGN KEY (\`attendance_id\`) REFERENCES \`attendances\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `attendance_logs`');
    await queryRunner.query('DROP TABLE `attendances`');
    await queryRunner.query('DROP TABLE `employee_refs`');
    await queryRunner.query('DROP TABLE `work_schedules`');
  }
}
