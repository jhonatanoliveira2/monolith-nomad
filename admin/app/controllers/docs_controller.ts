import { DocsService } from '#services/docs_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { LOCALE_COOKIE, resolveLocale } from '../utils/locale.js'

@inject()
export default class DocsController {
    constructor(
        private docsService: DocsService
    ) { }

  /** Interface language chosen in the browser (cookie set by inertia/lib/i18n.ts); pt-BR by default. */
  private locale({ request }: HttpContext) {
    return resolveLocale(request.plainCookie(LOCALE_COOKIE, { encoded: false }))
  }

  async list(ctx: HttpContext) {
    return await this.docsService.getDocs(this.locale(ctx))
  }

  async show(ctx: HttpContext) {
    const content = await this.docsService.parseFile(ctx.params.slug, this.locale(ctx))
    return ctx.inertia.render('docs/show', {
      content,
    })
  }
}
