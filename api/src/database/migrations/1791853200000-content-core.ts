import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Content documents with their history, and the media library. */
export class ContentCore1791853200000 implements MigrationInterface {
  name = 'ContentCore1791853200000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        type varchar(40) NOT NULL,
        slug varchar(200),
        published_slug varchar(200),
        draft jsonb NOT NULL,
        draft_hash char(64) NOT NULL,
        published jsonb,
        published_hash char(64),
        first_published_at timestamptz,
        published_at timestamptz,
        scheduled_at timestamptz,
        scheduled_by uuid,
        revision integer NOT NULL DEFAULT 1,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        deleted_by uuid
      )
    `)
    // A slug is unique within its type, among documents not in the trash.
    await queryRunner.query(`
      CREATE UNIQUE INDEX documents_type_slug_key ON documents (type, slug)
      WHERE deleted_at IS NULL AND slug IS NOT NULL
    `)
    await queryRunner.query(`
      CREATE INDEX documents_type_published_slug_idx ON documents (type, published_slug)
      WHERE deleted_at IS NULL AND published IS NOT NULL
    `)
    await queryRunner.query(`CREATE INDEX documents_type_idx ON documents (type, updated_at DESC)`)
    await queryRunner.query(`
      CREATE INDEX documents_scheduled_idx ON documents (scheduled_at)
      WHERE scheduled_at IS NOT NULL AND deleted_at IS NULL
    `)
    await queryRunner.query(`
      CREATE INDEX documents_deleted_idx ON documents (deleted_at) WHERE deleted_at IS NOT NULL
    `)

    await queryRunner.query(`
      CREATE TABLE document_versions (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
        kind varchar(20) NOT NULL
          CONSTRAINT document_versions_kind_check
          CHECK (kind IN ('created', 'saved', 'published', 'unpublished', 'restored')),
        data jsonb NOT NULL,
        data_hash char(64) NOT NULL,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(
      `CREATE INDEX document_versions_document_idx ON document_versions (document_id, id DESC)`,
    )

    await queryRunner.query(`
      CREATE TABLE media (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        original_name varchar(255) NOT NULL,
        mime varchar(50) NOT NULL,
        size integer NOT NULL,
        width integer NOT NULL,
        height integer NOT NULL,
        variants jsonb NOT NULL,
        original_file varchar(255) NOT NULL,
        alt jsonb NOT NULL DEFAULT '{}'::jsonb,
        sha256 char(64) NOT NULL,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        deleted_by uuid
      )
    `)
    await queryRunner.query(`CREATE INDEX media_created_idx ON media (created_at DESC)`)
    await queryRunner.query(`CREATE INDEX media_sha256_idx ON media (sha256)`)
    await queryRunner.query(
      `CREATE INDEX media_deleted_idx ON media (deleted_at) WHERE deleted_at IS NOT NULL`,
    )

    await queryRunner.query(`
      CREATE TABLE media_usages (
        media_id uuid NOT NULL REFERENCES media (id) ON DELETE CASCADE,
        document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
        PRIMARY KEY (media_id, document_id)
      )
    `)
    await queryRunner.query(`CREATE INDEX media_usages_document_idx ON media_usages (document_id)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE media_usages`)
    await queryRunner.query(`DROP TABLE media`)
    await queryRunner.query(`DROP TABLE document_versions`)
    await queryRunner.query(`DROP TABLE documents`)
  }
}
