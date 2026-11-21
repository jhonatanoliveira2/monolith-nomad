/**
 * Library catalog (collections/library.json): books, manuals and reference works in PDF, EPUB or ZIM,
 * organised by area, subject and level. One work appears once and lists every area, subject and level
 * it serves.
 *
 * Only openly licensed or public-domain works whose licence was verified in the file itself are listed;
 * the bytes come from the publisher's official URL and are never modified (no conversion, no
 * re-hosting).
 */

export const LIBRARY_LEVELS = ['iniciante', 'intermediario', 'avancado'] as const
export type LibraryLevel = (typeof LIBRARY_LEVELS)[number]

export const LIBRARY_DOCUMENT_FORMATS = ['pdf', 'epub'] as const
export type LibraryDocumentFormat = (typeof LIBRARY_DOCUMENT_FORMATS)[number]
export type LibraryFormat = LibraryDocumentFormat | 'zim'

export type LibraryArea = {
  slug: string
  name: string
  description: string
  icon: string
}

/** A downloadable PDF/EPUB from the publisher's official URL. */
export type LibraryDocumentFile = {
  format: LibraryDocumentFormat
  url: string
  size_bytes: number
  /**
   * Lower-case hex SHA-256 of the publisher's file, computed at curation time. The download is rejected
   * on a mismatch (the source changed or served something else). Null only for works the publisher
   * rebuilds continuously (e.g. the Python documentation), where a pinned hash would always fail; those
   * still get the format check.
   */
  sha256: string | null
}

/** A ZIM already described in kiwix-categories.json; downloaded through the regular ZIM path. */
export type LibraryZimFile = {
  format: 'zim'
  /** Resource id in kiwix-categories.json (e.g. `wikibooks_pt_all_maxi`). */
  zim_id: string
}

export type LibraryFile = LibraryDocumentFile | LibraryZimFile

export type LibraryLicense = {
  /** SPDX-style id (CC-BY-SA-4.0, CC-BY-NC-ND-4.0, PSF-2.0...). */
  id: string
  name: string
  url: string
  /** What the licence requires when showing or sharing the work. */
  attribution: string
}

export type LibraryItem = {
  id: string
  /** Edition marker used in file names and update detection (YYYY-MM of the file, or the edition). */
  version: string
  title: string
  authors: string[]
  publisher: string
  edition: string
  year: string
  /** Content language: pt, pt-PT, es, mul... */
  language: string
  description: string
  areas: string[]
  subjects: string[]
  levels: LibraryLevel[]
  /** Official page of the work (also the fallback when a download link is unavailable). */
  source_url: string
  license: LibraryLicense
  /** Shown next to the title, e.g. "não substitui o Diário Oficial", "edição de 2014". */
  notes?: string
  files: LibraryFile[]
}

export type LibrarySpec = {
  spec_version: string
  areas: LibraryArea[]
  items: LibraryItem[]
}

export type LibraryFileStatus = 'available' | 'installed' | 'update_available' | 'downloading'

export type LibraryFileWithStatus = LibraryFile & {
  status: LibraryFileStatus
  /** Filled for installed documents: the name served by /api/library/files/:filename. */
  filename?: string
  /** Size of a ZIM resolved from kiwix-categories.json (documents carry size_bytes). */
  zim_size_bytes?: number
}

export type LibraryItemWithStatus = Omit<LibraryItem, 'files'> & {
  files: LibraryFileWithStatus[]
}
