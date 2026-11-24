/**
 * Library catalogue filtering (pure, unit-tested in tests/unit/library_filters.spec.ts).
 *
 * Facets: area → subject (the subcategory), language, level, format and offline availability, plus a
 * free-text query. Facet counts are computed with every *other* facet applied, so each option says how
 * many works it would show if chosen. Filters live in the URL (?q=&area=&subject=&lang=&level=&format=
 * &status=&sort=) so a filtered view can be bookmarked and survives going back from the reader.
 */
import type {
  LibraryFileWithStatus,
  LibraryItemWithStatus,
  LibraryLevel,
} from '../../types/library.js'

export const LIBRARY_FORMATS = ['pdf', 'epub', 'zim'] as const
export type LibraryFormatFilter = (typeof LIBRARY_FORMATS)[number]

export const LIBRARY_STATUSES = ['all', 'offline', 'available', 'downloading'] as const
export type LibraryStatusFilter = (typeof LIBRARY_STATUSES)[number]

export const LIBRARY_SORTS = ['catalog', 'title', 'year', 'size'] as const
export type LibrarySort = (typeof LIBRARY_SORTS)[number]

export const LEVEL_ORDER: LibraryLevel[] = ['iniciante', 'intermediario', 'avancado']

export type LibraryFilters = {
  q: string
  area: string | null
  subject: string | null
  lang: string | null
  level: LibraryLevel | null
  format: LibraryFormatFilter | null
  status: LibraryStatusFilter
  sort: LibrarySort
}

export const EMPTY_FILTERS: LibraryFilters = {
  q: '',
  area: null,
  subject: null,
  lang: null,
  level: null,
  format: null,
  status: 'all',
  sort: 'catalog',
}

/** Accent- and case-insensitive form used for search. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function isInstalled(file: LibraryFileWithStatus): boolean {
  return file.status === 'installed' || file.status === 'update_available'
}

export function itemAvailability(
  item: LibraryItemWithStatus
): 'offline' | 'downloading' | 'available' {
  if (item.files.some((f) => f.status === 'downloading')) return 'downloading'
  if (item.files.some(isInstalled)) return 'offline'
  return 'available'
}

export function fileSize(file: LibraryFileWithStatus): number | undefined {
  return 'size_bytes' in file ? file.size_bytes : file.zim_size_bytes
}

/** The smallest download of a work (what "size" sorts by). */
export function itemSize(item: LibraryItemWithStatus): number {
  const sizes = item.files.map(fileSize).filter((s): s is number => typeof s === 'number')
  return sizes.length ? Math.min(...sizes) : Number.POSITIVE_INFINITY
}

type Facet = 'q' | 'area' | 'subject' | 'lang' | 'level' | 'format' | 'status'

function matches(item: LibraryItemWithStatus, f: LibraryFilters, skip?: Facet): boolean {
  if (skip !== 'area' && f.area && !item.areas.includes(f.area)) return false
  if (skip !== 'subject' && f.subject && !item.subjects.includes(f.subject)) return false
  if (skip !== 'lang' && f.lang && item.language !== f.lang) return false
  if (skip !== 'level' && f.level && !item.levels.includes(f.level)) return false
  if (skip !== 'format' && f.format && !item.files.some((x) => x.format === f.format)) return false
  if (skip !== 'status' && f.status !== 'all' && itemAvailability(item) !== f.status) return false
  if (skip !== 'q' && f.q.trim()) {
    const hay = fold(
      [
        item.title,
        item.description,
        item.publisher,
        item.edition,
        item.year,
        ...item.authors,
        ...item.subjects,
      ].join(' ')
    )
    if (
      !fold(f.q)
        .trim()
        .split(/\s+/)
        .every((w) => hay.includes(w))
    )
      return false
  }
  return true
}

