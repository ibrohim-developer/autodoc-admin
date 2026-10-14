import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * The site's own statistics: no cookies, no IP addresses. A visitor is a hash of the address
 * and browser with a salt that changes every day and is then deleted, so visits can be told
 * apart within a day but never followed across days or traced back to anyone.
 */
export class Stats1791860400000 implements MigrationInterface {
  name = 'Stats1791860400000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE stats_salts (
        day date PRIMARY KEY,
        salt char(64) NOT NULL
      )
    `)

    await queryRunner.query(`
      CREATE TABLE stats_views (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        view_id uuid NOT NULL CONSTRAINT stats_views_view_id_key UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        day date NOT NULL,
        visitor char(32) NOT NULL,
        path varchar(300) NOT NULL,
        locale varchar(2) NOT NULL,
        content_type varchar(40),
        content_id uuid,
        source varchar(20) NOT NULL
          CONSTRAINT stats_views_source_check
          CHECK (source IN ('direct', 'search', 'social', 'referral', 'campaign', 'internal')),
        source_name varchar(100),
        device varchar(10) NOT NULL
          CONSTRAINT stats_views_device_check CHECK (device IN ('mobile', 'tablet', 'desktop')),
        duration_ms integer
      )
    `)
    await queryRunner.query(`CREATE INDEX stats_views_day_idx ON stats_views (day)`)
    await queryRunner.query(
      `CREATE INDEX stats_views_content_idx ON stats_views (content_id, day) WHERE content_id IS NOT NULL`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE stats_views`)
    await queryRunner.query(`DROP TABLE stats_salts`)
  }
}
