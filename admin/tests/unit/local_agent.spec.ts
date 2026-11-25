/**
 * Pure parts of the local AI agent: on-demand translation, the reader assistant, hardware model
 * recommendation, the AMD backend choice (Vulkan on RDNA 4, measured), the Vulkan-aware drift check,
 * generation-speed stats and the live GPU counters read from sysfs.
 *
 * No MySQL, Redis, Qdrant, Ollama or GPU needed:  npm run test:unit
 */
import * as assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'

import {
  detectLanguage,
  isTranslatable,
  segmentText,
  translationCacheKey,
} from '../../app/utils/translation.js'
import {
  buildReaderSystemPrompt,
  readerInstruction,
  summaryParts,
} from '../../app/utils/reader_assistant.js'
import { recommendModels } from '../../app/utils/model_recommendation.js'
import { isRdna4, pickAmdBackend, stripAmdBackendEnv } from '../../app/utils/amd_backend.js'
import { diffAmdOllamaConfig, resolveExpectedGpuVendor } from '../../app/services/ollama_compute.js'
import {
  recordInference,
  resetInferenceStats,
  summarizeInference,
} from '../../app/utils/inference_stats.js'
import { readDrmGpuTelemetry } from '../../app/utils/gpu_sysfs.js'

test('detectLanguage tells Portuguese from English and refuses tiny input', () => {
  assert.equal(
    detectLanguage('Para cada litro de água, adicione duas gotas de hipoclorito de sódio.'),
    'pt'
  )
  assert.equal(
    detectLanguage('Boil the water for one minute and let it cool before you drink it.'),
    'en'
  )
  assert.equal(detectLanguage('Hola'), null)
})

test('segmentText rebuilds the original exactly and respects the size', () => {
  const long = Array.from({ length: 40 }, (_, i) => `Frase número ${i} sobre água potável.`).join(
    ' '
  )
  const text = `Título\n\nPrimeiro parágrafo curto.\n\n${long}\n\nFim.`
  const segments = segmentText(text, 300)
  assert.equal(segments.map((s) => s.text + s.after).join(''), text)
  assert.ok(segments.every((s) => s.text.length <= 300))
  assert.ok(segments.length > 4)
})

test('translation cache key depends on direction and text, not surrounding spaces', () => {
  assert.equal(translationCacheKey('en', 'pt', ' water '), translationCacheKey('en', 'pt', 'water'))
  assert.notEqual(
    translationCacheKey('en', 'pt', 'water'),
    translationCacheKey('pt', 'en', 'water')
  )
  assert.equal(isTranslatable('12,5 %'), false)
  assert.equal(isTranslatable('água'), true)
})

test('reader prompt carries the work, the location and the passage', () => {
  const prompt = buildReaderSystemPrompt(
    {
      title: 'Guia de animais peçonhentos do Brasil',
      authors: ['Ministério da Saúde'],
      year: '2024',
    },
    { text: 'Não use torniquete.', label: 'p. 40', page: 40 }
  )
  assert.match(
    prompt,
    /"Guia de animais peçonhentos do Brasil", de Ministério da Saúde \(2024\), em p\. 40/
  )
  assert.match(prompt, /\[Trecho aberto — p\. 40\]\nNão use torniquete\./)
  assert.match(
    readerInstruction('explain', { selection: 'soro antibotrópico', label: 'p. 40' }),
    /soro antibotrópico/
  )
  assert.match(readerInstruction('summarize', { label: 'Capítulo 2' }), /Capítulo 2/)
})

test('summaryParts splits long chapters on paragraphs, keeps short ones whole', () => {
  assert.deepEqual(summaryParts('curto'), ['curto'])
  const paras = Array.from({ length: 10 }, (_, i) => `${i} `.repeat(400)).join('\n\n')
  const parts = summaryParts(paras, 2000)
  assert.ok(parts.length >= 4)
  assert.ok(parts.every((p) => p.length <= 2000))
})

test('recommendModels: the measured 16 GB tier', () => {
  const plan = recommendModels({ vramMiB: 16304, ramMiB: 32000 })
  assert.equal(plan.tier, 'gpu-16')
  assert.equal(plan.chat, 'gemma4:12b')
  assert.equal(plan.tasks, null)
  assert.equal(plan.embedding, 'embeddinggemma:latest')
  assert.equal(plan.measured, true)
  assert.equal(recommendModels({ vramMiB: null, ramMiB: 8000 }).tier, 'cpu')
  assert.equal(recommendModels({ vramMiB: 8192, ramMiB: 16000 }).chat, 'gemma4:e4b')
})

