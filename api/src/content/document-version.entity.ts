import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { ContentDocument } from './document.entity.js'
import type { DocumentData } from './document-data.js'

export type VersionKind = 'created' | 'saved' | 'published' | 'unpublished' | 'restored'

/** History: one row per save, publish, unpublish or restore. The last 100 per document stay. */
@Entity({ name: 'document_versions' })
export class DocumentVersion {
  /** bigint identity; Postgres returns it as a string. */
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id: string

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string

  @ManyToOne(() => ContentDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: ContentDocument

  @Column({ type: 'varchar', length: 20 })
  kind: VersionKind

  @Column({ type: 'jsonb' })
  data: DocumentData

  @Column({ name: 'data_hash', type: 'char', length: 64 })
  dataHash: string

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
