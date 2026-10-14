import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ContentModule } from '../content/content.module.js'
import { FormsModule } from '../forms/forms.module.js'
import { MediaModule } from '../media/media.module.js'
import { User } from '../users/user.entity.js'
import { TrashController } from './trash.controller.js'
import { TrashService } from './trash.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([User]), ContentModule, MediaModule, FormsModule],
  controllers: [TrashController],
  providers: [TrashService],
  exports: [TrashService],
})
export class TrashModule {}