test('pickAmdBackend: Vulkan on RDNA 4, ROCm elsewhere, KV wins', () => {
  assert.deepEqual(pickAmdBackend({ manual: null, gfx: 'gfx1200' }), {
    backend: 'vulkan',
    source: 'rdna4',
  })
  assert.deepEqual(pickAmdBackend({ manual: undefined, gfx: null, pciDeviceIds: ['7590'] }), {
    backend: 'vulkan',
    source: 'rdna4',
  })
  assert.deepEqual(pickAmdBackend({ manual: '', gfx: 'gfx1100' }), {
    backend: 'rocm',
    source: 'default',
  })
  assert.deepEqual(pickAmdBackend({ manual: 'rocm', gfx: 'gfx1201' }), {
    backend: 'rocm',
    source: 'kv',
  })
  assert.deepEqual(pickAmdBackend({ manual: 'auto', gfx: 'gfx1103' }), {
    backend: 'rocm',
    source: 'default',
  })
  assert.equal(isRdna4({ pciDeviceId: '0x7550' }), true)
  assert.equal(isRdna4({ gfx: 'gfx1103' }), false)
})

test('stripAmdBackendEnv drops both backends’ variables only', () => {
  assert.deepEqual(
    stripAmdBackendEnv([
      'A=1',
      'OLLAMA_VULKAN=1',
      'HSA_OVERRIDE_GFX_VERSION=11.0.0',
      'OLLAMA_IGPU_ENABLE=1',
      'B=2',
    ]),
    ['A=1', 'B=2']
  )
})

test('a Vulkan AMD container is recognised and not flagged for a ROCm reinstall', () => {
  const vulkan = {
    Config: { Image: 'ollama/ollama:0.40.18', Env: ['OLLAMA_VULKAN=1'] },
    HostConfig: { Devices: [{ PathOnHost: '/dev/dri' }] },
  }
  assert.equal(
    resolveExpectedGpuVendor({
      hasNvidiaRuntime: false,
      amdConfigured: true,
      container: vulkan as any,
    }),
    'amd'
  )
  assert.deepEqual(diffAmdOllamaConfig(vulkan as any, null, 'vulkan'), [])
  // the same container is drift when ROCm is what a reinstall would build
  assert.ok(diffAmdOllamaConfig(vulkan as any, null, 'rocm').length > 0)
  // a ROCm container is drift when Vulkan is expected
  const rocm = {
    Config: { Image: 'ollama/ollama:rocm', Env: ['OLLAMA_IGPU_ENABLE=1'] },
    HostConfig: { Devices: [{ PathOnHost: '/dev/kfd' }, { PathOnHost: '/dev/dri' }] },
  }
  assert.deepEqual(diffAmdOllamaConfig(rocm as any, null, 'vulkan'), [
    'image is ollama/ollama:rocm, not the standard build with Vulkan',
    'OLLAMA_VULKAN=1 is not set',
  ])
})

test('inference stats average generation speed per model', () => {
  resetInferenceStats()
  recordInference('gemma4:12b', 'chat', {
    promptTokens: 2000,
    promptEvalMs: 2000,
    completionTokens: 650,
    evalMs: 10000,
  })
  recordInference('gemma4:12b', 'reader', { completionTokens: 700, evalMs: 10000 })
  recordInference('qwen3.5:9b', 'chat', { completionTokens: 100 })
  const [latest, first] = summarizeInference()
  assert.equal(latest.model, 'qwen3.5:9b')
  assert.equal(latest.avgGenTps, null)
  assert.equal(first.model, 'gemma4:12b')
  assert.equal(first.runs, 2)
  assert.equal(first.avgGenTps, 67.5)
  assert.equal(first.avgPromptTps, 1000)
})

const roots: string[] = []
after(async () => Promise.all(roots.map((r) => rm(r, { recursive: true, force: true }))))

test('readDrmGpuTelemetry reads amdgpu counters and hwmon units', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gpu-telemetry-'))
  roots.push(root)
  const pci = path.join(root, 'devices/pci0000:00/0000:0a:00.0')
  const drm = path.join(pci, 'drm/card1')
  await mkdir(path.join(pci, 'hwmon/hwmon2'), { recursive: true })
  await mkdir(drm, { recursive: true })
  await mkdir(path.join(root, 'class/drm'), { recursive: true })
  const files: Record<string, string> = {
    'vendor': '0x1002',
    'device': '0x7590',
    'gpu_busy_percent': '87',
    'mem_info_vram_total': String(16 * 1024 ** 3),
    'mem_info_vram_used': String(9 * 1024 ** 3),
    'mem_info_gtt_used': String(256 * 1024 ** 2),
    'hwmon/hwmon2/temp1_input': '61000',
    'hwmon/hwmon2/power1_average': '142000000',
    'hwmon/hwmon2/freq1_input': '3130000000',
  }
  for (const [f, v] of Object.entries(files)) await writeFile(path.join(pci, f), `${v}\n`)
  await symlink(pci, path.join(drm, 'device'))
  await symlink(drm, path.join(root, 'class/drm/card1'))
  const [gpu] = await readDrmGpuTelemetry(root)
  assert.deepEqual(gpu, {
    busAddress: '0a:00.0',
    vendorId: '1002',
    deviceId: '7590',
    busyPercent: 87,
    vramUsedMiB: 9216,
    vramTotalMiB: 16384,
    gttUsedMiB: 256,
    temperatureC: 61,
    powerW: 142,
    shaderClockMHz: 3130,
  })
  assert.deepEqual(await readDrmGpuTelemetry(path.join(root, 'missing')), [])
})
