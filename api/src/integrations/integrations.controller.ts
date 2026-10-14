import { Body, Controller, Get, HttpCode, Post, Put, Req } from '@nestjs/common'
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator'
import { CurrentUser, RequirePermission, SkipAudit } from '../common/decorators.js'
import type { AppRequest, AuthUser } from '../common/request.js'
import { IntegrationsService } from './integrations.service.js'
import { TelegramService } from './telegram.service.js'

/** A numeric chat id (groups are negative) or a public channel's @name. */
const CHAT_ID = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/

class TelegramDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  /** From @BotFather: 123456789:AA… An empty string removes it. */
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== '')
  @Matches(/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/, {
    message: 'Токен бота выглядит так: 123456789:AAE…',
  })
  token?: string

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @MaxLength(40)
  @Matches(CHAT_ID, { message: 'ID чата — число (у групп с минусом) или @имя канала' })
  leadsChatId?: string | null

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @MaxLength(40)
  @Matches(CHAT_ID, { message: 'ID чата — число (у групп с минусом) или @имя канала' })
  applicationsChatId?: string | null
}

/** "Интеграции": administrators only. The service writes the audit entries. */
@Controller('admin/integrations')
@SkipAudit()
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly telegram: TelegramService,
  ) {}

  @Get('telegram')
  @RequirePermission('integrations.manage')
  getTelegram() {
    return this.integrations.telegramView()
  }

  @Put('telegram')
  @RequirePermission('integrations.manage')
  updateTelegram(@Body() dto: TelegramDto, @CurrentUser() actor: AuthUser, @Req() req: AppRequest) {
    return this.integrations.updateTelegram(dto, actor, req)
  }

  @Post('telegram/test')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  testTelegram() {
    return this.telegram.test()
  }
}
