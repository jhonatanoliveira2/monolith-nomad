import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { freemem, totalmem } from 'node:os'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import KVStore from '#models/kv_store'
import { DockerService } from '#services/docker_service'
import { LibraryService } from '#services/library_service'
import { OllamaService } from '#services/ollama_service'
import { RagPipelineService } from '#services/rag_pipeline_service'
import { RagService } from '#services/rag_service'
import { SurvivalService } from '#services/survival_service'
import {
  TranslationService,
  TranslationTooLongError,
  TranslationUnavailableError,
} from '#services/translation_service'
import { readerAssistantSchema, translateSchema } from '#validators/assistant'
import { DEFAULT_KEEP_ALIVE, RAG_DEFAULT_SCORE_THRESHOLD } from '../../constants/ollama.js'
import { LIBRARY_STORAGE_PATH } from '../utils/fs.js'
import { readDrmGpuTelemetry, readDrmGpus } from '../utils/gpu_sysfs.js'
import { recentInference, recordInference, summarizeInference } from '../utils/inference_stats.js'
import { parseDocumentFilename } from '../utils/library.js'
import { recommendModels, DISCOURAGED_MODELS } from '../utils/model_recommendation.js'
import { buildCitations } from '../utils/rag_prompt.js'
import { resolveMinFinalScore } from '../utils/rag_relevance.js'
import {
  buildReaderSystemPrompt,
  combineSummariesPassage,
  partSummaryInstruction,
  readerContextTemplate,
  readerInstruction,
  summaryParts,
  type ReaderPassage,
  type ReaderWork,
} from '../utils/reader_assistant.js'
import type { RetrievedChunk } from '../../types/rag.js'

/**
 * The local AI agent's own endpoints: status (what is installed, how fresh the knowledge is, what the
 * hardware should run), live performance, on-demand translation and the reader assistant.
 * The general and survival chat go through /api/ollama/chat (OllamaController) so sessions, titles
 * and history are shared.
 */
@inject()
export default class AssistantController {
  constructor(
    private ollamaService: OllamaService,
    private ragService: RagService,
    private ragPipelineService: RagPipelineService,
    private survivalService: SurvivalService,
    private translationService: TranslationService,
    private dockerService: DockerService
  ) {}

  /** GET /api/assistant/status */
  async status({ response }: HttpContext) {
    const [gpus, embedding, bergamotPairs, cache, spec, region, installed] = await Promise.all([
      readDrmGpus(),
      this.ragService.getEmbeddingStatus().catch(() => null),
      this.translationService.bergamotPairs(),
      this.translationService.cacheStats().catch(() => ({ segments: 0, chars: 0 })),
      this.survivalService.getSpec(),
      this.survivalService.regionalSettings(),
      this.ollamaService.getModels().catch(() => []),
    ])
    const vramMiB = Math.max(0, ...gpus.map((g) => g.vramMiB ?? 0)) || null
    const ramMiB = Math.round(totalmem() / 1048576)
    const knowledge = spec
      ? await this.survivalService.knowledgeStatus(spec).catch(() => null)
      : null
    const amd = gpus.some((g) => g.vendorId === '1002')
    return response.status(200).json({
      offline: true,
      today: new Date().toISOString().slice(0, 10),
      hardware: { vramMiB, ramMiB, amd },
      recommendation: recommendModels({ vramMiB, ramMiB }),
      discouraged: DISCOURAGED_MODELS,
      installedModels: installed.map((m) => m.name),
      amdBackend: amd ? await this.dockerService.getAmdBackend().catch(() => null) : null,
      embedding,
      translation: { bergamotPairs, cache },
      survival: knowledge
        ? {
            works: knowledge.works,
            newest: knowledge.newest,
            oldest: knowledge.oldest,
            files: knowledge.titles,
            specVersion: spec?.spec_version ?? null,
          }
        : null,
      region,
    })
  }

  /** GET /api/assistant/performance: polled by the panel every few seconds. */
  async performance({ response }: HttpContext) {
    const [gpus, loaded, meminfo] = await Promise.all([
      readDrmGpuTelemetry(),
      this.ollamaService.getLoadedModels(),
      readFile('/proc/meminfo', 'utf8').catch(() => ''),
    ])
    // MemAvailable is what can be used without swapping; os.freemem() undercounts page cache
    const available = /MemAvailable:\s+(\d+) kB/.exec(meminfo)?.[1]
    const totalMiB = Math.round(totalmem() / 1048576)
    const availableMiB = available
      ? Math.round(Number(available) / 1024)
      : Math.round(freemem() / 1048576)
    return response.status(200).json({
      at: Date.now(),
      gpus,
      memory: { totalMiB, availableMiB, usedMiB: totalMiB - availableMiB },
      loadedModels: loaded,
      models: summarizeInference(),
      recent: recentInference().slice(0, 10),
    })
  }

  /** POST /api/assistant/translate */
  async translate({ request, response }: HttpContext) {
    const data = await request.validateUsing(translateSchema)
    try {
      const result = await this.translationService.translate({
        text: data.text,
        target: data.target,
        source: data.source ?? null,
        model: data.model ?? (await KVStore.getValue('chat.lastModel')),
      })
      return response.status(200).json(result)
    } catch (error) {
      if (error instanceof TranslationTooLongError) {
        return response.status(413).json({ message: error.message })
      }
      if (error instanceof TranslationUnavailableError) {
        return response.status(503).json({ message: error.message })
      }
      logger.error({ err: error }, '[AssistantController] translation failed')
      return response.status(500).json({ message: 'Translation failed.' })
    }
  }

