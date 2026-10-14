import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common'
import { assignableRoles, ROLE_LABELS } from '../auth/permissions.js'
import { CurrentUser, RequirePermission, SkipAudit } from '../common/decorators.js'
import type { AppRequest, AuthUser } from '../common/request.js'
import { CreateUserDto, UpdateUserDto } from './users.dto.js'
import { UsersService } from './users.service.js'

/** The service writes the audit entries: it knows what actually changed. */
@Controller('admin/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('users.read')
  async list(@CurrentUser() actor: AuthUser) {
    return {
      items: await this.users.list(),
      assignableRoles: assignableRoles(actor.role).map((role) => ({
        value: role,
        label: ROLE_LABELS[role],
      })),
    }
  }

  @Post()
  @RequirePermission('users.manage')
  @SkipAudit()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser, @Req() req: AppRequest) {
    return this.users.create(dto, actor, req)
  }

  @Patch(':id')
  @RequirePermission('users.manage')
  @SkipAudit()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.users.update(id, dto, actor, req)
  }

  @Post(':id/reset-link')
  @RequirePermission('users.manage')
  @SkipAudit()
  resetLink(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.users.createResetLink(id, actor, req)
  }

  @Post(':id/reset-2fa')
  @RequirePermission('users.manage')
  @SkipAudit()
  resetTwoFactor(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.users.resetTwoFactor(id, actor, req)
  }
}
