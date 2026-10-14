import { Transform } from 'class-transformer'
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator'
import { PASSWORD_MAX_LENGTH } from './password.js'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class LoginDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string

  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password: string

  /** 6-digit authenticator code or a recovery code; sent on the second step only. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(6, 20)
  code?: string
}

export class CodeDto {
  @Transform(trim)
  @IsString()
  @Length(6, 20)
  code: string
}

export class PasswordDto {
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password: string
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  currentPassword: string

  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  newPassword: string
}

export class TokenDto {
  @IsString()
  @Length(20, 200)
  token: string
}

export class UsePasswordTokenDto extends TokenDto {
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password: string
}
