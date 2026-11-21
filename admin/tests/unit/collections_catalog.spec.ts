/**
 * Regression checks for the shipped content manifests (collections/*.json), the Brazilian catalog in
 * particular: Portuguese packages first, English kept only where no adequate Portuguese package exists,
 * every package's language declared and consistent with its file.
 *
 * Offline by design. The availability of every file on the Kiwix servers is checked by
 * `scripts/check-catalog-availability.mjs` (network), not here.
 */
import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vine from '@vinejs/vine'

import {
  wikipediaSpecSchema,
  zimCategoriesSpecSchema,
} from '../../app/validators/curated_collections.js'
import type {
  SpecResource,
  SpecTier,
  ZimCategoriesSpec,
  WikipediaSpec,
} from '../../types/collections.js'
import { isWikipediaSelectorFile, isWikipediaZimUrl } from '../../app/utils/zim_filename.js'
import { contentLanguageInfo } from '../../inertia/lib/content_language.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const load = <T>(name: string): T =>
  JSON.parse(readFileSync(path.join(ROOT, 'collections', name), 'utf8')) as T

const categories = load<ZimCategoriesSpec>('kiwix-categories.json')
const wikipedia = load<WikipediaSpec>('wikipedia.json')

/** Same rule as CollectionManifestService.parseZimFilename (kept local: that module boots the app). */
function parseZimFilename(filename: string): { resource_id: string; version: string } | null {
  const match = filename.replace(/\.zim$/, '').match(/^(.+)_(\d{4}-\d{2})$/)
  return match ? { resource_id: match[1], version: match[2] } : null
}

function resolveTier(tier: SpecTier, all: SpecTier[], seen = new Set<string>()): SpecResource[] {
  if (seen.has(tier.slug)) throw new Error(`includesTier cycle at ${tier.slug}`)
  seen.add(tier.slug)
  const parent = tier.includesTier ? all.find((t) => t.slug === tier.includesTier) : undefined
  if (tier.includesTier)
    assert.ok(parent, `${tier.slug}: includesTier ${tier.includesTier} does not exist`)
  return [...(parent ? resolveTier(parent, all, seen) : []), ...tier.resources]
}

const allResources = categories.categories.flatMap((c) => c.tiers.flatMap((t) => t.resources))

/** Language implied by a Kiwix-style id: `_pt_`, `_mul_`, `_en_` (or a trailing `_en`). */
function idLanguage(id: string): string | null {
  if (/_pt(_|$)/.test(id)) return 'pt'
  if (/_mul(_|$)/.test(id)) return 'mul'
  if (/_en(_|$)/.test(id)) return 'en'
  return null
}

test('both manifests pass the validators the app runs on fetch, keeping the language field', async () => {
  const cats = await vine.validate({
    schema: zimCategoriesSpecSchema,
    data: structuredClone(categories),
  })
  const langs = cats.categories.flatMap((c) =>
    c.tiers.flatMap((t) => t.resources.map((r) => r.language))
  )
  assert.ok(langs.every(Boolean), 'the validator must not strip `language`')
  const wiki = await vine.validate({
    schema: wikipediaSpecSchema,
    data: structuredClone(wikipedia),
  })
  assert.ok(wiki.options.filter((o) => o.url).every((o) => o.language))
})

test('every resource declares a language that matches its id and is one the UI knows', () => {
  for (const r of allResources) {
    assert.ok(r.language, `${r.id}: missing language`)
    const implied = r.type === 'dataset' ? 'en' : idLanguage(r.id)
    assert.equal(r.language, implied, `${r.id}: language ${r.language} contradicts the id`)
    assert.ok(
      contentLanguageInfo(r.language)?.kind !== 'other',
      `${r.id}: badge would show a raw code`
    )
  }
})

test('ZIM ids and versions are exactly what the filename parser derives from the URL', () => {
  // A mismatch makes the installed file reconcile to a different resource_id, so the tier would never
  // show as installed and updates would not be detected.
  for (const r of allResources.filter((x) => (x.type ?? 'zim') === 'zim')) {
    const file = r.url.split('/').pop()!
    assert.deepEqual(parseZimFilename(file), { resource_id: r.id, version: r.version }, r.id)
    assert.ok(r.url.startsWith('https://'), `${r.id}: not https`)
    assert.ok((r.size_mb ?? 0) > 0, `${r.id}: unknown size`)
  }
})

