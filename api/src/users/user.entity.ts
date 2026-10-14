import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import type { Role } from '../auth/permissions.js'

/** Postgres returns bigint as a string; the values stored here fit in a JS number. */
const bigintToNumber = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** Stored lowercased. */
  @Column({ type: 'varchar', length: 254, unique: true })
  email: string

  @Column({ type: 'varchar', length: 120 })
  name: string

  @Column({ type: 'varchar', length: 20 })
  role: Role

  /** Null until the invite is accepted. */
  @Column({ name: 'password_hash', type: 'text', nullable: true, select: false })
  passwordHash: string | null

  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null

  /** AES-GCM encrypted base32 secret. Set during setup, used once `totpEnabled`. */
  @Column({ name: 'totp_secret_enc', type: 'text', nullable: true, select: false })
  totpSecretEnc: string | null

  @Column({ name: 'totp_enabled', type: 'boolean', default: false })
  totpEnabled: boolean

  /** Last accepted TOTP time step, so a code can't be replayed. */
  @Column({
    name: 'totp_last_step',
    type: 'bigint',
    nullable: true,
    select: false,
    transformer: bigintToNumber,
  })
  totpLastStep: number | null

  /** SHA-256 hashes of the unused recovery codes. */
  @Column({ name: 'recovery_codes', type: 'jsonb', default: () => "'[]'", select: false })
  recoveryCodes: string[]

  @Column({ name: 'failed_logins', type: 'integer', default: 0 })
  failedLogins: number

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
