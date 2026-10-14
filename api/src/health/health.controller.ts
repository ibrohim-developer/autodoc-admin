import { Controller, Get } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { DataSource } from 'typeorm'
import { Public } from '../common/decorators.js'

/** For pm2/nginx/uptime checks: 200 only when the database answers. */
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    await this.dataSource.query('SELECT 1')
    return { status: 'ok' }
  }
}
