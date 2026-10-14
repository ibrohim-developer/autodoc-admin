import { Controller, Get, Query } from '@nestjs/common'
import { Type } from 'class-transformer'
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { RequirePermission } from '../common/decorators.js'
import { AuditService } from './audit.service.js'

class AuditQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 50

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string

  @IsOptional()
  @IsString()
  @Matches(/^[a-z_]{1,40}$/)
  section?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  @IsOptional()
  @IsUUID()
  userId?: string

  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityType?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date
}

@Controller('admin/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.read')
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query)
  }
}
