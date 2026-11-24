import { test } from '@japa/runner'
import KVStore from '#models/kv_store'

/**
 * HTTP surface the setup wizard (Configuração Rápida) depends on: the Brazilian states offered as map
 * regions, the subset download of a category (Portuguese-first profiles), and the validation of the
 * regional preferences and of the saved draft.
 */
const BASE = `http://${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? '3333'}`

/** PATCH a setting and return the HTTP status. */
async function patchSetting(key: string, value: unknown): Promise<number> {
  const res = await fetch(`${BASE}/api/system/settings`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
  return res.status
}

test.group('Setup wizard', (group) => {
  const bootTz = process.env.TZ

  group.each.setup(() => async () => {
    await KVStore.query()
      .whereIn('key', ['regional.timezone', 'regional.state', 'ui.easySetupDraft'])
      .delete()
    if (bootTz) process.env.TZ = bootTz
    else delete process.env.TZ
  })

  test('lists the 27 Brazilian states with ISO 3166-2 codes', async ({ assert }) => {
    const res = await fetch(`${BASE}/api/maps/countries/BR/subdivisions`)
    assert.equal(res.status, 200)
    const { subdivisions } = (await res.json()) as {
      subdivisions: { code: string; name: string }[]
    }
    assert.lengthOf(subdivisions, 27)
    assert.isTrue(subdivisions.every((s) => /^BR-[A-Z]{2}$/.test(s.code)))
    assert.include(
      subdivisions.map((s) => s.code),
      'BR-SP'
    )
  })

  test('rejects a malformed country code for subdivisions', async ({ assert }) => {
    const res = await fetch(`${BASE}/api/maps/countries/BRA1/subdivisions`)
    assert.equal(res.status, 422)
  })

  test('a subset download refuses resource ids from outside the category', async ({ assert }) => {
    const listing = await fetch(`${BASE}/api/zim/curated-categories`)
    const categories = (await listing.json()) as any[]
    assert.isAbove(categories.length, 0)
    const cat = categories[0]
    const res = await fetch(`${BASE}/api/zim/download-category-tier`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify({
        categorySlug: cat.slug,
        tierSlug: cat.tiers[0].slug,
        resourceIds: ['not-a-real-resource'],
      }),
    })
    assert.isAtLeast(res.status, 400)
  })

  test('validates and applies the regional time zone', async ({ assert }) => {
    assert.equal(await patchSetting('regional.timezone', 'Mars/Olympus_Mons'), 422)
    assert.equal(await patchSetting('regional.state', 'BR-XX'), 422)

    assert.equal(await patchSetting('regional.timezone', 'America/Manaus'), 200)
    assert.equal(await patchSetting('regional.state', 'BR-AM'), 200)
    assert.equal(await KVStore.getValue('regional.timezone'), 'America/Manaus')
    assert.equal(process.env.TZ, 'America/Manaus')
  })

  test('stores the wizard draft only as JSON', async ({ assert }) => {
    assert.equal(await patchSetting('ui.easySetupDraft', '{not json'), 422)
    const draft = JSON.stringify({ version: 1, step: 2 })
    assert.equal(await patchSetting('ui.easySetupDraft', draft), 200)
    assert.equal(await KVStore.getValue('ui.easySetupDraft'), draft)
  })
})
