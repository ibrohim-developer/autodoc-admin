import { Controller, Get } from '@nestjs/common'
import { CurrentUser, RequirePermission } from '../common/decorators.js'
import type { AuthUser } from '../common/request.js'
import { HomeService } from './home.service.js'

@Controller('admin/home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  /** The start screen's widgets; those the user's role doesn't see come back as null. */
  @Get()
  @RequirePermission('home.view')
  widgets(@CurrentUser() actor: AuthUser) {
    return this.home.widgets(actor)
  }
}
