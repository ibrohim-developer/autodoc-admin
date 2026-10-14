import { Global, Module } from '@nestjs/common'
import { ContentTypeRegistry } from './content-types.js'

/** One registry for the whole app: content, media ("used in…") and trash all read it. */
@Global()
@Module({
  providers: [ContentTypeRegistry],
  exports: [ContentTypeRegistry],
})
export class ContentTypesModule {}
