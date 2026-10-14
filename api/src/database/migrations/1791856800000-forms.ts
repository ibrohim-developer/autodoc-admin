import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Form submissions, job applications, the forms' rate limit, and integration settings. */
export class Forms1791856800000 implements MigrationInterface {
  name = 'Forms1791856800000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE leads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        number integer GENERATED ALWAYS AS IDENTITY CONSTRAINT leads_number_key UNIQUE,
        form varchar(40) NOT NULL,
        name varchar(120) NOT NULL,
        phone varchar(40) NOT NULL,
        topic varchar(200),
        message text,
        locale varchar(2) NOT NULL,
        page varchar(300),
        status varchar(20) NOT NULL DEFAULT 'new'
          CONSTRAINT leads_status_check CHECK (status IN ('new', 'in_progress', 'done', 'spam')),
        comment text,
        consent_at timestamptz NOT NULL,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        deleted_by uuid
      )
    `)
    await queryRunner.query(`CREATE INDEX leads_created_idx ON leads (created_at DESC)`)
    await queryRunner.query(
      `CREATE INDEX leads_status_idx ON leads (status) WHERE deleted_at IS NULL`,
    )
    await queryRunner.query(
      `CREATE INDEX leads_deleted_idx ON leads (deleted_at) WHERE deleted_at IS NOT NULL`,
    )

    await queryRunner.query(`
      CREATE TABLE applications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        number integer GENERATED ALWAYS AS IDENTITY CONSTRAINT applications_number_key UNIQUE,
        vacancy_id uuid REFERENCES documents (id) ON DELETE SET NULL,
        vacancy_title varchar(200),
        name varchar(120) NOT NULL,
        phone varchar(40) NOT NULL,
        email varchar(254),
        about text,
        resume_file varchar(255),
        resume_name varchar(255),
        resume_mime varchar(100),
        resume_size integer,
        source varchar(20) NOT NULL
          CONSTRAINT applications_source_check
          CHECK (source IN ('site', 'hh', 'instagram', 'telegram', 'linkedin', 'referral', 'other')),
        locale varchar(2),
        page varchar(300),
        status varchar(20) NOT NULL DEFAULT 'new'
          CONSTRAINT applications_status_check
          CHECK (status IN ('new', 'reviewing', 'interview', 'hired', 'rejected')),
        comment text,
        consent_at timestamptz,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        deleted_by uuid
      )
    `)
    await queryRunner.query(
      `CREATE INDEX applications_created_idx ON applications (created_at DESC)`,
    )
    await queryRunner.query(
      `CREATE INDEX applications_vacancy_idx ON applications (vacancy_id, created_at)`,
    )
    await queryRunner.query(
      `CREATE INDEX applications_status_idx ON applications (status) WHERE deleted_at IS NULL`,
    )
    await queryRunner.query(
      `CREATE INDEX applications_deleted_idx ON applications (deleted_at) WHERE deleted_at IS NOT NULL`,
    )

    // One row per accepted (or honeypot-caught) submission, by form and hashed address: the
    // per-address limits count these. Rows older than a day are deleted every night.
    await queryRunner.query(`
      CREATE TABLE form_hits (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        form varchar(40) NOT NULL,
        address char(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(
      `CREATE INDEX form_hits_lookup_idx ON form_hits (form, address, created_at)`,
    )

    await queryRunner.query(`
      CREATE TABLE app_settings (
        key varchar(60) PRIMARY KEY,
        value jsonb NOT NULL,
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app_settings`)
    await queryRunner.query(`DROP TABLE form_hits`)
    await queryRunner.query(`DROP TABLE applications`)
    await queryRunner.query(`DROP TABLE leads`)
  }
}
