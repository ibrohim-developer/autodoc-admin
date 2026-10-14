import { Transform } from 'class-transformer'
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator'
import { ROLES, type Role } from '../auth/permissions.js'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class CreateUserDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string

  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name: string

  @IsIn(ROLES)
  role: Role
}

export class UpdateUserDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name?: string

  @IsOptional()
  @IsIn(ROLES)
  role?: Role

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
