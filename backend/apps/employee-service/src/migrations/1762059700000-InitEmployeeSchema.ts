import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitEmployeeSchema1762059700000 implements MigrationInterface {
  name = 'InitEmployeeSchema1762059700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`departments\` (
        \`id\` char(36) NOT NULL,
        \`code\` varchar(10) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_departments_code\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`positions\` (
        \`id\` char(36) NOT NULL,
        \`department_id\` char(36) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_positions_department_name\` (\`department_id\`, \`name\`),
        CONSTRAINT \`FK_positions_department\` FOREIGN KEY (\`department_id\`) REFERENCES \`departments\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`employees\` (
        \`id\` char(36) NOT NULL,
        \`employee_code\` varchar(20) NOT NULL,
        \`full_name\` varchar(100) NOT NULL,
        \`email\` varchar(150) NOT NULL,
        \`phone\` varchar(20) NOT NULL,
        \`gender\` enum('MALE','FEMALE') NOT NULL,
        \`birth_date\` date NOT NULL,
        \`department_id\` char(36) NOT NULL,
        \`position_id\` char(36) NOT NULL,
        \`join_date\` date NOT NULL,
        \`employment_type\` enum('PERMANENT','CONTRACT','INTERN') NOT NULL,
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        \`profile_photo_key\` varchar(255) NULL,
        \`created_by\` char(36) NULL,
        \`updated_by\` char(36) NULL,
        \`version\` int NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_employees_employee_code\` (\`employee_code\`),
        UNIQUE KEY \`UQ_employees_email\` (\`email\`),
        KEY \`IDX_employees_department\` (\`department_id\`),
        KEY \`IDX_employees_full_name\` (\`full_name\`),
        CONSTRAINT \`FK_employees_department\` FOREIGN KEY (\`department_id\`) REFERENCES \`departments\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`FK_employees_position\` FOREIGN KEY (\`position_id\`) REFERENCES \`positions\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `employees`');
    await queryRunner.query('DROP TABLE `positions`');
    await queryRunner.query('DROP TABLE `departments`');
  }
}
