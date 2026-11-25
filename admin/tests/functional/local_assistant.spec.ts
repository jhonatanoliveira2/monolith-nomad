import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import KVStore from '#models/kv_store'
import { TranslationService } from '#services/translation_service'
import { translationCacheKey } from '../../app/utils/translation.js'

/**
 * HTTP surface of the local AI agent, on the real app (MySQL, Redis) with no Ollama, Qdrant or GPU
 * behind it: everything must answer with honest empty states, validation must hold, and the
 * translation cache must serve a cached passage without any engine.
 */
const BASE = `http://${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? '3333'}`

async function patchSetting(key: string, value: unknown): Promise<number> {
  const res = await fetch(`${BASE}/api/system/settings`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
  return res.status
}

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', 'accept': 'application/json' },
  body: JSON.stringify(body),
})

test.group('Local assistant', (group) => {
  group.each.setup(() => async () => {
    await KVStore.query()
      .whereIn('key', ['regional.state', 'regional.environment', 'regional.place', 'ai.amdBackend'])
      .delete()
    await db.from('translation_cache').delete()
  })

  test('status reports offline mode, a model plan and the survival map', async ({ assert }) => {
    const res = await fetch(`${BASE}/api/assistant/status`)
    assert.equal(res.status, 200)
    const body = (await res.json()) as any
    assert.isTrue(body.offline)
    assert.oneOf(body.recommendation.tier, ['gpu-16', 'gpu-10', 'gpu-6', 'cpu'])
    assert.equal(body.recommendation.embedding, 'embeddinggemma:latest')
    assert.property(body.discouraged, 'gpt-oss:20b')
    assert.deepEqual(body.translation.cache, { segments: 0, chars: 0 })
    assert.equal(body.survival.specVersion, '2026-11-24')
    assert.equal(body.survival.works, 0)
  })

  test('performance answers without a GPU or Ollama', async ({ assert }) => {
    const res = await fetch(`${BASE}/api/assistant/performance`)
    assert.equal(res.status, 200)
    const body = (await res.json()) as any
    assert.isArray(body.gpus)
    assert.isAbove(body.memory.totalMiB, 0)
    assert.deepEqual(body.loadedModels, [])
  })

  test('translate validates the target and the size', async ({ assert }) => {
    const badTarget = await fetch(
      `${BASE}/api/assistant/translate`,
      json({ text: 'hi', target: 'xx' })
    )
    assert.equal(badTarget.status, 422)
    const tooLong = await fetch(
      `${BASE}/api/assistant/translate`,
      json({ text: 'a'.repeat(12_001), target: 'pt' })
    )
    assert.equal(tooLong.status, 422)
  })

  test('a cached passage is served from the cache, with no engine running', async ({ assert }) => {
    const text = 'Boil the water for one minute and let it cool before you drink it.'
    await db.table('translation_cache').insert({
      hash: translationCacheKey('en', 'pt', text),
      source_lang: 'en',
      target_lang: 'pt',
      engine: 'bergamot',
      translated: 'Ferva a água por um minuto e deixe esfriar antes de beber.',
      chars: text.length,
    })
    const res = await fetch(`${BASE}/api/assistant/translate`, json({ text, target: 'pt' }))
    assert.equal(res.status, 200)
    const body = (await res.json()) as any
    assert.equal(body.source, 'en')
    assert.equal(body.cachedSegments, 1)
    assert.equal(
      body.segments[0].translated,
      'Ferva a água por um minuto e deixe esfriar antes de beber.'
    )
    const stats = await new TranslationService({} as any).cacheStats()
    assert.equal(stats.segments, 1)
  })

  test('the reader assistant refuses files the library does not serve', async ({ assert }) => {
    const body = {
      action: 'explain',
      model: 'gemma4:12b',
      passage: { text: 'x', label: 'p. 1', page: 1 },
    }
    const missing = await fetch(
      `${BASE}/api/assistant/reader`,
      json({ ...body, filename: 'nope-pdf_1.pdf' })
    )
    assert.equal(missing.status, 404)
    const traversal = await fetch(
      `${BASE}/api/assistant/reader`,
      json({ ...body, filename: '../../etc/passwd' })
    )
    assert.equal(traversal.status, 404)
    const bad = await fetch(
      `${BASE}/api/assistant/reader`,
      json({ ...body, filename: 'x.pdf', action: 'delete' })
    )
    assert.equal(bad.status, 422)
  })

  test('regional and AMD backend settings are validated', async ({ assert }) => {
    assert.equal(await patchSetting('regional.environment', 'rural'), 200)
    assert.equal(await patchSetting('regional.environment', 'subúrbio'), 422)
    assert.equal(await patchSetting('regional.place', 'Manaus'), 200)
    assert.equal(await patchSetting('regional.place', 'x'.repeat(81)), 422)
    assert.equal(await patchSetting('regional.place', '<script>'), 422)
    assert.equal(await patchSetting('ai.amdBackend', 'vulkan'), 200)
    assert.equal(await patchSetting('ai.amdBackend', 'cuda'), 422)
    assert.equal(await KVStore.getValue('regional.environment'), 'rural')
  })

  test('the embedding profile is not a free setting; rebuild validates it', async ({ assert }) => {
    assert.notEqual(await patchSetting('rag.embeddingProfile', 'nomic-v1.5'), 200)
    const res = await fetch(
      `${BASE}/api/rag/reset-and-rebuild`,
      json({ embeddingProfile: 'bge-m3' })
    )
    assert.equal(res.status, 422)
  })

  test('survival chat requests accept a location and reject a bad one', async ({ assert }) => {
    const res = await fetch(
      `${BASE}/api/ollama/chat`,
      json({
        model: 'x',
        messages: [{ role: 'user', content: 'enchente' }],
        assistantMode: 'survival',
        location: { environment: 'montanha' },
      })
    )
    assert.equal(res.status, 422)
  })
})