test('every tier resolves without cycles or duplicate files', () => {
  for (const c of categories.categories) {
    assert.equal(
      c.tiers.filter((t) => t.recommended).length,
      1,
      `${c.slug}: exactly one recommended tier`
    )
    for (const t of c.tiers) {
      const ids = resolveTier(t, c.tiers).map((r) => r.id)
      assert.equal(new Set(ids).size, ids.length, `${t.slug}: the same file twice`)
    }
  }
  const slugs = categories.categories.map((c) => c.slug)
  assert.equal(new Set(slugs).size, slugs.length, 'category slugs are unique')
})

test('a resource listed in several categories is the same file everywhere', () => {
  const byId = new Map<string, SpecResource>()
  for (const r of allResources) {
    const prev = byId.get(r.id)
    if (prev) assert.equal(prev.url, r.url, `${r.id}: two different files under one id`)
    byId.set(r.id, r)
  }
})

test('Portuguese comes first: the recommended tier of each category that has Portuguese content includes it', () => {
  for (const c of categories.categories) {
    if (!c.tiers.some((t) => t.resources.some((r) => r.language === 'pt'))) continue
    // DIY is the one exception: its only Portuguese package is the 3.4 GB iFixit, too big for an entry tier
    if (c.slug === 'diy') continue
    const rec = c.tiers.find((t) => t.recommended)!
    assert.ok(
      resolveTier(rec, c.tiers).some((r) => r.language === 'pt'),
      `${c.slug}: recommended tier has no Portuguese package`
    )
  }
})

test('English packages replaced by an equivalent Portuguese one are gone, the complemented ones stay', () => {
  const ids = new Set(allResources.map((r) => r.id))
  // replaced: same project, equivalent coverage (iFixit 105k vs 103k articles; freeCodeCamp 996 vs 996)
  for (const gone of ['ifixit_en_all', 'freecodecamp_en_all']) assert.ok(!ids.has(gone), gone)
  for (const pt of ['ifixit_pt_all', 'freecodecamp_pt_all']) assert.ok(ids.has(pt), pt)
  // complemented, not replaced: the Portuguese edition is much smaller, so the English one is kept
  for (const kept of [
    'wikipedia_en_medicine_maxi',
    'wikibooks_en_all_nopic',
    'wikibooks_en_all_maxi',
    'wikiversity_en_all_maxi',
    'libretexts.org_en_math',
  ]) {
    assert.ok(ids.has(kept), `${kept} must stay as the English complement`)
  }
})

test('the Wikipedia selector offers Portuguese first and keeps every English option under its old id', () => {
  const opts = wikipedia.options
  assert.equal(opts[0].id, 'none')
  assert.equal(opts.find((o) => o.url)!.language, 'pt')
  // Existing installs store the option id: the English ids must keep pointing at English files.
  for (const id of ['top-mini', 'top-nopic', 'all-mini', 'all-nopic', 'all-maxi']) {
    const o = opts.find((x) => x.id === id)
    assert.ok(o, `${id} missing`)
    assert.equal(o!.language, 'en')
    assert.match(o!.url!, /\/wikipedia_en_/)
  }
  const ids = opts.map((o) => o.id)
  assert.equal(new Set(ids).size, ids.length, 'unique option ids')
  const urls = opts.filter((o) => o.url).map((o) => o.url!)
  assert.equal(new Set(urls).size, urls.length, 'unique option files')
  for (const o of opts.filter((x) => x.url)) {
    assert.ok(isWikipediaZimUrl(o.url!), `${o.id}: not recognised as a Wikipedia ZIM`)
    assert.equal(parseZimFilename(o.url!.split('/').pop()!)?.version, o.version, `${o.id}: version`)
  }
})

test('themed Portuguese Wikipedias in the tiers are never mistaken for the selector Wikipedia', () => {
  // If they were, finishing their download would take over the selection, and choosing another
  // Wikipedia would delete them (see isWikipediaSelectorFile).
  const optionUrls = wikipedia.options.map((o) => o.url)
  for (const r of allResources.filter((x) => x.id.startsWith('wikipedia_'))) {
    assert.equal(isWikipediaSelectorFile(r.url.split('/').pop()!, optionUrls), false, r.id)
  }
})

test('content language badges', () => {
  assert.equal(contentLanguageInfo('pt')?.short, 'PT')
  assert.equal(contentLanguageInfo('en')?.short, 'EN')
  assert.equal(contentLanguageInfo('mul')?.short, 'MULTI')
  assert.equal(contentLanguageInfo(undefined), null)
  assert.equal(contentLanguageInfo(''), null)
})
