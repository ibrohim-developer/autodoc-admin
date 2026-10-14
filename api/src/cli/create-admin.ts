import 'reflect-metadata'
import { parseArgs } from 'node:util'
import { NestFactory } from '@nestjs/core'
import { UsersService } from '../users/users.service.js'
import { CliModule } from './cli.module.js'

/**
 * Creates the first administrator on a fresh server:
 *   pnpm --filter @autodoc/api user:create-admin --email admin@autodoc.uz --name "Имя Фамилия"
 * Prints a one-time link (valid 7 days) where they set their password.
 */
const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' } },
})

if (!values.email || !values.name) {
  console.error('Usage: user:create-admin --email admin@autodoc.uz --name "Имя Фамилия"')
  process.exit(1)
}

const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] })
try {
  const link = await app.get(UsersService).createInitialAdmin(values.email, values.name)
  console.log(`Administrator ${values.email} created.\nSet the password within 7 days:\n${link}`)
} finally {
  await app.close()
}
