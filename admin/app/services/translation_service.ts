import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import axios from 'axios'
import Service from '#models/service'
import { OllamaService } from '#services/ollama_service'
import { SERVICE_NAMES } from '../../constants/service_names.js'
import {
  LANGUAGE_NAMES,
  TRANSLATION_MAX_CHARS,
  detectLanguage,
  isTranslatable,
  segmentText,
  translationCacheKey,
  type TranslationLanguage,
} from '../utils/translation.js'

/** Container port of the Translated Library proxy (its host port, 8460, is not used inside Docker). */
const BERGAMOT_PORT = 8391
/** Model calls in flight per request: keeps a page fast without starving the chat. */
const LLM_CONCURRENCY = 2

export type TranslatedSegment = {
  source: string
  translated: string
  after: string
  cached: boolean
}

export type TranslationResult = {
  source: TranslationLanguage | null
  target: TranslationLanguage
  engine: string
  segments: TranslatedSegment[]
  cachedSegments: number
  ms: number
}

export class TranslationTooLongError extends Error {}
export class TranslationUnavailableError extends Error {}

/**
 * On-demand translation of what the reader is looking at: a selection, a page, a chapter excerpt.
 *
 * Engines, in order: Bergamot through the Translated Library app (CPU, fast, Firefox's models) when it
 * is installed and has the language pair; otherwise the local chat model with a strict
 * translate-only prompt. Every segment is cached (translation_cache), so re-opening a page costs
 * nothing, and the original file is never written to.
 */
@inject()
export class TranslationService {
  constructor(private ollamaService: OllamaService) {}

  private async bergamotUrl(): Promise<string | null> {
    const installed = await Service.query()
      .where('service_name', SERVICE_NAMES.TRANSLATE)
      .andWhere('installed', true)
      .first()
    if (!installed) return null
    return process.env.NODE_ENV === 'production'
      ? `http://${SERVICE_NAMES.TRANSLATE}:${BERGAMOT_PORT}`
      : 'http://localhost:8460'
  }

  /** Language pairs Bergamot can serve right now (empty when the app is absent or too old). */
  async bergamotPairs(): Promise<string[]> {
    const url = await this.bergamotUrl()
    if (!url) return []
    try {
      const res = await axios.get(`${url}/api/translate/languages`, { timeout: 3000 })
      return res.data?.available ? (res.data.pairs as string[]) : []
    } catch {
      return [] // an older proxy without the JSON API, or not running
    }
  }

  async translate(input: {
    text: string
    target: TranslationLanguage
    source?: TranslationLanguage | null
    model?: string | null
  }): Promise<TranslationResult> {
    const started = Date.now()
    if (input.text.length > TRANSLATION_MAX_CHARS) {
      throw new TranslationTooLongError('Too long to translate at once: select a shorter passage.')
    }
    const source = input.source ?? detectLanguage(input.text)
    const segments = segmentText(input.text)
    const target = input.target

    if (source === target) {
      return {
        source,
        target,
        engine: 'none',
        segments: segments.map((s) => ({
          source: s.text,
          translated: s.text,
          after: s.after,
          cached: false,
        })),
        cachedSegments: 0,
        ms: Date.now() - started,
      }
    }

    const srcKey = source ?? 'auto'
    const keys = segments.map((s) => translationCacheKey(srcKey, target, s.text))
    const rows = keys.length
      ? await db.from('translation_cache').whereIn('hash', keys).select('hash', 'translated')
      : []
    const cached = new Map(
      rows.map((r: { hash: string; translated: string }) => [r.hash, r.translated])
    )

    const missing = segments
      .map((s, i) => ({ i, text: s.text }))
      .filter(({ i, text }) => !cached.has(keys[i]) && isTranslatable(text))

    let engine = 'cache'
    const fresh = new Map<number, string>()
    if (missing.length > 0) {
      const pairs = source ? await this.bergamotPairs() : []
      const direct = source && pairs.includes(`${source}${target}`)
      const pivot =
        source && pairs.includes(`${source}en`) && pairs.includes(`en${target}`) && source !== 'en'
      if (source && (direct || pivot)) {
        engine = 'bergamot'
        const out = await this.viaBergamot(
          source,
          target,
          missing.map((m) => m.text)
        )
        missing.forEach((m, k) => fresh.set(m.i, out[k]))
      } else {
        const model = await this.pickModel(input.model)
        if (!model)
          throw new TranslationUnavailableError('No local model is installed for translation.')
        engine = `llm:${model}`
        await this.viaModel(model, source, target, missing, fresh)
      }
      await this.store(
        srcKey,
        target,
        engine,
        keys,
        fresh,
        segments.map((s) => s.text)
      )
    }

    const out: TranslatedSegment[] = segments.map((s, i) => ({
      source: s.text,
      translated: cached.get(keys[i]) ?? fresh.get(i) ?? s.text,
      after: s.after,
      cached: cached.has(keys[i]),
    }))
    return {
      source,
      target,
      engine,
      segments: out,
      cachedSegments: out.filter((s) => s.cached).length,
      ms: Date.now() - started,
    }
  }

