/**
 * Regression checks for the library catalog (collections/library.json) and its pure rules
 * (app/utils/library.ts). Offline: availability of every file upstream is checked by
 * scripts/check-catalog-availability.mjs.
 */
import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vine from '@vinejs/vine'

import { librarySpecSchema } from '../../app/validators/library.js'
import {
  documentFilename,
  documentResourceId,
  isValidLibraryFile,
  resolveLibraryFile,
  formatOfFilename,
} from '../../app/utils/library.js'
import type { LibrarySpec, LibraryDocumentFile, LibraryZimFile } from '../../types/library.js'
import type { ZimCategoriesSpec } from '../../types/collections.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const library = JSON.parse(
  readFileSync(path.join(ROOT, 'collections/library.json'), 'utf8')
) as LibrarySpec
const categories = JSON.parse(
  readFileSync(path.join(ROOT, 'collections/kiwix-categories.json'), 'utf8')
) as ZimCategoriesSpec
const zimIds = new Set(
  categories.categories.flatMap((c) => c.tiers.flatMap((t) => t.resources.map((r) => r.id)))
)
const docs = library.items.flatMap((i) =>
  i.files
    .filter((f) => f.format !== 'zim')
    .map((f) => ({ item: i, file: f as LibraryDocumentFile }))
)

test('library.json passes the validator the app runs on fetch, keeping sha256 and zim_id', async () => {
  const v = await vine.validate({ schema: librarySpecSchema, data: structuredClone(library) })
  const files = v.items.flatMap((i) => i.files)
  assert.equal(
    files.filter((f) => f.format !== 'zim').every((f) => 'sha256' in f),
    true,
    'sha256 survives'
  )
  assert.equal(
    files.filter((f) => f.format === 'zim').every((f) => f.zim_id),
    true,
    'zim_id survives'
  )
})

test('every file entry is usable: documents have https URL, size and hash field; ZIMs exist in the categories', () => {
  for (const item of library.items) {
    for (const file of item.files) {
      assert.ok(isValidLibraryFile(file), `${item.id}/${file.format}`)
      if (file.format === 'zim') {
        assert.ok(
          zimIds.has((file as LibraryZimFile).zim_id),
          `${item.id}: unknown ZIM ${(file as LibraryZimFile).zim_id}`
        )
      }
    }
    const formats = item.files.map((f) => f.format)
    assert.equal(new Set(formats).size, formats.length, `${item.id}: one file per format`)
  }
})

test('documents pin a SHA-256 unless the publisher rebuilds them continuously (and then say so)', () => {
  for (const { item, file } of docs) {
    if (file.sha256 === null) {
      assert.match(
        item.notes ?? '',
        /contínua|continuamente/i,
        `${item.id}: unpinned hash must be explained`
      )
    }
  }
  assert.ok(
    docs.filter((d) => d.file.sha256).length >= docs.length - 1,
    'only the Python docs are unpinned'
  )
})

test('ids, areas, levels and licenses are consistent', () => {
  const ids = library.items.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length, 'unique item ids')
  const areaSlugs = new Set(library.areas.map((a) => a.slug))
  for (const item of library.items) {
    for (const a of item.areas) assert.ok(areaSlugs.has(a), `${item.id}: unknown area ${a}`)
    assert.ok(item.levels.length > 0 && item.subjects.length > 0, `${item.id}: levels/subjects`)
    assert.ok(item.license.id && item.license.url.startsWith('https://'), `${item.id}: license`)
    assert.ok(item.source_url.startsWith('https://'), `${item.id}: official source`)
  }
  for (const a of library.areas) {
    assert.ok(
      library.items.some((i) => i.areas.includes(a.slug)),
      `area ${a.slug} has no work`
    )
  }
})

test('document file names are what the file route accepts and what isSafeOldContentPath expects', () => {
  for (const { item, file } of docs) {
    const name = documentFilename(item, file.format)
    assert.ok(name.startsWith(`${documentResourceId(item, file.format)}_`), name)
    assert.ok(resolveLibraryFile('/app/storage/library', name), `${name} must be servable`)
    assert.equal(formatOfFilename(name), file.format)
  }
})

test('the file route cannot be used to read anything outside storage/library', () => {
  const root = '/app/storage/library'
  for (const evil of [
    '../.env',
    '..%2F.env',
    '/etc/passwd',
    'pro-git-pdf_2026-08.pdf/../../zim/x.zim',
    'pro-git-pdf_2026-08.pdf\0.txt',
    'kiwix-library.xml',
    'PRO-GIT-PDF_2026-08.PDF',
    '',
  ]) {
    assert.equal(resolveLibraryFile(root, evil), null, JSON.stringify(evil))
  }
  assert.equal(
    resolveLibraryFile(root, 'pro-git-pdf_2026-08.pdf'),
    '/app/storage/library/pro-git-pdf_2026-08.pdf'
  )
})
