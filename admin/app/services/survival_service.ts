import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import KVStore from '#models/kv_store'
import { OllamaService } from '#services/ollama_service'
import { RagService } from '#services/rag_service'
import type { RetrievedChunk } from '../../types/rag.js'
import { resolveTasksModel } from '../utils/tasks_model.js'
import {
  buildSurvivalSystemPrompt,
  classificationSchema,
  classifyScenario,
  englishRetrievalTerms,
  fileEditionDate,
  mergeModelClassification,
  rankWorks,
  resolveLocation,
  scenarioLabels,
  workMatchesFile,
  type KnowledgeBaseDates,
  type ScenarioClassification,
  type SurvivalLocation,
  type SurvivalSpec,
} from '../utils/survival_knowledge.js'
import { RAG_DEFAULT_SCORE_THRESHOLD } from '../../constants/ollama.js'
import { resolveMinFinalScore } from '../utils/rag_relevance.js'

/** Indexed survival works seen in the knowledge base, refreshed at most this often. */
const INDEX_TTL_MS = 60_000
/** The model refinement must never hold up an answer: past this, the heuristic stands. */
const CLASSIFY_TIMEOUT_MS = 8_000
const MAX_CHUNKS = 8

let specCache: SurvivalSpec | null = null
let indexCache: { at: number; files: { source: string; fileName: string }[] } | null = null

export type SurvivalTurn = {
  labels: ReturnType<typeof scenarioLabels>
  scenario: ScenarioClassification
  location: SurvivalLocation
  knowledge: KnowledgeBaseDates & { titles: string[] }
  systemPrompt: string
  chunks: RetrievedChunk[]
}

/**
 * The survival agent: classifies the scenario, places it, retrieves from the survival works first and
 * then from the whole knowledge base (plus English terms for the English ZIMs), and builds the
 * instructions the chat model answers under. The chat endpoint injects the result through
 * RagPipelineService's oracle path, so budgeting, history and streaming stay the regular ones.
 */
@inject()
export class SurvivalService {
  constructor(
    private ragService: RagService,
    private ollamaService: OllamaService
  ) {}

  /** collections/survival.json shipped in the image (/app/collections) or the repo in development. */
  async getSpec(): Promise<SurvivalSpec | null> {
    if (specCache) return specCache
    for (const dir of [
      join(process.cwd(), 'collections'),
      join(process.cwd(), '..', 'collections'),
    ]) {
      try {
        specCache = JSON.parse(await readFile(join(dir, 'survival.json'), 'utf8')) as SurvivalSpec
        return specCache
      } catch {
        // next location
      }
    }
    logger.warn('[Survival] collections/survival.json not found; survival mode unavailable')
    return null
  }

  async regionalSettings() {
    const [state, environment, place] = await Promise.all([
      KVStore.getValue('regional.state'),
      KVStore.getValue('regional.environment'),
      KVStore.getValue('regional.place'),
    ])
    return { state, environment, place }
  }

