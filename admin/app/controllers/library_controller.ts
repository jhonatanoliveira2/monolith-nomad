import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { LibraryNotFoundError, LibraryService } from '#services/library_service'
import { libraryDownloadValidator, libraryFileParamsValidator } from '#validators/library'
import { formatOfFilename, LIBRARY_MIME_TYPES } from '../utils/library.js'

export default class LibraryController {
  private readonly library = new LibraryService()

  /** Library page: catalog by area, subject and level. */
  async index({ inertia }: HttpContext) {
    return inertia.render('library/index')
  }

  /** Offline reader for an installed PDF/EPUB. */
  async read({ inertia, request, response }: HttpContext) {
    const { params } = await request.validateUsing(libraryFileParamsValidator)
    const path = await this.library.resolveInstalledFile(params.filename)
    if (!path) return response.redirect('/library')
    const { items } = await this.library.getItemsWithStatus()
    const item = items.find((i) =>
      i.files.some((f) => 'filename' in f && f.filename === params.filename)
    )
    return inertia.render('library/read', {
      filename: params.filename,
      format: formatOfFilename(params.filename),
      title: item?.title ?? params.filename,
      authors: item?.authors ?? [],
      license: item?.license ?? null,
      sourceUrl: item?.source_url ?? null,
    })
  }

  async list({ response }: HttpContext) {
    const { spec, items } = await this.library.getItemsWithStatus()
    return response.status(200).json({
      spec_version: spec?.spec_version ?? null,
      areas: spec?.areas ?? [],
      items,
    })
  }

  async download({ request, response }: HttpContext) {
    const { itemId, format } = await request.validateUsing(libraryDownloadValidator)
    try {
      return response.status(200).json(await this.library.download(itemId, format))
    } catch (error) {
      if (error instanceof LibraryNotFoundError)
        return response.status(404).json({ error: error.message })
      logger.error({ err: error }, '[LibraryController] download failed')
      return response.status(500).json({ error: 'Could not queue the download' })
    }
  }

  async remove({ request, response }: HttpContext) {
    const { itemId, format } = await request.validateUsing(libraryDownloadValidator)
    if (format === 'zim') {
      return response.status(400).json({ error: 'ZIM files are managed in Settings > Content' })
    }
    try {
      await this.library.remove(itemId, format)
      return response.status(200).json({ success: true })
    } catch (error) {
      if (error instanceof LibraryNotFoundError)
        return response.status(404).json({ error: error.message })
      throw error
    }
  }

  /** Serve an installed PDF/EPUB inline (the reader and the browser's PDF viewer load it from here). */
  async file({ request, response }: HttpContext) {
    const { params } = await request.validateUsing(libraryFileParamsValidator)
    const path = await this.library.resolveInstalledFile(params.filename)
    const format = formatOfFilename(params.filename)
    if (!path || !format) return response.status(404).json({ error: 'File not found' })
    response.header('Content-Type', LIBRARY_MIME_TYPES[format])
    response.header('Content-Disposition', `inline; filename="${params.filename}"`)
    response.header('X-Content-Type-Options', 'nosniff')
    return response.download(path)
  }
}
