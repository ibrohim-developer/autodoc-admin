import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import type { Locale } from '../content/locales.js'
import type { LeadStatus } from './workflow.js'

/** A submission of one of the site's forms ("Заявка"). */
@Entity({ name: 'leads' })
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** "Заявка №12": what people call it, and what Telegram shows instead of a name. */
  @Column({ type: 'integer', generated: 'identity', generatedIdentity: 'ALWAYS' })
  number: number

  /** Which form: `feedback`. */
  @Column({ type: 'varchar', length: 40 })
  form: string

  @Column({ type: 'varchar', length: 120 })
  name: string

  @Column({ type: 'varchar', length: 40 })
  phone: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  topic: string | null

  @Column({ type: 'text', nullable: true })
  message: string | null

  /** The site's language the visitor used: answer in it. */
  @Column({ type: 'varchar', length: 2 })
  locale: Locale

  /** The page the form was sent from. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  page: string | null

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: LeadStatus

  @Column({ type: 'text', nullable: true })
  comment: string | null

  /** When the visitor ticked the consent box (the form refuses without it). */
  @Column({ name: 'consent_at', type: 'timestamptz' })
  consentAt: Date

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
