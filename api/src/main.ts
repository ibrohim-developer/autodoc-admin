import 'reflect-metadata'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.js'
import { configureApp } from './app.setup.js'
import type { Env } from './config/env.js'

const app = await NestFactory.create<NestExpressApplication>(AppModule)
configureApp(app)

const config = app.get<ConfigService<Env, true>>(ConfigService)
await app.listen(config.get('PORT', { infer: true }), config.get('HOST', { infer: true }))
