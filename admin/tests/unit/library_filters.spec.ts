import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  EMPTY_FILTERS,
  activeFilterCount,
  facetCounts,
  filterItems,
  filtersFromSearch,
  filtersToSearch,
  itemAvailability,
  pushRecent,
} from '../../inertia/lib/library_filters.js'
import type { LibraryItemWithStatus } from '../../types/library.js'

function item(overrides: Partial<LibraryItemWithStatus>): LibraryItemWithStatus {
  return {
    id: 'x',
    version: '2026-01',
    title: 'Título',
    authors: ['Autor'],
    publisher: 'Editora',
    edition: '1ª edição',
    year: '2020',
    language: 'pt',
    description: 'Descrição',
    areas: ['matematica'],
    subjects: ['Cálculo'],
    levels: ['iniciante'],
    source_url: 'https://example.org',
    license: { id: 'CC-BY-4.0', name: 'CC BY 4.0', url: 'https://example.org/l', attribution: '' },
    files: [
      {
        format: 'pdf',
        url: 'https://example.org/a.pdf',
        size_bytes: 10,
        sha256: null,
        status: 'available',
      },
    ],
    ...overrides,
  }
}

const ITEMS: LibraryItemWithStatus[] = [
  item({
    id: 'calc',
    title: 'Cálculo',
    year: '2023',
    subjects: ['Cálculo', 'Limites'],
    levels: ['intermediario'],
  }),
  item({
    id: 'git',
    title: 'Pro Git',
    areas: ['computacao'],
    subjects: ['Git'],
    year: '2014',
    files: [
      {
        format: 'epub',
        url: 'https://e/a.epub',
        size_bytes: 5,
        sha256: 'ab',
        status: 'installed',
        filename: 'git-epub.epub',
      },
      { format: 'pdf', url: 'https://e/a.pdf', size_bytes: 50, sha256: 'cd', status: 'available' },
    ],
  }),
  item({
    id: 'wiki',
    title: 'Wikilivros',
    language: 'mul',
    areas: ['educacao', 'computacao'],
    subjects: ['Didáticos'],
    files: [{ format: 'zim', zim_id: 'wikibooks', status: 'downloading', zim_size_bytes: 900 }],
  }),
  item({
    id: 'lengua',
    title: 'Lengua Española II',
    language: 'es',
    areas: ['idiomas'],
    subjects: ['Espanhol'],
  }),
]

const ids = (list: LibraryItemWithStatus[]) => list.map((i) => i.id)

test('the free-text query is accent- and case-insensitive and needs every word', () => {
  assert.deepEqual(ids(filterItems(ITEMS, { ...EMPTY_FILTERS, q: 'calculo' })), ['calc'])
  assert.deepEqual(ids(filterItems(ITEMS, { ...EMPTY_FILTERS, q: 'PRO git' })), ['git'])
  assert.deepEqual(filterItems(ITEMS, { ...EMPTY_FILTERS, q: 'pro calculo' }), [])
})

test('area, subject, language, level and format filters combine', () => {
  const f = { ...EMPTY_FILTERS, area: 'computacao' }
  assert.deepEqual(ids(filterItems(ITEMS, f)), ['git', 'wiki'])
  assert.deepEqual(ids(filterItems(ITEMS, { ...f, format: 'zim' })), ['wiki'])
  assert.deepEqual(ids(filterItems(ITEMS, { ...EMPTY_FILTERS, lang: 'es' })), ['lengua'])
  assert.deepEqual(ids(filterItems(ITEMS, { ...EMPTY_FILTERS, level: 'intermediario' })), ['calc'])
  assert.deepEqual(ids(filterItems(ITEMS, { ...EMPTY_FILTERS, subject: 'Limites' })), ['calc'])
})

test('availability: a downloading file wins over an installed one; offline means installed', () => {
  assert.equal(itemAvailability(ITEMS[1]), 'offline')
  assert.equal(itemAvailability(ITEMS[2]), 'downloading')
  assert.equal(itemAvailability(ITEMS[0]), 'available')
  assert.deepEqual(ids(filterItems(ITEMS, { ...EMPTY_FILTERS, status: 'offline' })), ['git'])
})

test('facet counts ignore their own facet but apply the others', () => {
  const counts = facetCounts(ITEMS, { ...EMPTY_FILTERS, area: 'computacao' })
  // area counts are computed without the area filter
  assert.equal(counts.area.get('matematica'), 1)
  assert.equal(counts.area.get('computacao'), 2)
  // format counts apply the area filter
  assert.equal(counts.format.get('pdf'), 1)
  assert.equal(counts.format.get('zim'), 1)
  assert.equal(counts.status.get('all'), 2)
  assert.equal(counts.status.get('offline'), 1)
})

test('sorting by title, year and smallest download', () => {
  assert.deepEqual(ids(filterItems(ITEMS, { ...EMPTY_FILTERS, sort: 'title' })), [
    'calc',
    'lengua',
    'git',
    'wiki',
  ])
  assert.equal(filterItems(ITEMS, { ...EMPTY_FILTERS, sort: 'year' })[0].id, 'calc')
  assert.equal(filterItems(ITEMS, { ...EMPTY_FILTERS, sort: 'size' })[0].id, 'git')
})

test('filters round-trip through the URL and reject unknown values', () => {
  const f = {
    ...EMPTY_FILTERS,
    q: 'git',
    area: 'computacao',
    format: 'epub' as const,
    status: 'offline' as const,
    sort: 'title' as const,
  }
  assert.deepEqual(filtersFromSearch(filtersToSearch(f)), f)
  assert.equal(filtersToSearch(EMPTY_FILTERS), '')
  const bad = filtersFromSearch('?format=exe&status=gone&level=expert&sort=random')
  assert.equal(bad.format, null)
  assert.equal(bad.status, 'all')
  assert.equal(bad.level, null)
  assert.equal(bad.sort, 'catalog')
  assert.equal(activeFilterCount(f), 3)
})

test('recent documents keep the newest first, without duplicates, up to the limit', () => {
  let list = pushRecent([], { filename: 'a.pdf', title: 'A', format: 'pdf', at: 1 })
  list = pushRecent(list, { filename: 'b.epub', title: 'B', format: 'epub', at: 2 })
  list = pushRecent(list, { filename: 'a.pdf', title: 'A', format: 'pdf', at: 3 })
  assert.deepEqual(
    list.map((r) => r.filename),
    ['a.pdf', 'b.epub']
  )
  assert.equal(
    pushRecent(list, { filename: 'c.pdf', title: 'C', format: 'pdf', at: 4 }, 2).length,
    2
  )
})
