import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ContentDocument } from '../content/document.entity.js'
import { FormsModule } from '../forms/forms.module.js'
import { StatsModule } from '../stats/stats.module.js'
import { HomeController } from './home.controller.js'
import { HomeService } from './home.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([ContentDocument]), FormsModule, StatsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
