import { Entity, PrimaryColumn } from 'typeorm'

/** Which documents use which photo (in the draft or the published version). */
@Entity({ name: 'media_usages' })
export class MediaUsage {
  @PrimaryColumn({ name: 'media_id', type: 'uuid' })
  mediaId: string

  @PrimaryColumn({ name: 'document_id', type: 'uuid' })
  documentId: string
}
