import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { SkipThrottle } from '@nestjs/throttler'
import type { Request } from 'express'
import { Public } from '../common/decorators.js'
import { ApplicationsService, type UploadedResume } from './applications.service.js'
import { FormLimitsService } from './form-limits.service.js'
import { LeadsService } from './leads.service.js'
import { applicationInput, isBot, leadInput } from './public-input.js'
import { MAX_RESUME_BYTES } from './resume.js'
import { parseInput } from './shared.js'
import { SiteOriginGuard } from './site-origin.guard.js'
import { APPLICATION_FORM, LEAD_FORMS } from './workflow.js'

const OK = { ok: true } as const

/**
 * The site's forms. Visitors' browsers call these (nginx routes autodoc.uz/api/v1/leads and
 * /applications here), so there is no site token: the limits are per form and address, a
 * honeypot field catches simple bots, and consent is required. The answer never says more
 * than "ok": a bot learns nothing from it.
 */
@Controller('v1')
@Public()
// Our own per-form limits replace the generic one (FormLimitsService).
@SkipThrottle()
@UseGuards(SiteOriginGuard)
export class PublicFormsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly applications: ApplicationsService,
    private readonly limits: FormLimitsService,
  ) {}

  @Post('leads')
  @HttpCode(201)
  async lead(@Body() body: unknown, @Req() req: Request) {
    const named = (body as { form?: unknown } | null)?.form
    const form = LEAD_FORMS.find((key) => key === named) ?? 'unknown'
    const address = this.limits.addressOf(req.ip)
    await this.limits.check(form, address)
    if (isBot((body ?? {}) as { website?: string })) {
      await this.limits.record(form, address)
      return OK
    }
    const input = parseInput(leadInput, body)
    await this.leads.submit(input)
    await this.limits.record(input.form, address)
    return OK
  }

  /** Multipart: the fields plus `resume` (PDF, DOC or DOCX up to 10 MB). */
  @Post('applications')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('resume', {
      // Browsers send file names as raw UTF-8; busboy's default would garble Cyrillic ones.
      defParamCharset: 'utf8',
      limits: { fileSize: MAX_RESUME_BYTES, files: 1, fields: 20, fieldSize: 20_000 },
    }),
  )
  async application(
    @Body() body: unknown,
    @UploadedFile() file: UploadedResume | undefined,
    @Req() req: Request,
  ) {
    const address = this.limits.addressOf(req.ip)
    await this.limits.check(APPLICATION_FORM, address)
    if (isBot((body ?? {}) as { website?: string })) {
      await this.limits.record(APPLICATION_FORM, address)
      return OK
    }
    const input = parseInput(applicationInput, body)
    await this.applications.submit(input, file)
    await this.limits.record(APPLICATION_FORM, address)
    return OK
  }
}
