import logger from '@adonisjs/core/services/logger'
import { join } from 'node:path'
import InstalledResource from '#models/installed_resource'
import { RunDownloadJob } from '#jobs/run_download_job'
import { QueueService } from './queue_service.js'
import { CollectionManifestService } from './collection_manifest_service.js'
import { KiwixCatalogService } from './kiwix_catalog_service.js'
import { resolveZimDownload } from '../utils/zim_download_resolution.js'
import {
  deleteFileIfExists,
  ensureDirectoryExists,
  getFileStatsIfExists,
  LIBRARY_STORAGE_PATH,
  ZIM_STORAGE_PATH,
} from '../utils/fs.js'
import {
  documentFilename,
  documentResourceId,
  isDocumentFile,
  isValidLibraryFile,
  isZimFile,
  LIBRARY_ALLOWED_DOWNLOAD_MIME_TYPES,
  resolveLibraryFile,
} from '../utils/library.js'
import type {
  LibraryDocumentFormat,
  LibraryFileWithStatus,
  LibraryFormat,
  LibraryItem,
  LibraryItemWithStatus,
  LibrarySpec,
} from '../../types/library.js'
import type { SpecResource, ZimCategoriesSpec } from '../../types/collections.js'

const ZIM_MIME_TYPES = ['application/x-zim', 'application/x-openzim', 'application/octet-stream']
const COLLECTION_REF = 'library'

export class LibraryNotFoundError extends Error {}

/**
 * The library (collections/library.json): PDFs and EPUBs from the publishers' official URLs, plus the
 * ZIMs of kiwix-categories.json, organised by area, subject and level.
 *
 * Documents are downloaded by the regular RunDownloadJob (resume, retries, SHA-256 pinned in the
 * manifest, format check) into storage/library, recorded as InstalledResource 'document' rows and fed
 * to the knowledge base like ZIMs. ZIM entries are only a view over the existing ZIM resources: they
 * download through the same path as the curated categories and share their install state.
 */
export class LibraryService {
  private readonly manifests = new CollectionManifestService()

  static libraryRoot(): string {
    return join(process.cwd(), LIBRARY_STORAGE_PATH)
  }

  async getSpec(): Promise<LibrarySpec | null> {
    const spec = await this.manifests.getSpecWithFallback<LibrarySpec>('library')
    if (!spec) return null
    // Drop malformed file entries instead of failing the whole page.
    return {
      ...spec,
      items: spec.items.map((item) => ({ ...item, files: item.files.filter(isValidLibraryFile) })),
    }
  }

  private async zimResources(): Promise<Map<string, SpecResource>> {
    const spec = await this.manifests.getSpecWithFallback<ZimCategoriesSpec>('zim_categories')
    const map = new Map<string, SpecResource>()
    for (const c of spec?.categories ?? []) {
      for (const t of c.tiers) for (const r of t.resources) map.set(r.id, r)
    }
    return map
  }

  /** URLs of downloads still queued or running (one Redis round trip, not one per file). */
  private async activeDownloadUrls(): Promise<Set<string>> {
    try {
      const queue = QueueService.getInstance().getQueue(RunDownloadJob.queue)
      const jobs = await queue.getJobs(['active', 'waiting', 'delayed'])
      return new Set(jobs.map((j) => j?.data?.url).filter(Boolean))
    } catch {
      return new Set()
    }
  }

  async getItemsWithStatus(): Promise<{
    spec: LibrarySpec | null
    items: LibraryItemWithStatus[]
  }> {
    const spec = await this.getSpec()
    if (!spec) return { spec: null, items: [] }

    const [installed, zims, active] = await Promise.all([
      InstalledResource.query().whereIn('resource_type', ['document', 'zim']),
      this.zimResources(),
      this.activeDownloadUrls(),
    ])
    const byKey = new Map(installed.map((r) => [`${r.resource_type}:${r.resource_id}`, r]))

    const items = spec.items.map((item) => ({
      ...item,
      files: item.files.map((file): LibraryFileWithStatus => {
        if (isZimFile(file)) {
          const resource = zims.get(file.zim_id)
          const row = byKey.get(`zim:${file.zim_id}`)
          const downloading = !!resource && active.has(resource.url)
          return {
            ...file,
            zim_size_bytes: resource ? resource.size_mb * 1024 * 1024 : undefined,
            status: downloading
              ? 'downloading'
              : row
                ? resource && row.version < resource.version
                  ? 'update_available'
                  : 'installed'
                : 'available',
          }
        }
        const format = file.format as LibraryDocumentFormat
        const row = byKey.get(`document:${documentResourceId(item, format)}`)
        if (active.has(file.url)) return { ...file, status: 'downloading' }
        if (!row) return { ...file, status: 'available' }
        return {
          ...file,
          filename: row.file_path.split(/[/\\]/).pop(),
          status: row.version !== item.version ? 'update_available' : 'installed',
        }
      }),
    }))
    return { spec, items }
  }

