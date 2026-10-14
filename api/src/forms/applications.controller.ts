import { createReadStream } from 'node:fs'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { CurrentUser, RequirePermission, SkipAudit } from '../common/decorators.js'
import type { AppRequest, AuthUser } from '../common/request.js'
import { ApplicationsService, type UploadedResume } from './applications.service.js'
import {
  ApplicationChangesDto,
  ApplicationFilterDto,
  ApplicationListDto,
  CreateApplicationDto,
} from './dto.js'
import { MAX_RESUME_BYTES } from './resume.js'
import { contentDisposition, sendXlsx } from './xlsx-response.js'

function filters<T extends ApplicationFilterDto>(query: T) {
  const { vacancyId, ...rest } = query
  return vacancyId === 'none' ? { ...rest, noVacancy: true } : { ...rest, vacancyId }
}

/** "Отклики". The service writes the audit entries. */
@Controller('admin/applications')
@SkipAudit()
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  @RequirePermission('applications.read')
  list(@Query() query: ApplicationListDto) {
    return this.applications.list(filters(query))
  }

  @Get('export')
  @RequirePermission('applications.export')
  async export(
    @Query() query: ApplicationFilterDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
    @Res() res: Response,
  ) {
    sendXlsx(res, 'otkliki', await this.applications.export(filters(query), actor, req))
  }

  /** Vacancies with their application counts, for the filter and the "add" form. */
  @Get('vacancies')
  @RequirePermission('applications.read')
  async vacancies() {
    return { items: await this.applications.vacancies() }
  }

  @Post()
  @RequirePermission('applications.write')
  @UseInterceptors(
    FileInterceptor('resume', {
      defParamCharset: 'utf8',
      limits: { fileSize: MAX_RESUME_BYTES, files: 1, fields: 20 },
    }),
  )
  create(
    @Body() dto: CreateApplicationDto,
    @UploadedFile() file: UploadedResume | undefined,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.applications.create(dto, file, actor, req)
  }

  @Get(':id')
  @RequirePermission('applications.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.applications.get(id)
  }

  /** The resume file. Each download is written to the audit log. */
  @Get(':id/resume')
  @RequirePermission('applications.read')
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.applications.resume(id, actor, req)
    res.set({
      'Content-Type': file.mime,
      'Content-Disposition': contentDisposition(file.name),
      'Content-Length': String(file.size),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    return new StreamableFile(createReadStream(file.path))
  }

  @Patch(':id')
  @RequirePermission('applications.write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplicationChangesDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.applications.update(id, dto, actor, req)
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('applications.write')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    await this.applications.remove(id, actor, req)
  }
}
