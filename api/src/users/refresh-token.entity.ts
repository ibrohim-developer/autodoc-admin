import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { User } from './user.entity.js'

/**
 * One row per issued refresh token. Rotation revokes the old row and issues a
 * new one in the same family; presenting a revoked token revokes the family.
 */
@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  /** SHA-256 of the token; the token itself only ever lives in the cookie. */
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash: string

  /** All tokens descended from one login. */
  @Index()
  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null

  @Column({ name: 'replaced_by', type: 'uuid', nullable: true })
  replacedBy: string | null

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null

  @Column({ name: 'user_agent', type: 'varchar', length: 300, nullable: true })
  userAgent: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
