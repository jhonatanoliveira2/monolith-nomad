/**
 * Translation catalogs (inertia/locales/<locale>/*.json) are merged into one flat catalog per locale
 * (inertia/lib/i18n.ts). These checks keep them safe to merge and to interpolate.
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const LOCALES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../inertia/locales'
)

function catalogs(): { locale: string; file: string; entries: Record<string, unknown> }[] {
  const out = []
  for (const locale of readdirSync(LOCALES_DIR, { withFileTypes: true })) {
    if (!locale.isDirectory()) continue
    for (const file of readdirSync(path.join(LOCALES_DIR, locale.name))) {
      if (!file.endsWith('.json')) continue
      const raw = readFileSync(path.join(LOCALES_DIR, locale.name, file), 'utf8')
      out.push({ locale: locale.name, file, entries: JSON.parse(raw) as Record<string, unknown> })
    }
  }
  return out
}

const placeholders = (s: string) =>
  [...s.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort()
const tags = (s: string) => [...s.matchAll(/<\/?(\d+|[a-z]+)\s*\/?>/g)].map((m) => m[0]).sort()

test('there is a pt-BR catalog and every catalog is a flat map of non-empty strings', () => {
  const all = catalogs()
  assert.ok(
    all.some((c) => c.locale === 'pt-BR'),
    'pt-BR catalogs exist'
  )
  for (const { locale, file, entries } of all) {
    for (const [key, value] of Object.entries(entries)) {
      assert.equal(typeof value, 'string', `${locale}/${file}: "${key}" must map to a string`)
      assert.ok(
        (value as string).trim().length > 0,
        `${locale}/${file}: "${key}" has an empty translation`
      )
    }
  }
})

test('every translation keeps the {{placeholders}} and <tags> of its English key', () => {
  const problems: string[] = []
  for (const { locale, file, entries } of catalogs()) {
    for (const [key, value] of Object.entries(entries)) {
      if (placeholders(key).join() !== placeholders(value as string).join()) {
        problems.push(`${locale}/${file}: placeholders differ in "${key}"`)
      }
      if (tags(key).join() !== tags(value as string).join()) {
        problems.push(`${locale}/${file}: <tags> differ in "${key}"`)
      }
    }
  }
  assert.deepEqual(problems, [])
})

test('a key shared by several files of a locale has the same translation everywhere (files are merged)', () => {
  const seen = new Map<string, { file: string; value: string }>()
  const conflicts: string[] = []
  for (const { locale, file, entries } of catalogs()) {
    for (const [key, value] of Object.entries(entries)) {
      const id = `${locale}\u0000${key}`
      const prev = seen.get(id)
      if (prev && prev.value !== value) {
        conflicts.push(
          `${locale}: "${key}" is "${prev.value}" in ${prev.file} but "${value}" in ${file}`
        )
      } else if (!prev) {
        seen.set(id, { file, value: value as string })
      }
    }
  }
  assert.deepEqual(conflicts, [])
})