  /**
   * POST /api/assistant/reader — Server-Sent Events, same framing as /api/ollama/chat:
   * `{progress}` while a long summary is done in parts, Ollama chunks, then `{sources}`.
   */
  async reader({ request, response }: HttpContext) {
    const data = await request.validateUsing(readerAssistantSchema)
    const libraryService = new LibraryService()
    const filePath = await libraryService.resolveInstalledFile(data.filename)
    if (!filePath) return response.status(404).json({ message: 'Document not found.' })
    const work = await this.workFor(libraryService, data.filename)

    response.response.setHeader('Content-Type', 'text/event-stream')
    response.response.setHeader('Cache-Control', 'no-cache')
    response.response.setHeader('Connection', 'keep-alive')
    response.response.flushHeaders()
    const send = (payload: unknown) =>
      response.response.write(`data: ${JSON.stringify(payload)}\n\n`)
    const abort = new AbortController()
    response.response.on('close', () => abort.abort())

    try {
      const thinkingCapable = await this.ollamaService.checkModelHasThinking(data.model)
      let passage: ReaderPassage = {
        text: data.passage.text,
        label: data.passage.label,
        page: data.passage.page,
        href: data.passage.href,
      }

      // Long passages (a chapter) are summarised in parts first, then the parts are combined
      if (data.action === 'summarize') {
        const parts = summaryParts(passage.text)
        if (parts.length > 1) {
          const partials: string[] = []
          for (const [index, part] of parts.entries()) {
            if (abort.signal.aborted) return
            send({ progress: { done: index, total: parts.length } })
            const res = await this.ollamaService.chat({
              model: data.model,
              messages: [
                {
                  role: 'system',
                  content: buildReaderSystemPrompt(work, { ...passage, text: part }),
                },
                {
                  role: 'user',
                  content: partSummaryInstruction(index, parts.length, passage.label),
                },
              ],
              numPredict: 400,
              temperature: 0.2,
              think: false,
              thinkingCapable,
            })
            if (res.usage) recordInference(data.model, 'reader', res.usage)
            partials.push(res.message.content.trim())
          }
          send({ progress: { done: parts.length, total: parts.length } })
          passage = {
            ...combineSummariesPassage(partials, passage.label),
            page: passage.page,
            href: passage.href,
          }
        }
      }

      // Other passages of the same book, when it is indexed (explanations and questions)
      let related: RetrievedChunk[] = []
      if (data.action !== 'summarize') {
        const query =
          [data.question, data.selection].filter(Boolean).join(' ').trim() ||
          passage.text.slice(0, 600)
        related = await this.ragService
          .searchSimilarDocuments(
            query,
            4,
            RAG_DEFAULT_SCORE_THRESHOLD,
            undefined,
            undefined,
            await resolveMinFinalScore(),
            undefined,
            sourceCandidates(filePath, data.filename)
          )
          .catch(() => [])
        // The open page is already in the prompt verbatim
        const page = data.passage.page
        if (page) {
          related = related.filter(
            (c) => !(c.metadata?.page_start <= page && c.metadata?.page_end >= page)
          )
        }
      }

      const messages = [
        { role: 'system' as const, content: buildReaderSystemPrompt(work, passage) },
        ...(data.history ?? []),
        {
          role: 'user' as const,
          content: readerInstruction(data.action, {
            selection: data.selection,
            question: data.question,
            label: passage.label,
          }),
        },
      ]
      const trace = await this.ragPipelineService.buildPrompt(messages, data.model, {
        oracleContext: related,
        renderContext: readerContextTemplate,
      })
      const keepAlive = (await KVStore.getValue('ai.keepAlive')) || DEFAULT_KEEP_ALIVE
      const stream = await this.ollamaService.chatStream({
        model: data.model,
        messages: trace.messages,
        numCtx: trace.numCtx,
        numPredict: trace.numPredict,
        keepAlive,
        think: false,
        thinkingCapable,
        signal: abort.signal,
      })
      for await (const chunk of stream) {
        if (chunk.usage) recordInference(data.model, 'reader', chunk.usage)
        send(chunk)
      }

      // The open passage first, then the other pages the answer was given
      const here: RetrievedChunk = {
        text: '',
        score: 1,
        metadata: {
          source: filePath,
          archive_title: work.title,
          archive_date: work.year ?? undefined,
          ...(data.passage.page
            ? { page_start: data.passage.page, page_end: data.passage.page }
            : {}),
          ...(data.passage.href
            ? { chapter: data.passage.label, chapter_href: data.passage.href }
            : {}),
        },
      }
      send({ sources: buildCitations([here, ...trace.injected]) })
    } catch (error) {
      if (abort.signal.aborted) return
      logger.error({ err: error }, '[AssistantController] reader assistant failed')
      send({ error: true })
    } finally {
      response.response.end()
    }
  }

  private async workFor(libraryService: LibraryService, filename: string): Promise<ReaderWork> {
    const parsed = parseDocumentFilename(filename)
    const spec = await libraryService.getSpec().catch(() => null)
    const item = parsed ? spec?.items.find((i) => i.id === parsed.itemId) : undefined
    return item
      ? { title: item.title, authors: item.authors, year: item.year }
      : { title: filename, authors: [], year: null }
  }
}

/** How a library file may be recorded as `source` in the index (absolute or relative to the app). */
function sourceCandidates(filePath: string, filename: string): string[] {
  return [
    ...new Set([
      filePath,
      join(process.cwd(), LIBRARY_STORAGE_PATH, basename(filename)),
      join(LIBRARY_STORAGE_PATH, basename(filename)).replace(/^\//, ''),
    ]),
  ]
}
