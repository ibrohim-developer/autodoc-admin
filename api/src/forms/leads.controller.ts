import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { CurrentUser, RequirePermission, SkipAudit } from '../common/decorators.js'
import type { AppRequest, AuthUser } from '../common/request.js'
import { LeadChangesDto, LeadFilterDto, LeadListDto } from './dto.js'
import { LeadsService } from './leads.service.js'
import { sendXlsx } from './xlsx-response.js'

/** "Заявки". The service writes the audit entries. */
@Controller('admin/leads')
@SkipAudit()
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePermission('leads.read')
  list(@Query() query: LeadListDto) {
    return this.leads.list(query)
  }

  /** The filtered list as an Excel file. */
  @Get('export')
  @RequirePermission('leads.export')
  async export(
    @Query() query: LeadFilterDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
    @Res() res: Response,
  ) {
    sendXlsx(res, 'zayavki', await this.leads.export(query, actor, req))
  }

  @Get(':id')
  @RequirePermission('leads.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.get(id)
  }

  @Patch(':id')
  @RequirePermission('leads.write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeadChangesDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.leads.update(id, dto, actor, req)
  }

  /** To the trash: 30 days to restore it. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('leads.write')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    await this.leads.remove(id, actor, req)
  }
}
