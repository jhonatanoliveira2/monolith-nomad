import { basename, join, resolve, sep } from 'node:path'
import type {
  LibraryDocumentFile,
  LibraryDocumentFormat,
  LibraryFile,
  LibraryItem,
  LibraryZimFile,
} from '../../types/library.js'

/** Pure rules of the library (no I/O), shared by LibraryService, the file route and the tests. */

export const LIBRARY_MIME_TYPES: Record<LibraryDocumentFormat, string> = {
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
}

/**
 * Content types a publisher may legitimately answer with for a PDF/EPUB: GitHub releases and
 * docs.python.org serve EPUBs as application/octet-stream. The real format is checked from the bytes
 * after the download (document_format.ts), so this list only filters out obvious HTML pages.
 */
export const LIBRARY_ALLOWED_DOWNLOAD_MIME_TYPES = [
  'application/pdf',
  'application/epub+zip',
  'application/octet-stream',
  'application/x-download',
  'binary/octet-stream',
]

export function isDocumentFile(file: LibraryFile): file is LibraryDocumentFile {
  return file.format === 'pdf' || file.format === 'epub'
}

export function isZimFile(file: LibraryFile): file is LibraryZimFile {
  return file.format === 'zim'
}

/** A file entry the service can act on: documents need url + size + sha256 field, ZIMs a zim_id. */
export function isValidLibraryFile(file: LibraryFile): boolean {
  if (isZimFile(file)) return typeof file.zim_id === 'string' && file.zim_id.length > 0
  if (!isDocumentFile(file)) return false
  return (
    typeof file.url === 'string' &&
    file.url.startsWith('https://') &&
    typeof file.size_bytes === 'number' &&
    file.size_bytes > 0 &&
    (file.sha256 === null || /^[0-9a-f]{64}$/.test(file.sha256 ?? ''))
  )
}

/**
 * InstalledResource.resource_id of a library document: one row per (work, format), so a PDF and an
 * EPUB of the same work are tracked separately.
 */
export function documentResourceId(
  item: Pick<LibraryItem, 'id'>,
  format: LibraryDocumentFormat
): string {
  return `${item.id}-${format}`
}

/**
 * File name on disk: `<resource_id>_<version>.<ext>`. It starts with the resource id followed by `_`,
 * which is what RunDownloadJob's isSafeOldContentPath requires before deleting a replaced version.
 */
export function documentFilename(
  item: Pick<LibraryItem, 'id' | 'version'>,
  format: LibraryDocumentFormat
): string {
  return `${documentResourceId(item, format)}_${item.version}.${format}`
}

const SERVED_NAME = /^[a-z0-9][a-z0-9-]*_[0-9A-Za-z.-]+\.(pdf|epub)$/

/**
 * Absolute path of a library file that may be served, or null. Accepts only names the library writes
 * and only inside the library root (no traversal, no other storage area).
 */
export function resolveLibraryFile(libraryRoot: string, filename: string): string | null {
  if (!SERVED_NAME.test(filename) || filename !== basename(filename)) return null
  const root = resolve(libraryRoot)
  const full = resolve(join(root, filename))
  return full.startsWith(root + sep) ? full : null
}

export function formatOfFilename(filename: string): LibraryDocumentFormat | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.epub')) return 'epub'
  return null
}

/**
 * Inverse of documentFilename: `<item id>-<format>_<version>.<ext>` → its parts, or null for any other
 * name. Item ids may contain hyphens, so the format is the last `-pdf`/`-epub` before the `_`.
 */
export function parseDocumentFilename(
  filename: string
): { itemId: string; format: LibraryDocumentFormat; version: string } | null {
  const match = /^([a-z0-9][a-z0-9-]*)-(pdf|epub)_([0-9A-Za-z.-]+)\.(pdf|epub)$/.exec(filename)
  if (!match || match[2] !== match[4]) return null
  return { itemId: match[1], format: match[2] as LibraryDocumentFormat, version: match[3] }
}
