import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import type { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import { originCheck } from './common/origin-check.js'
import type { Env } from './config/env.js'

/** Shared by main.ts and the e2e tests, so tests run the app exactly as production does. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService)

  // nginx runs on the same machine; trust its X-Forwarded-For so req.ip is the visitor.
  app.set('trust proxy', 'loopback')
  app.disable('x-powered-by')
  const https = config.get('COOKIE_SECURE', { infer: true })
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // Radix/shadcn components set inline style attributes.
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          // Over plain http (local runs) this would send every asset request to https.
          upgradeInsecureRequests: https ? [] : null,
        },
      },
      strictTransportSecurity: https,
    }),
  )
  // The browser has no business with camera, microphone or location on any of these pages.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
    next()
  })
  app.use(cookieParser())
  app.use('/api/admin', originCheck(config.get('ADMIN_ORIGIN', { infer: true })))
  // Admin answers carry names, phones and resumes: never kept by the browser or a proxy.
  // (Express's ETag would also let a shared cache revalidate them.)
  app.set('etag', false)
  app.use('/api/admin', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  )
  app.enableShutdownHooks()

  if (config.get('SWAGGER', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('autodoc.uz admin API').setVersion('1').build(),
    )
    SwaggerModule.setup('api/docs', app, document)
  }
}
