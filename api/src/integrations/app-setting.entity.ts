import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

/** Settings of the admin itself (not of the site): integrations such as the Telegram bot. */
@Entity({ name: 'app_settings' })
export class AppSetting {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  key: string

  @Column({ type: 'jsonb' })
  value: Record<string, unknown>

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
