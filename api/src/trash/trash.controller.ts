import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common'
import { CurrentUser, SkipAudit } from '../common/decorators.js'
import type { AppRequest, AuthUser } from '../common/request.js'
import { type TrashKind, TrashService } from './trash.service.js'

function kindOf(value: string): TrashKind {
  if (value === 'document' || value === 'media') return value
  throw new BadRequestException({ code: 'bad_kind', message: 'Unknown trash kind' })
}

/**
 * Any signed-in user may open the trash; each one sees only what their role may restore.
 * The services write the audit entries.
 */
@Controller('admin/trash')
@SkipAudit()
export class TrashController {
  constructor(private readonly trash: TrashService) {}

  @Get()
  async list(@CurrentUser() actor: AuthUser) {
    return { items: await this.trash.list(actor) }
  }

  @Post(':kind/:id/restore')
  @HttpCode(204)
  async restore(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    await this.trash.restore(kindOf(kind), id, actor, req)
  }

  @Delete(':kind/:id')
  @HttpCode(204)
  async purge(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AppRequest,
  ) {
    await this.trash.purge(kindOf(kind), id, actor, req)
  }
}
