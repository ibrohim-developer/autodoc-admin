import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import type { Locale } from '../content/locales.js'
import type { ApplicationSource, ApplicationStatus } from './workflow.js'

/** A job application ("Отклик"): from the site's resume form, or added by HR by hand. */
@Entity({ name: 'applications' })
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'integer', generated: 'identity', generatedIdentity: 'ALWAYS' })
  number: number

  /** Null for "другая позиция", or once the vacancy is deleted for good. */
  @Column({ name: 'vacancy_id', type: 'uuid', nullable: true })
  vacancyId: string | null

  /** The vacancy's Uzbek title when the candidate applied, so it still reads after a rename. */
  @Column({ name: 'vacancy_title', type: 'varchar', length: 200, nullable: true })
  vacancyTitle: string | null

  @Column({ type: 'varchar', length: 120 })
  name: string

  @Column({ type: 'varchar', length: 40 })
  phone: string

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null

  @Column({ type: 'text', nullable: true })
  about: string | null

  /** Relative to storage/private, e.g. `resumes/2026/10/<uuid>.pdf`. Never served directly. */
  @Column({ name: 'resume_file', type: 'varchar', length: 255, nullable: true })
  resumeFile: string | null

  /** The file name the candidate uploaded. */
  @Column({ name: 'resume_name', type: 'varchar', length: 255, nullable: true })
  resumeName: string | null

  /** As detected from the content, not as the browser claimed. */
  @Column({ name: 'resume_mime', type: 'varchar', length: 100, nullable: true })
  resumeMime: string | null

  @Column({ name: 'resume_size', type: 'integer', nullable: true })
  resumeSize: number | null

  @Column({ type: 'varchar', length: 20 })
  source: ApplicationSource

  @Column({ type: 'varchar', length: 2, nullable: true })
  locale: Locale | null

  @Column({ type: 'varchar', length: 300, nullable: true })
  page: string | null

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: ApplicationStatus

  @Column({ type: 'text', nullable: true })
  comment: string | null

  /** Set for applications from the site; HR's own additions have none. */
  @Column({ name: 'consent_at', type: 'timestamptz', nullable: true })
  consentAt: Date | null

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
