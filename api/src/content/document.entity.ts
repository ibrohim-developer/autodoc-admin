import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import type { DocumentData } from './document-data.js'

/**
 * Every content item: news post, vacancy, page… (the `type` column says which).
 *
 * `draft` is what editors work on; `published` is what the site shows. Publishing copies the
 * draft over; the hashes tell whether they still differ ("есть неопубликованные изменения").
 * Deleting sets `deleted_at` (the trash); TypeORM then leaves the row out of normal queries.
 */
@Entity({ name: 'documents' })
export class ContentDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 40 })
  type: string

  /** Slug of the working copy. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  slug: string | null

  /** Slug the site currently serves, so the old address can be refreshed after a rename. */
  @Column({ name: 'published_slug', type: 'varchar', length: 200, nullable: true })
  publishedSlug: string | null

  @Column({ type: 'jsonb' })
  draft: DocumentData

  @Column({ name: 'draft_hash', type: 'char', length: 64 })
  draftHash: string

  @Column({ type: 'jsonb', nullable: true })
  published: DocumentData | null

  @Column({ name: 'published_hash', type: 'char', length: 64, nullable: true })
  publishedHash: string | null

  @Column({ name: 'first_published_at', type: 'timestamptz', nullable: true })
  firstPublishedAt: Date | null

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null

  @Column({ name: 'scheduled_by', type: 'uuid', nullable: true })
  scheduledBy: string | null

  /** Goes up on every save; a save based on an older revision is refused (two editors at once). */
  @Column({ type: 'integer', default: 1 })
  revision: number

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null
}