  private async viaBergamot(source: string, target: string, texts: string[]): Promise<string[]> {
    const url = await this.bergamotUrl()
    const res = await axios.post(
      `${url}/api/translate`,
      { from: source, to: target, texts },
      { timeout: 120_000 }
    )
    return res.data.translations as string[]
  }

  private async pickModel(requested?: string | null): Promise<string | null> {
    const installed = await this.ollamaService.getModels().catch(() => [])
    if (requested && installed.some((m) => m.name === requested)) return requested
    return installed[0]?.name ?? null
  }

  private async viaModel(
    model: string,
    source: TranslationLanguage | null,
    target: TranslationLanguage,
    missing: { i: number; text: string }[],
    fresh: Map<number, string>
  ) {
    const thinkingCapable = await this.ollamaService.checkModelHasThinking(model)
    const from = source ? LANGUAGE_NAMES[source] : 'o idioma original'
    const system =
      `Você é um tradutor. Traduza o texto do usuário de ${from} para ${LANGUAGE_NAMES[target]}. ` +
      'Responda somente com a tradução, sem comentários, sem aspas e sem explicar. Preserve números, ' +
      'unidades, nomes próprios, siglas e a formatação (quebras de linha, listas). Não resuma nem acrescente nada.'
    let next = 0
    const worker = async () => {
      while (next < missing.length) {
        const item = missing[next++]
        const res = await this.ollamaService.chat({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: item.text },
          ],
          temperature: 0.1,
          numPredict: Math.min(2048, Math.ceil(item.text.length / 2) + 64),
          think: false,
          thinkingCapable,
        })
        fresh.set(item.i, res.message.content.trim())
      }
    }
    await Promise.all(Array.from({ length: Math.min(LLM_CONCURRENCY, missing.length) }, worker))
  }

  private async store(
    source: string,
    target: string,
    engine: string,
    keys: string[],
    fresh: Map<number, string>,
    texts: string[]
  ) {
    const rows = [...fresh.entries()]
      .filter(([, translated]) => translated.length > 0)
      .map(([i, translated]) => ({
        hash: keys[i],
        source_lang: source,
        target_lang: target,
        engine: engine.slice(0, 120),
        translated,
        chars: texts[i].length,
      }))
    if (rows.length === 0) return
    try {
      // Two readers translating the same page at once race on the key; the second insert is a no-op
      await db.knexQuery().table('translation_cache').insert(rows).onConflict('hash').ignore()
    } catch (error) {
      // A cache write failing must not fail the translation the user is waiting for
      logger.warn(
        `[Translation] cache write failed: ${error instanceof Error ? error.message : error}`
      )
    }
  }

  async cacheStats(): Promise<{ segments: number; chars: number }> {
    const [row] = await db.from('translation_cache').count('* as n').sum('chars as c')
    return { segments: Number(row?.n ?? 0), chars: Number(row?.c ?? 0) }
  }
}
