import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Users, sessions, invite/reset links and the audit log. */
export class InitAuth1791849600000 implements MigrationInterface {
  name = 'InitAuth1791849600000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(254) NOT NULL CONSTRAINT users_email_key UNIQUE,
        name varchar(120) NOT NULL,
        role varchar(20) NOT NULL CONSTRAINT users_role_check CHECK (role IN ('admin', 'marketing', 'hr')),
        password_hash text,
        password_changed_at timestamptz,
        totp_secret_enc text,
        totp_enabled boolean NOT NULL DEFAULT false,
        totp_last_step bigint,
        recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
        failed_logins integer NOT NULL DEFAULT 0,
        locked_until timestamptz,
        is_active boolean NOT NULL DEFAULT true,
        last_login_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL CONSTRAINT refresh_tokens_token_hash_key UNIQUE,
        family_id uuid NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        replaced_by uuid,
        ip varchar(45),
        user_agent varchar(300),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id)`)
    await queryRunner.query(
      `CREATE INDEX refresh_tokens_family_id_idx ON refresh_tokens (family_id)`,
    )

    await queryRunner.query(`
      CREATE TABLE password_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL CONSTRAINT password_tokens_token_hash_key UNIQUE,
        purpose varchar(10) NOT NULL CONSTRAINT password_tokens_purpose_check CHECK (purpose IN ('invite', 'reset')),
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX password_tokens_user_id_idx ON password_tokens (user_id)`)

    // No foreign key on user_id: entries must outlive whatever they describe.
    await queryRunner.query(`
      CREATE TABLE audit_log (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        user_id uuid,
        user_email varchar(254),
        action varchar(100) NOT NULL,
        entity_type varchar(60),
        entity_id varchar(64),
        summary text,
        ip varchar(45),
        user_agent varchar(300),
        meta jsonb
      )
    `)
    await queryRunner.query(`CREATE INDEX audit_log_created_at_idx ON audit_log (created_at DESC)`)
    await queryRunner.query(`CREATE INDEX audit_log_user_id_idx ON audit_log (user_id)`)
    await queryRunner.query(
      `CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id)`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE audit_log`)
    await queryRunner.query(`DROP TABLE password_tokens`)
    await queryRunner.query(`DROP TABLE refresh_tokens`)
    await queryRunner.query(`DROP TABLE users`)
  }
}
