import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  DEFAULT_SELECTION,
  bytesOf,
  categoryResources,
  contentPlan,
  languageGroup,
  mapCodes,
  mapLabel,
  mapSlug,
  DEFAULT_SURVIVAL_LIBRARY,
  parseDraft,
  profileSummary,
  selectedResources,
  survivalLibraryIds,
  survivalLibraryPlan,
} from '../../inertia/lib/setup_plan.js'
import type { SpecCategory } from '../../types/collections.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const MANIFEST = JSON.parse(
  readFileSync(path.join(ROOT, 'collections/kiwix-categories.json'), 'utf8')
) as { categories: SpecCategory[] }

const res = (id: string, language: string, size_mb: number) => ({
  id,
  version: '1',
  title: id,
  description: '',
  url: `https://example.org/${id}.zim`,
  size_mb,
  language,
})

const CAT: SpecCategory = {
  name: 'Teste',
  slug: 'teste',
  icon: 'IconBook',
  description: '',
  language: 'mul',
  tiers: [
    {
      name: 'Essencial',
      slug: 'e',
      description: '',
      resources: [res('pt1', 'pt', 100), res('en1', 'en', 50)],
    },
    {
      name: 'Padrão',
      slug: 's',
      description: '',
      includesTier: 'e',
      resources: [res('pt2', 'pt', 200), res('mul1', 'mul', 10)],
    },
    {
      name: 'Completo',
      slug: 'c',
      description: '',
      includesTier: 's',
      resources: [res('en2', 'en', 1000)],
    },
  ],
}

const ids = (list: { id: string }[]) => list.map((r) => r.id)

test('Portuguese and multilingual count as Portuguese; English and others are opt-in', () => {
  assert.equal(languageGroup('pt'), 'pt')
  assert.equal(languageGroup('pt-BR'), 'pt')
  assert.equal(languageGroup('mul'), 'pt')
  assert.equal(languageGroup('en'), 'en')
  assert.equal(languageGroup('es'), 'other')
})

test('profiles are cumulative and Portuguese-only by default', () => {
  const pick = (profile: 'essential' | 'standard' | 'complete') =>
    ids(selectedResources(CAT, { ...DEFAULT_SELECTION, profile }))
  assert.deepEqual(pick('essential'), ['pt1'])
  assert.deepEqual(pick('standard'), ['pt1', 'pt2', 'mul1'])
  assert.deepEqual(pick('complete'), ['pt1', 'pt2', 'mul1'])
})

test('English can be enabled for the whole category or one resource at a time', () => {
  const all = selectedResources(CAT, { ...DEFAULT_SELECTION, profile: 'complete', english: true })
  assert.deepEqual(ids(all), ['pt1', 'en1', 'pt2', 'mul1', 'en2'])
  const one = selectedResources(CAT, { ...DEFAULT_SELECTION, profile: 'complete', extra: ['en2'] })
  assert.deepEqual(ids(one), ['pt1', 'pt2', 'mul1', 'en2'])
})

test('custom selection takes any resource of the category, whatever its tier', () => {
  const sel = {
    ...DEFAULT_SELECTION,
    profile: 'custom' as const,
    custom: ['en2', 'pt1', 'missing'],
  }
  assert.deepEqual(ids(selectedResources(CAT, sel)), ['pt1', 'en2'])
  assert.deepEqual(
    categoryResources(CAT).map((x) => `${x.resource.id}:${x.profile}`),
    ['pt1:essential', 'en1:essential', 'pt2:standard', 'mul1:standard', 'en2:complete']
  )
})

test('profile summary reports sizes from the manifest and what Portuguese-only leaves out', () => {
  const pt = profileSummary(CAT, 'complete', false)
  assert.equal(pt.count, 3)
  assert.equal(pt.bytes, bytesOf({ size_mb: 310 }))
  assert.equal(pt.foreignCount, 2)
  assert.equal(pt.foreignBytes, bytesOf({ size_mb: 1050 }))
  const all = profileSummary(CAT, 'complete', true)
  assert.equal(all.count, 5)
  assert.deepEqual(all.languages, ['en', 'mul', 'pt'])
})

