import { BadRequestException } from '@nestjs/common'
import argon2 from 'argon2'

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id })
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

let dummyHash: Promise<string> | undefined

/**
 * Verifies against a throwaway hash, so a login for an unknown email takes as
 * long as one with a wrong password and response time doesn't reveal which
 * emails exist.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password')
  await argon2.verify(await dummyHash, password)
}

export function assertPasswordPolicy(password: string, email: string): void {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new BadRequestException({
      code: 'weak_password',
      message: `Пароль должен быть от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов`,
    })
  }
  if (password.trim().toLowerCase() === email.trim().toLowerCase()) {
    throw new BadRequestException({
      code: 'weak_password',
      message: 'Пароль не должен совпадать с email',
    })
  }
}
