import { Module } from '@nestjs/common'
import { FormsModule } from '../forms/forms.module.js'
import { CollectController, StatsController } from './stats.controller.js'
import { StatsService } from './stats.service.js'

@Module({
  imports: [FormsModule],
  controllers: [CollectController, StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