test('the plan skips installed and downloading resources and never queues one twice', () => {
  const other: SpecCategory = { ...CAT, slug: 'outra', tiers: [{ ...CAT.tiers[0], slug: 'e2' }] }
  const plan = contentPlan(
    [CAT, other],
    {
      teste: { ...DEFAULT_SELECTION, profile: 'standard' },
      outra: { ...DEFAULT_SELECTION, profile: 'essential' },
    },
    new Set(['pt2']),
    new Set(['mul1'])
  )
  assert.deepEqual(
    plan.byCategory.map((c) => [c.slug, c.tierSlug, c.resourceIds]),
    [['teste', 's', ['pt1']]]
  )
  assert.equal(plan.skipped, 2)
  assert.equal(plan.bytes, bytesOf({ size_mb: 100 }))
})

test('real manifest: every category has the three profiles, sizes and declared languages', () => {
  assert.ok(MANIFEST.categories.length > 0)
  for (const category of MANIFEST.categories) {
    assert.ok(category.tiers.length >= 3, `${category.slug} has Essencial, Padrão and Completo`)
    const essential = profileSummary(category, 'essential', false)
    const complete = profileSummary(category, 'complete', true)
    assert.ok(complete.bytes >= essential.bytes, `${category.slug}: Completo is the largest`)
    for (const r of categoryResources(category)) {
      assert.ok(r.resource.size_mb > 0, `${r.resource.id} has a size`)
      assert.ok(r.resource.language, `${r.resource.id} declares its language`)
    }
  }
})

test('drafts round-trip and broken drafts are refused', () => {
  const draft = {
    version: 1,
    step: 3,
    services: ['nomad_kiwix_server'],
    maps: { scope: 'states', regions: [], states: ['BR-SP'], maxzoom: 12, collections: [] },
    categories: { medicine: { profile: 'standard', english: false, extra: [], custom: [] } },
    wikipedia: null,
    creatorPacks: [],
    aiModels: [],
    ingestPolicy: 'Manual',
    timezone: 'America/Manaus',
    state: 'BR-AM',
    survivalLibrary: 'standard',
    environment: 'urbano',
    place: 'Manaus',
  }
  assert.deepEqual(parseDraft(JSON.stringify(draft)), draft)
  assert.equal(parseDraft('{oops'), null)
  assert.equal(parseDraft({ ...draft, version: 2 }), null)
  assert.equal(parseDraft({ ...draft, maps: { ...draft.maps, scope: 'planet' } }), null)
  assert.equal(parseDraft({ ...draft, step: 9 })?.step, 1)
})

test('maps: Brazil, IBGE regions and states become extract codes, labels and file prefixes', () => {
  const base = { regions: [], states: [], maxzoom: 15, collections: [] }
  assert.deepEqual(mapCodes({ ...base, scope: 'country' }), ['BR'])
  assert.equal(mapSlug({ ...base, scope: 'country' }), 'br')
  const sul = { ...base, scope: 'regions' as const, regions: ['sul'] }
  assert.deepEqual(mapCodes(sul), ['BR-PR', 'BR-RS', 'BR-SC'])
  assert.equal(mapLabel(sul), 'Região Sul')
  assert.equal(mapSlug(sul), 'br-sul')
  const two = { ...base, scope: 'states' as const, states: ['BR-SP', 'BR-AM', 'BR-SP', 'XX'] }
  assert.deepEqual(mapCodes(two), ['BR-AM', 'BR-SP'])
  assert.equal(mapLabel(two), 'São Paulo, Amazonas')
  assert.equal(mapSlug(two), null)
  assert.equal(mapSlug({ ...base, scope: 'states', states: ['BR-AM'] }), 'br-am')
  assert.deepEqual(mapCodes({ ...base, scope: 'none' }), [])
  // every macro-region is covered and every state has a Brazilian time zone
  assert.equal(
    mapCodes({
      ...base,
      scope: 'regions',
      regions: ['norte', 'nordeste', 'centro-oeste', 'sudeste', 'sul'],
    }).length,
    27
  )
})

