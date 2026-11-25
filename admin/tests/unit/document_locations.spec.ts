/**
 * Where a passage is inside its document (page range, chapter), from indexing to the citation shown
 * under an answer, plus which embedding model an index uses.
 *
 * Pure functions only — no MySQL, Redis, Qdrant, or Ollama needed:
 *   npm run test:unit
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  epubChapterSegments,
  formatPageRange,
  locationLabel,
  pdfPageWindows,
} from '../../app/utils/document_segments.js'
import { buildCitations, buildContextBlock } from '../../app/utils/rag_prompt.js'
import { parseDocumentFilename, documentFilename } from '../../app/utils/library.js'
import {
  DEFAULT_EMBEDDING_PROFILE,
  EMBEDDING_PROFILES,
  LEGACY_EMBEDDING_PROFILE,
  isKnownEmbeddingModel,
  resolveEmbeddingProfile,
} from '../../app/utils/embedding_profile.js'

const page = (num: number, size: number) => ({ num, text: 'x'.repeat(size) })

test('pdfPageWindows merges short pages up to the budget and keeps the range', () => {
  const windows = pdfPageWindows([page(1, 400), page(2, 400), page(3, 400), page(4, 400)], 1000)
  assert.deepEqual(
    windows.map((w) => w.meta),
    [
      { page_start: 1, page_end: 2 },
      { page_start: 3, page_end: 4 },
    ]
  )
})

test('pdfPageWindows keeps a page larger than the budget alone', () => {
  const windows = pdfPageWindows([page(1, 100), page(2, 5000), page(3, 100)], 1000)
  assert.deepEqual(
    windows.map((w) => w.meta),
    [
      { page_start: 1, page_end: 1 },
      { page_start: 2, page_end: 2 },
      { page_start: 3, page_end: 3 },
    ]
  )
})

test('pdfPageWindows skips blank pages without shifting the numbering', () => {
  const windows = pdfPageWindows(
    [
      { num: 3, text: 'c' },
      { num: 1, text: 'a' },
      { num: 2, text: '   ' },
    ],
    1000
  )
  assert.equal(windows.length, 1)
  assert.deepEqual(windows[0].meta, { page_start: 1, page_end: 3 })
  assert.equal(windows[0].text, 'a\n\nc')
})

test('epubChapterSegments labels chapters and drops empty ones', () => {
  const segments = epubChapterSegments([
    { href: 'ch1.xhtml', title: 'Água', text: 'ferver por 1 minuto' },
    { href: 'cover.xhtml', title: null, text: '  ' },
    { href: 'ch2.xhtml', title: null, text: 'sem título' },
  ])
  assert.deepEqual(
    segments.map((s) => s.meta),
    [{ chapter_href: 'ch1.xhtml', chapter: 'Água' }, { chapter_href: 'ch2.xhtml' }]
  )
})

test('formatPageRange and locationLabel', () => {
  assert.equal(formatPageRange(12, 12), 'p. 12')
  assert.equal(formatPageRange(12, 13), 'p. 12–13')
  assert.equal(formatPageRange(undefined, 3), null)
  assert.equal(locationLabel({ chapter: 'Capítulo 2' }), 'Capítulo 2')
  assert.equal(locationLabel({ page_start: 5, page_end: 6, chapter: 'x' }), 'p. 5–6')
  assert.equal(locationLabel(undefined), null)
})

test('buildContextBlock puts the page range in the label', () => {
  const block = buildContextBlock([
    {
      text: 'duas gotas por litro',
      metadata: {
        archive_title: 'Água tratada em casa',
        archive_date: '2026',
        page_start: 9,
        page_end: 9,
      },
    },
    { text: 'sem título', metadata: { page_start: 2, page_end: 3 } },
  ])
  assert.match(block, /\[Context 1 — Água tratada em casa \(2026\), p\. 9\]/)
  assert.match(block, /\[Context 2 — p\. 2–3\]/)
})

test('buildCitations keeps every distinct page of one document', () => {
  const sources = buildCitations([
    {
      text: 'a',
      metadata: { source: '/lib/guia.pdf', archive_title: 'Guia', page_start: 12, page_end: 12 },
    },
    {
      text: 'b',
      metadata: { source: '/lib/guia.pdf', archive_title: 'Guia', page_start: 40, page_end: 41 },
    },
    {
      text: 'c',
      metadata: { source: '/lib/guia.pdf', archive_title: 'Guia', page_start: 12, page_end: 12 },
    },
  ])
  assert.equal(sources.length, 1)
  assert.deepEqual(sources[0].locations, [
    { label: 'p. 12', page: 12 },
    { label: 'p. 40–41', page: 40 },
  ])
})

test('buildCitations without locations keeps the old shape', () => {
  const [source] = buildCitations([
    { text: 'a', metadata: { source: '/zim/wiki.zim', archive_title: 'Wiki' } },
  ])
  assert.equal(source.locations, undefined)
})

test('parseDocumentFilename inverts documentFilename', () => {
  const name = documentFilename({ id: 'ms-guia-vigilancia-saude-vol-1', version: '2024' }, 'pdf')
  assert.equal(name, 'ms-guia-vigilancia-saude-vol-1-pdf_2024.pdf')
  assert.deepEqual(parseDocumentFilename(name), {
    itemId: 'ms-guia-vigilancia-saude-vol-1',
    format: 'pdf',
    version: '2024',
  })
  assert.equal(parseDocumentFilename('upload.pdf'), null)
  assert.equal(parseDocumentFilename('x-pdf_1.epub'), null)
})

test('resolveEmbeddingProfile: recorded profile wins', () => {
  assert.deepEqual(resolveEmbeddingProfile('nomic-v1.5', false), {
    profile: EMBEDDING_PROFILES['nomic-v1.5'],
    persist: false,
  })
})

test('resolveEmbeddingProfile: an unrecorded index with points is the legacy nomic index', () => {
  const r = resolveEmbeddingProfile(null, true)
  assert.equal(r.profile.id, LEGACY_EMBEDDING_PROFILE)
  assert.equal(r.persist, true)
})

test('resolveEmbeddingProfile: a fresh index uses the multilingual default', () => {
  const r = resolveEmbeddingProfile(undefined, false)
  assert.equal(r.profile.id, DEFAULT_EMBEDDING_PROFILE)
  assert.equal(r.profile.multilingual, true)
  assert.equal(r.persist, true)
  // Unknown values are treated as unrecorded, never trusted
  assert.equal(resolveEmbeddingProfile('bogus', false).profile.id, DEFAULT_EMBEDDING_PROFILE)
})

test('every profile keeps the collection dimension', () => {
  for (const p of Object.values(EMBEDDING_PROFILES)) assert.equal(p.dimension, 768)
})

test('isKnownEmbeddingModel recognises both families', () => {
  assert.equal(isKnownEmbeddingModel('embeddinggemma:latest'), true)
  assert.equal(isKnownEmbeddingModel('nomic-embed-text:v1.5'), true)
  assert.equal(isKnownEmbeddingModel('qwen3.5:9b'), false)
})