export function filterItems(
  items: LibraryItemWithStatus[],
  f: LibraryFilters
): LibraryItemWithStatus[] {
  const out = items.filter((i) => matches(i, f))
  switch (f.sort) {
    case 'title':
      return [...out].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    case 'year':
      return [...out].sort(
        (a, b) => b.year.localeCompare(a.year) || a.title.localeCompare(b.title, 'pt-BR')
      )
    case 'size':
      return [...out].sort((a, b) => itemSize(a) - itemSize(b))
    default:
      return out
  }
}

function countBy<K extends string>(
  items: LibraryItemWithStatus[],
  f: LibraryFilters,
  facet: Facet,
  keys: (i: LibraryItemWithStatus) => K[]
): Map<K, number> {
  const counts = new Map<K, number>()
  for (const item of items) {
    if (!matches(item, f, facet)) continue
    for (const k of new Set(keys(item))) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

export type FacetCounts = {
  area: Map<string, number>
  subject: Map<string, number>
  lang: Map<string, number>
  level: Map<LibraryLevel, number>
  format: Map<LibraryFormatFilter, number>
  status: Map<LibraryStatusFilter, number>
}

export function facetCounts(items: LibraryItemWithStatus[], f: LibraryFilters): FacetCounts {
  const status = countBy(items, f, 'status', (i) => [itemAvailability(i)] as LibraryStatusFilter[])
  status.set('all', items.filter((i) => matches(i, f, 'status')).length)
  return {
    area: countBy(items, f, 'area', (i) => i.areas),
    subject: countBy(items, f, 'subject', (i) => i.subjects),
    lang: countBy(items, f, 'lang', (i) => [i.language]),
    level: countBy(items, f, 'level', (i) => i.levels),
    format: countBy(items, f, 'format', (i) => i.files.map((x) => x.format)),
    status,
  }
}

export function activeFilterCount(f: LibraryFilters): number {
  return (
    (f.area ? 1 : 0) +
    (f.subject ? 1 : 0) +
    (f.lang ? 1 : 0) +
    (f.level ? 1 : 0) +
    (f.format ? 1 : 0) +
    (f.status !== 'all' ? 1 : 0)
  )
}

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null
}

export function filtersFromSearch(search: string): LibraryFilters {
  const p = new URLSearchParams(search)
  return {
    q: p.get('q') ?? '',
    area: p.get('area') || null,
    subject: p.get('subject') || null,
    lang: p.get('lang') || null,
    level: pick(p.get('level'), LEVEL_ORDER),
    format: pick(p.get('format'), LIBRARY_FORMATS),
    status: pick(p.get('status'), LIBRARY_STATUSES) ?? 'all',
    sort: pick(p.get('sort'), LIBRARY_SORTS) ?? 'catalog',
  }
}

export function filtersToSearch(f: LibraryFilters): string {
  const p = new URLSearchParams()
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.area) p.set('area', f.area)
  if (f.subject) p.set('subject', f.subject)
  if (f.lang) p.set('lang', f.lang)
  if (f.level) p.set('level', f.level)
  if (f.format) p.set('format', f.format)
  if (f.status !== 'all') p.set('status', f.status)
  if (f.sort !== 'catalog') p.set('sort', f.sort)
  const s = p.toString()
  return s ? `?${s}` : ''
}

/** English i18n key for a content language code (translated by the caller). */
export function languageLabel(code: string): string {
  switch (code.toLowerCase()) {
    case 'pt':
    case 'pt-br':
      return 'Portuguese'
    case 'pt-pt':
      return 'Portuguese (Portugal)'
    case 'es':
      return 'Spanish'
    case 'en':
      return 'English'
    case 'mul':
      return 'Multilingual'
    default:
      return code.toUpperCase()
  }
}

/** Recently opened documents (written by the reader), newest first. */
export type RecentDocument = { filename: string; title: string; format: 'pdf' | 'epub'; at: number }
export const RECENT_KEY = 'nomad:library:recent'

export function pushRecent(
  list: RecentDocument[],
  entry: RecentDocument,
  max = 8
): RecentDocument[] {
  return [entry, ...list.filter((r) => r.filename !== entry.filename)].slice(0, max)
}