  private async findItem(itemId: string): Promise<LibraryItem> {
    const spec = await this.getSpec()
    const item = spec?.items.find((i) => i.id === itemId)
    if (!item) throw new LibraryNotFoundError(`Library item not found: ${itemId}`)
    return item
  }

  /** Queue the download of one file of a work. Returns queued: false when it was already queued/installed. */
  async download(
    itemId: string,
    format: LibraryFormat
  ): Promise<{ queued: boolean; message: string }> {
    const item = await this.findItem(itemId)
    const file = item.files.find((f) => f.format === format)
    if (!file) throw new LibraryNotFoundError(`${itemId} has no ${format} file`)

    if (isZimFile(file)) return this.downloadZim(item, file.zim_id)
    if (!isDocumentFile(file)) throw new LibraryNotFoundError(`${itemId}: unsupported file`)

    const resourceId = documentResourceId(item, file.format)
    const existing = await InstalledResource.query()
      .where('resource_type', 'document')
      .where('resource_id', resourceId)
      .first()
    if (
      existing &&
      existing.version === item.version &&
      (await getFileStatsIfExists(existing.file_path))
    ) {
      return { queued: false, message: 'Already installed' }
    }
    if (await RunDownloadJob.getActiveByUrl(file.url)) {
      return { queued: false, message: 'Download already in progress' }
    }

    await ensureDirectoryExists(LibraryService.libraryRoot())
    await RunDownloadJob.dispatch({
      url: file.url,
      filepath: join(LibraryService.libraryRoot(), documentFilename(item, file.format)),
      timeout: 30000,
      allowedMimeTypes: LIBRARY_ALLOWED_DOWNLOAD_MIME_TYPES,
      filetype: 'document',
      title: `${item.title} (${file.format.toUpperCase()})`,
      totalBytes: file.size_bytes,
      expectedSha256: file.sha256,
      resourceMetadata: {
        resource_id: resourceId,
        version: item.version,
        collection_ref: COLLECTION_REF,
      },
    })
    logger.info(`[LibraryService] Queued ${resourceId} (${item.version}) from ${file.url}`)
    return { queued: true, message: 'Download queued' }
  }

  private async downloadZim(
    item: LibraryItem,
    zimId: string
  ): Promise<{ queued: boolean; message: string }> {
    const zims = await this.zimResources()
    const resource = zims.get(zimId)
    if (!resource) throw new LibraryNotFoundError(`${item.id}: ZIM ${zimId} is not in the catalog`)
    const installed = await InstalledResource.query()
      .where('resource_type', 'zim')
      .where('resource_id', zimId)
      .first()
    if (installed) return { queued: false, message: 'Already installed' }

    const latest = await new KiwixCatalogService().getLatestForResources([
      { resource_id: zimId, resource_type: 'zim' },
    ])
    const resolved = resolveZimDownload(resource, latest.get(`zim:${zimId}`) ?? null)
    if (await RunDownloadJob.getActiveByUrl(resolved.url)) {
      return { queued: false, message: 'Download already in progress' }
    }
    const filename = resolved.url.split('/').pop()!
    await RunDownloadJob.dispatch({
      url: resolved.url,
      filepath: join(process.cwd(), ZIM_STORAGE_PATH, filename),
      timeout: 30000,
      allowedMimeTypes: ZIM_MIME_TYPES,
      filetype: 'zim',
      title: resource.title,
      totalBytes: resolved.sizeBytes,
      resourceMetadata: {
        resource_id: zimId,
        version: resolved.version,
        collection_ref: COLLECTION_REF,
      },
    })
    return { queued: true, message: 'Download queued' }
  }

  /** Remove a downloaded document (file, install row and its knowledge-base points). */
  async remove(itemId: string, format: LibraryDocumentFormat): Promise<void> {
    const item = await this.findItem(itemId)
    const row = await InstalledResource.query()
      .where('resource_type', 'document')
      .where('resource_id', documentResourceId(item, format))
      .first()
    if (!row) return
    const filename = row.file_path.split(/[/\\]/).pop() ?? ''
    const path = resolveLibraryFile(LibraryService.libraryRoot(), filename)
    if (path) {
      try {
        const { RagService } = await import('./rag_service.js')
        const { DockerService } = await import('./docker_service.js')
        const { OllamaService } = await import('./ollama_service.js')
        await new RagService(new DockerService(), new OllamaService()).deleteFileBySource(path)
      } catch (error) {
        logger.warn(
          `[LibraryService] Could not remove ${filename} from the knowledge base: ${error}`
        )
      }
      await deleteFileIfExists(path)
    }
    await row.delete()
  }

  /**
   * Absolute path of an installed library file, or null. Serves only names that a library install row
   * points to, inside storage/library: the route can never be used to read anything else.
   */
  async resolveInstalledFile(filename: string): Promise<string | null> {
    const path = resolveLibraryFile(LibraryService.libraryRoot(), filename)
    if (!path) return null
    const rows = await InstalledResource.query().where('resource_type', 'document')
    if (!rows.some((r) => r.file_path.split(/[/\\]/).pop() === filename)) return null
    return (await getFileStatsIfExists(path)) ? path : null
  }
}
