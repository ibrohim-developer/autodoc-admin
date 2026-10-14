import { Body, Controller, Get, HttpCode, Post, Put, Req } from '@nestjs/common'
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator'
import { CurrentUser, RequirePermission, SkipAudit } from '../common/decorators.js'
import type { AppRequest, AuthUser } from '../common/request.js'
import { IntegrationsService } from '../integrations/integrations.service.js'
import { HhService } from './hh.service.js'

class HhDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Matches(/^\d{1,15}$/, { message: 'ID работодателя — число из адреса hh.uz/employer/…' })
  employerId?: string | null

  /** An empty string removes it. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ValidateIf((_, value) => value !== '')
  @Matches(/^[A-Za-z0-9_-]{20,200}$/, { message: 'Токен приложения hh — из dev.hh.ru' })
  token?: string

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all', { message: 'Выберите направление' })
  directionId?: string | null
}

/** "Интеграции → hh.uz": administrators only. */
@Controller('admin/integrations/hh')
@SkipAudit()
export class HhController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly hh: HhService,
  ) {}

  @Get()
  @RequirePermission('integrations.manage')
  get() {
    return this.integrations.hhView()
  }

  @Put()
  @RequirePermission('integrations.manage')
  update(@Body() dto: HhDto, @CurrentUser() actor: AuthUser, @Req() req: AppRequest) {
    return this.integrations.updateHh(dto, actor, req)
  }

  /** "Синхронизировать сейчас": runs and answers with the result. */
  @Post('sync')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  sync() {
    return this.hh.sync()
  }
}
