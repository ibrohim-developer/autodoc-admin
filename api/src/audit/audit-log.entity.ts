import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** Who did what in the admin. Kept 12 months (retention job). */
@Entity({ name: 'audit_log' })
@Index(['entityType', 'entityId'])
export class AuditLog {
  /** bigint identity; Postgres returns it as a string. */
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id: string

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null

  /** Snapshot, so the entry still reads after the user is renamed or removed. */
  @Column({ name: 'user_email', type: 'varchar', length: 254, nullable: true })
  userEmail: string | null

  /** e.g. `auth.login`, `users.update`. */
  @Column({ type: 'varchar', length: 100 })
  action: string

  @Column({ name: 'entity_type', type: 'varchar', length: 60, nullable: true })
  entityType: string | null

  @Column({ name: 'entity_id', type: 'varchar', length: 64, nullable: true })
  entityId: string | null

  @Column({ type: 'text', nullable: true })
  summary: string | null

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null

  @Column({ name: 'user_agent', type: 'varchar', length: 300, nullable: true })
  userAgent: string | null

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null
}
