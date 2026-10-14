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

export type PasswordTokenPurpose = 'invite' | 'reset'

/** One-time link that lets a user set a password: an invite or a reset. */
@Entity({ name: 'password_tokens' })
export class PasswordToken {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash: string

  @Column({ type: 'varchar', length: 10 })
  purpose: PasswordTokenPurpose

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
