import { Module, type OnModuleInit } from '@nestjs/common'
import { ContentModule } from '../content/content.module.js'
import { type ContentTypeDef, ContentTypeRegistry } from '../content/content-types.js'
import { postCategoryType, postType } from './news.js'
import { LEGAL_TYPES, PAGE_TYPES, siteSettingsType } from './pages.js'
import { PublicRedirectsController, redirectType } from './redirects.js'
import { SiteTextsController } from './site-texts.controller.js'
import { siteTextsType } from './site-texts.js'
import { vacancyDirectionType, vacancyType } from './vacancies.js'

/** Every content type of autodoc.uz. The engine they run on is in ../content. */
export const SITE_TYPES: ContentTypeDef[] = [
  postType,
  postCategoryType,
  vacancyType,
  vacancyDirectionType,
  siteTextsType,
  siteSettingsType,
  redirectType,
  ...PAGE_TYPES,
  ...LEGAL_TYPES,
]

@Module({
  imports: [ContentModule],
  controllers: [SiteTextsController, PublicRedirectsController],
})
export class SiteContentModule implements OnModuleInit {
  constructor(private readonly registry: ContentTypeRegistry) {}

  onModuleInit(): void {
    for (const type of SITE_TYPES) this.registry.register(type)
  }
}
