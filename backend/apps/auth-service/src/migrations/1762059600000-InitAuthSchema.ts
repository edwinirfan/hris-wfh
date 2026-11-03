import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAuthSchema1762059600000 implements MigrationInterface {
  name = 'InitAuthSchema1762059600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` char(36) NOT NULL,
        \`employee_id\` char(36) NOT NULL,
        \`email\` varchar(150) NOT NULL,
        \`password_hash\` varchar(100) NOT NULL,
        \`role\` enum('ADMIN_HR','EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        \`must_change_password\` tinyint(1) NOT NULL DEFAULT 0,
        \`failed_login_count\` smallint unsigned NOT NULL DEFAULT 0,
        \`locked_until\` datetime(3) NULL,
        \`last_login_at\` datetime(3) NULL,
        \`password_changed_at\` datetime(3) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_users_employee_id\` (\`employee_id\`),
        UNIQUE KEY \`UQ_users_email\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`refresh_tokens\` (
        \`id\` char(36) NOT NULL,
        \`user_id\` char(36) NOT NULL,
        \`token_hash\` char(64) NOT NULL,
        \`expires_at\` datetime(3) NOT NULL,
        \`revoked_at\` datetime(3) NULL,
        \`replaced_by_id\` char(36) NULL,
        \`ip_address\` varchar(45) NULL,
        \`user_agent\` varchar(255) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_refresh_tokens_token_hash\` (\`token_hash\`),
        KEY \`IDX_refresh_tokens_user_id\` (\`user_id\`),
        CONSTRAINT \`FK_refresh_tokens_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `refresh_tokens`');
    await queryRunner.query('DROP TABLE `users`');
  }
}
