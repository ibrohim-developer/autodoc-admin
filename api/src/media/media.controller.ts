import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { CurrentUser, RequirePermission, SkipAudit } from '../common/decorators.js'
import type { AppRequest, AuthUser } from '../common/request.js'
import type { Locale } from '../content/locales.js'
import { MAX_UPLOAD_BYTES } from './image-processing.js'
import { MediaService, type UploadedFile as UploadedMediaFile } from './media.service.js'

class MediaListQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  /** Comma-separated: the photos a form already uses, fetched in one request. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  ids?: string[]

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 60
}

class UpdateMediaDto {
  @IsObject()
  alt: Partial<Record<Locale, string>>
}

/** The service writes the audit entries. */
@Controller('admin/media')
@SkipAudit()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @RequirePermission('media.read')
  list(@Query() query: MediaListQuery) {
    return this.media.list(query)
  }

  @Get(':id')
  @RequirePermission('media.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.get(id)
  }

  /** One photo per request, field `file`. Over 20 MB is refused before it reaches memory twice. */
  @Post()
  @RequirePermission('media.write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: UploadedMediaFile | undefined,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    if (!file) throw new BadRequestException({ code: 'no_file', message: 'Выберите фото' })
    return this.media.upload(file, actor, req)
  }

  @Patch(':id')
  @RequirePermission('media.write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMediaDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    return this.media.updateAlt(id, dto.alt, actor, req)
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('media.write')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    await this.media.remove(id, actor, req)
  }
}
