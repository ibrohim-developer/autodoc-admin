import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import type { Locale } from '../content/locales.js'

export type MediaVariant = {
  width: number
  height: number
  size: number
  /** Relative to storage/public/media, e.g. `2026/10/<id>-960.webp`. */
  file: string
}

/**
 * A photo in the media library. The upload is converted to WebP in several widths for phones,
 * tablets and desktops; the original stays in private storage for re-processing later.
 */
@Entity({ name: 'media' })
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string

  /** Format of the uploaded file, as detected from its content. */
  @Column({ type: 'varchar', length: 50 })
  mime: string

  /** Bytes of the uploaded file. */
  @Column({ type: 'integer' })
  size: number

  /** After fixing the camera rotation. */
  @Column({ type: 'integer' })
  width: number

  @Column({ type: 'integer' })
  height: number

  @Column({ type: 'jsonb' })
  variants: MediaVariant[]

  /** Relative to storage/private, e.g. `originals/2026/10/<id>.jpg`. */
  @Column({ name: 'original_file', type: 'varchar', length: 255 })
  originalFile: string

  /** Alternative text per language, for screen readers and search engines. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  alt: Partial<Record<Locale, string>>

  /** Of the original, to spot the same photo uploaded twice. */
  @Column({ type: 'char', length: 64 })
  sha256: string

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null
}
