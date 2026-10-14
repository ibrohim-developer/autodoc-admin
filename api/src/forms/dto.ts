import { Transform, Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'
import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  type ApplicationSource,
  type ApplicationStatus,
  LEAD_STATUSES,
  type LeadStatus,
  MAX_COMMENT_LENGTH,
} from './workflow.js'

const DAY = /^\d{4}-\d{2}-\d{2}$/

class PeriodQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  @IsOptional()
  @Matches(DAY, { message: 'Дата в формате ГГГГ-ММ-ДД' })
  from?: string

  @IsOptional()
  @Matches(DAY, { message: 'Дата в формате ГГГГ-ММ-ДД' })
  to?: string
}

export class LeadFilterDto extends PeriodQuery {
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: LeadStatus
}

export class LeadListDto extends LeadFilterDto {
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

export class ApplicationFilterDto extends PeriodQuery {
  @IsOptional()
  @IsIn(APPLICATION_STATUSES)
  status?: ApplicationStatus

  /** A vacancy's id, or `none` for applications to no particular one. */
  @IsOptional()
  @ValidateIf((_, value) => value !== 'none')
  @IsUUID()
  vacancyId?: string

  @IsOptional()
  @IsIn(APPLICATION_SOURCES)
  source?: ApplicationSource
}

export class ApplicationListDto extends ApplicationFilterDto {
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

export class LeadChangesDto {
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: LeadStatus

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string | null
}

export class ApplicationChangesDto {
  @IsOptional()
  @IsIn(APPLICATION_STATUSES)
  status?: ApplicationStatus

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string | null
}

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

/** HR adds a candidate by hand (multipart: these fields plus an optional `resume`). */
export class CreateApplicationDto {
  @IsString()
  @MinLength(1, { message: 'Укажите имя' })
  @MaxLength(120)
  name: string

  @IsString()
  @Matches(/^[+\d\s()-]{7,40}$/, { message: 'Укажите телефон: +998 90 123 45 67' })
  phone: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(254)
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Неверный email' })
  email?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  vacancyId?: string

  @IsIn(
    APPLICATION_SOURCES.filter((source) => source !== 'site'),
    {
      message: 'Выберите источник',
    },
  )
  source: Exclude<ApplicationSource, 'site'>

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  about?: string

  @IsOptional()
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string
}
