import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { CurrentUser, SkipAudit } from '../common/decorators.js'
import type { AppRequest, AuthUser } from '../common/request.js'
import { ContentTypeRegistry } from './content-types.js'
import { type DocumentStatus, DocumentsService } from './documents.service.js'
import { LOCALES, type Locale } from './locales.js'

const TYPE_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/

class ListQuery {
  @IsString()
  @Matches(TYPE_PATTERN)
  type: string

  /** `live`: on the site now, with or without unpublished changes. */
  @IsOptional()
  @IsIn(['draft', 'published', 'changed', 'scheduled', 'live'])
  status?: DocumentStatus | 'live'

  /** A reference field and the id it must point to: `categoryId:<uuid>`. */
  @IsOptional()
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]{0,39}:[0-9a-f-]{36}$/)
  ref?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25
}

class CreateDocumentDto {
  @IsString()
  @Matches(TYPE_PATTERN)
  type: string

  /** Checked against the type's schema by the service. */
  @IsObject()
  data: Record<string, unknown>
}

class SaveDocumentDto {
  @IsObject()
  data: Record<string, unknown>

  @IsInt()
  @Min(1)
  revision: number
}

class RevisionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  revision?: number
}

class FlagDto {
  @IsBoolean()
  value: boolean
}

class RequiredRevisionDto {
  @IsInt()
  @Min(1)
  revision: number
}

class ScheduleDto {
  @Type(() => Date)
  @IsDate()
  at: Date
}

class PreviewDto {
  @IsIn(LOCALES)
  locale: Locale = 'uz'
}

/**
 * The content of the site, for every type. Permissions depend on the document's type, so the
 * service checks them; it also writes the audit entries.
 */
@Controller('admin/content')
@SkipAudit()
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly registry: ContentTypeRegistry,
  ) {}

  /** The types this user may open, with what they may do in each. */
  @Get('types')
  types(@CurrentUser() actor: AuthUser) {
    return this.registry.withPermission(actor, 'read').map((type) => ({
      type: type.type,
      label: type.label,
      singleton: Boolean(type.singleton),
      publishOnSave: Boolean(type.publishOnSave),
      canWrite: actor.permissions.includes(type.permissions.write),
      canPublish: actor.permissions.includes(type.permissions.publish),
    }))
  }

  @Get()
  list(@Query() query: ListQuery, @CurrentUser() actor: AuthUser) {
    return this.documents.list(query.type, query, actor)
  }

  @Get('singleton/:type')
  singleton(@Param('type') type: string, @CurrentUser() actor: AuthUser) {
    return this.documents.getSingleton(type, actor)
  }

  @Post()
  create(@Body() dto: CreateDocumentDto, @CurrentUser() actor: AuthUser, @Req() req: AppRequest) {
    return this.documents.create(dto.type, dto.data, actor, req)
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.documents.get(id, actor)
  }

  @Put(':id')
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveDocumentDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.documents.save(id, dto, actor, req)
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisionDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.documents.publish(id, dto, actor, req)
  }

  /** A one-click switch from the list (`flags` of the type), on the live copy too. */
  @Put(':id/flags/:field')
  setFlag(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('field') field: string,
    @Body() dto: FlagDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.documents.setFlag(id, field, dto.value, actor, req)
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.documents.unpublish(id, actor, req)
  }

  @Put(':id/schedule')
  schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.documents.schedule(id, dto.at, actor, req)
  }

  @Delete(':id/schedule')
  unschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.documents.unschedule(id, actor, req)
  }

  @Get(':id/versions')
  versions(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.documents.listVersions(id, actor)
  }

  @Get(':id/versions/:versionId')
  version(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.documents.getVersion(id, versionId.replace(/\D/g, ''), actor)
  }

  @Post(':id/versions/:versionId/restore')
  @HttpCode(200)
  restoreVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId') versionId: string,
    @Body() dto: RequiredRevisionDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.documents.restoreVersion(id, versionId.replace(/\D/g, ''), dto, actor, req)
  }

  @Post(':id/preview-link')
  @HttpCode(200)
  previewLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.documents.previewLink(id, dto.locale, actor)
  }

  /** To the trash: 30 days to restore it. */
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    await this.documents.remove(id, actor, req)
  }
}