// ---- Survival library levels (collections/library.json, area "sobrevivencia") ----

test('survival library levels are cumulative and every id exists in the library manifest', async () => {
  const library = JSON.parse(
    readFileSync(new URL('../../../collections/library.json', import.meta.url), 'utf8')
  )
  const libraryIds = new Set(library.items.map((i: { id: string }) => i.id))
  const essential = survivalLibraryIds('essential')
  const standard = survivalLibraryIds('standard')
  const complete = survivalLibraryIds('complete')
  assert.deepEqual(survivalLibraryIds('none'), [])
  assert.ok(essential.every((id) => standard.includes(id)))
  assert.ok(standard.every((id) => complete.includes(id)))
  for (const id of complete) assert.ok(libraryIds.has(id), `${id} missing from library.json`)
  // every survival-area work of the manifest is reachable from some level
  const area = library.items.filter((i: { areas: string[] }) => i.areas.includes('sobrevivencia'))
  for (const item of area) assert.ok(complete.includes(item.id), `${item.id} not in any level`)
})

test('survivalLibraryPlan skips installed and downloading PDFs and sums the rest', async () => {
  const items = [
    {
      id: 'ms-agua-tratada-em-casa',
      title: 'Água',
      files: [{ format: 'pdf', status: 'installed', size_bytes: 10 }],
    },
    {
      id: 'mma-caderno-secas',
      title: 'Secas',
      files: [{ format: 'pdf', status: 'available', size_bytes: 100 }],
    },
    {
      id: 'mma-caderno-incendios',
      title: 'Incêndios',
      files: [{ format: 'pdf', status: 'downloading', size_bytes: 5 }],
    },
    {
      id: 'ms-guia-vigilancia-saude-vol-1',
      title: 'GVS',
      files: [{ format: 'pdf', status: 'available', size_bytes: 1000 }],
    },
  ]
  const essential = survivalLibraryPlan(items, 'essential')
  assert.deepEqual(
    essential.queue.map((q) => q.id),
    ['mma-caderno-secas']
  )
  assert.equal(essential.skipped, 2)
  assert.equal(essential.bytes, 100)
  assert.equal(survivalLibraryPlan(items, 'complete').bytes, 1100)
  assert.equal(survivalLibraryPlan(items, 'none').queue.length, 0)
})

test('parseDraft fills the survival fields of drafts saved before they existed', async () => {
  const old = {
    version: 1,
    step: 3,
    services: [],
    creatorPacks: [],
    aiModels: [],
    maps: { scope: 'country', regions: [], states: [], maxzoom: 13, collections: [] },
    categories: {},
    wikipedia: null,
    ingestPolicy: 'Manual',
    timezone: 'America/Manaus',
    state: 'BR-AM',
  }
  const d = parseDraft(JSON.stringify(old))!
  assert.equal(d.survivalLibrary, DEFAULT_SURVIVAL_LIBRARY)
  assert.equal(d.environment, null)
  assert.equal(d.place, null)
  const d2 = parseDraft({
    ...old,
    survivalLibrary: 'essential',
    environment: 'rural',
    place: 'Parintins',
  })!
  assert.equal(d2.survivalLibrary, 'essential')
  assert.equal(d2.environment, 'rural')
  assert.equal(d2.place, 'Parintins')
  assert.equal(
    parseDraft({ ...old, survivalLibrary: 'bogus', environment: 'x' })!.survivalLibrary,
    DEFAULT_SURVIVAL_LIBRARY
  )
})