  /** Heuristic classification, refined by a small grammar-constrained model call when one answers in time. */
  async classify(question: string, chatModel: string, spec: SurvivalSpec) {
    const heuristic = classifyScenario(question, spec)
    try {
      const model =
        (await resolveTasksModel(this.ollamaService, chatModel, undefined, '[Survival]')) ??
        chatModel
      const thinkingCapable = await this.ollamaService.checkModelHasThinking(model)
      const levels = spec.levels.map((l) => `${l.level} ${l.name} (${l.scope})`).join('; ')
      const call = this.ollamaService.chat({
        model,
        messages: [
          {
            role: 'system',
            content: `Classifique o cenário de emergência da pergunta. Níveis: ${levels}. Ameaças: ${spec.hazards.map((h) => `${h.id} = ${h.name}`).join('; ')}. Fases: ${spec.phases.map((p) => `${p.id} = ${p.name}`).join('; ')}. O nível mede extensão, gravidade e duração, não o tipo de desastre. Responda só JSON.`,
          },
          { role: 'user', content: question.slice(0, 2000) },
        ],
        format: classificationSchema(spec),
        temperature: 0,
        numPredict: 200,
        think: false,
        thinkingCapable,
      })
      const response = await Promise.race([
        call,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), CLASSIFY_TIMEOUT_MS)),
      ])
      if (!response) return heuristic
      return mergeModelClassification(heuristic, JSON.parse(response.message.content), spec)
    } catch (error) {
      logger.debug(
        `[Survival] model classification skipped: ${error instanceof Error ? error.message : error}`
      )
      return heuristic
    }
  }

  /** Indexed files of the knowledge base (cached), for matching survival works and dating them. */
  private async indexedFiles() {
    if (indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) return indexCache.files
    try {
      const stored = await this.ragService.getStoredFiles()
      const files = stored
        .filter((f) => f.chunksEmbedded > 0)
        .map((f) => ({ source: f.source, fileName: f.fileName }))
      indexCache = { at: Date.now(), files }
      return files
    } catch {
      return indexCache?.files ?? []
    }
  }

  /** Which survival works are indexed, and the span of their edition dates. */
  async knowledgeStatus(spec: SurvivalSpec) {
    const files = await this.indexedFiles()
    const matched = files.filter((f) => spec.works.some((w) => workMatchesFile(w, f.fileName)))
    const dates = matched
      .map((f) => fileEditionDate(f.fileName))
      .filter((d): d is string => !!d)
      .sort()
    return {
      works: matched.length,
      newest: dates.at(-1) ?? null,
      oldest: dates[0] ?? null,
      titles: matched.map((f) => f.fileName),
      sourcesFor: (matches: string[]) =>
        files
          .filter((f) => matches.some((m) => workMatchesFile({ match: m }, f.fileName)))
          .map((f) => f.source),
    }
  }

  /** Everything one survival turn needs: scenario, place, sources and the system prompt. */
  async prepareTurn(input: {
    question: string
    retrievalQuery: string
    chatModel: string
    location?: { state?: string | null; environment?: string | null; place?: string | null }
  }): Promise<SurvivalTurn | null> {
    const spec = await this.getSpec()
    if (!spec) return null

    const settings = await this.regionalSettings()
    const location = resolveLocation(input.question, spec, {
      ...settings,
      ...stripEmpty(input.location),
    })
    const [scenario, status] = await Promise.all([
      this.classify(input.question, input.chatModel, spec),
      this.knowledgeStatus(spec),
    ])

    const ranked = rankWorks(spec, scenario, location.region).slice(0, 12)
    const preferred = status.sourcesFor(ranked.map((w) => w.match))
    const minFinalScore = await resolveMinFinalScore()

    const search = (query: string, sources?: string[], limit = 5) =>
      this.ragService
        .searchSimilarDocuments(
          query,
          limit,
          RAG_DEFAULT_SCORE_THRESHOLD,
          undefined,
          undefined,
          minFinalScore,
          undefined,
          sources
        )
        .catch(() => [] as RetrievedChunk[])

    const english = englishRetrievalTerms(spec, scenario)
    const [fromSurvival, fromAll, fromEnglish] = await Promise.all([
      preferred.length > 0 ? search(input.retrievalQuery, preferred, 5) : Promise.resolve([]),
      search(input.retrievalQuery, undefined, 5),
      english ? search(`${input.retrievalQuery} ${english}`, undefined, 3) : Promise.resolve([]),
    ])

    // Survival works first (official Brazilian guidance), then the rest; one copy of each passage
    const seen = new Set<string>()
    const chunks: RetrievedChunk[] = []
    for (const chunk of [...fromSurvival, ...fromAll, ...fromEnglish]) {
      const key = `${chunk.metadata?.source}|${chunk.text.slice(0, 120)}`
      if (seen.has(key)) continue
      seen.add(key)
      chunks.push(chunk)
      if (chunks.length >= MAX_CHUNKS) break
    }

    const knowledge = {
      works: status.works,
      newest: status.newest,
      oldest: status.oldest,
      titles: status.titles,
    }
    const today = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())
    return {
      labels: scenarioLabels(spec, scenario, location),
      scenario,
      location,
      knowledge,
      chunks,
      systemPrompt: buildSurvivalSystemPrompt({ spec, scenario, location, knowledge, today }),
    }
  }
}

function stripEmpty<T extends Record<string, unknown>>(obj: T | undefined): Partial<T> {
  if (!obj) return {}
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '')
  ) as Partial<T>
}
