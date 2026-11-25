import { RAG_MIN_FINAL_SCORE } from '../../constants/ollama.js'

/**
 * Embedding models the knowledge base can be indexed with, and which one a given install uses.
 *
 * Vectors from different models live in unrelated spaces: a query embedded with one model scored
 * against points embedded with another returns noise, with no error. So the model is a property of
 * the *index*, recorded in the KV store (`rag.embeddingProfile`) when the index is first written, and
 * changing it means rebuilding the index (RagService.resetAndRebuild), never just flipping a setting.
 *
 * Measured on 2026-11-24 (RX 9060 XT, Ollama 0.40.18, ROCm 7.2) with 18 Portuguese questions over
 * 2,036 chunks of the survival library (Ministério da Saúde, MDR and MMA PDFs) plus two English pages
 * for cross-lingual questions; a hit means a top-k chunk from the right document containing the answer:
 *
 *     model                      hit@1  hit@5  MRR@10  dim   chunks/s
 *     nomic-embed-text:v1.5      0.50   0.61   0.55    768   13.9
 *     nomic-embed-text-v2-moe    0.78   1.00   0.86    768   30.3   (512-token context: truncates)
 *     embeddinggemma             0.83   1.00   0.88    768   18.3
 *     qwen3-embedding:0.6b       0.67   0.94   0.80    1024  17.8
 *     bge-m3                     0.83   0.94   0.88    1024   8.0
 *
 * EmbeddingGemma is the default for new indexes: multilingual (100+ languages, Portuguese included),
 * a 2048-token context that holds the app's ~1500-token chunks whole, and the same 768 dimensions as
 * the collection already created on existing installs.
 */

export type EmbeddingProfileId = 'embeddinggemma' | 'nomic-v1.5'

export type EmbeddingProfile = {
  id: EmbeddingProfileId
  /** Ollama model tag pulled and called for /api/embed. */
  model: string
  /** Substring that identifies an already-installed variant of the model (e.g. a re-tagged pull). */
  matches: string
  queryPrefix: string
  documentPrefix: string
  dimension: number
  contextTokens: number
  multilingual: boolean
  /**
   * Post-rerank relevance floors (`rag.minRelevance` presets) on this model's score scale. Scores are
   * not comparable across embedding models, so a floor tuned for one drops or leaks on another.
   */
  relevanceFloors: RelevanceFloors
}

export type RelevanceFloors = { lenient: number; balanced: number; strict: number }

export const EMBEDDING_PROFILES: Record<EmbeddingProfileId, EmbeddingProfile> = {
  'embeddinggemma': {
    id: 'embeddinggemma',
    model: 'embeddinggemma:latest',
    matches: 'embeddinggemma',
    // EmbeddingGemma's documented retrieval prompts
    queryPrefix: 'task: search result | query: ',
    documentPrefix: 'title: none | text: ',
    dimension: 768,
    contextTokens: 2048,
    multilingual: true,
    // Measured 25/11/2026 on the 11-PDF survival library (483 chunks), 12 Portuguese questions
    // answered by it and 6 off-topic ones: the best passage scored 0.576–0.756 (the next two relevant
    // ones down to 0.49), and no off-topic question cleared the 0.3 cosine threshold at all. Under
    // the nomic floor (0.62) every passage was dropped for 3 of 12 questions (flood in Manaus,
    // landslide, drought), which then got answers with no source. Balanced sits 0.076 under the weakest best hit; strict is the
    // highest value that kept every best hit. No distractor corpus was indexed: recalibrate with
    // the eval harness once one is.
    relevanceFloors: { lenient: 0.45, balanced: 0.5, strict: 0.55 },
  },
  'nomic-v1.5': {
    id: 'nomic-v1.5',
    model: 'nomic-embed-text:v1.5',
    matches: 'nomic-embed-text',
    queryPrefix: 'search_query: ',
    documentPrefix: 'search_document: ',
    dimension: 768,
    contextTokens: 2048,
    multilingual: false,
    // The golden-set calibration documented at RAG_MIN_FINAL_SCORE (constants/ollama.ts)
    relevanceFloors: { lenient: 0.55, balanced: RAG_MIN_FINAL_SCORE, strict: 0.66 },
  },
}

/** What a brand-new index is built with. */
export const DEFAULT_EMBEDDING_PROFILE: EmbeddingProfileId = 'embeddinggemma'

/** What every index written before profiles existed was built with. */
export const LEGACY_EMBEDDING_PROFILE: EmbeddingProfileId = 'nomic-v1.5'

export function isEmbeddingProfileId(value: unknown): value is EmbeddingProfileId {
  return typeof value === 'string' && Object.hasOwn(EMBEDDING_PROFILES, value)
}

/**
 * The profile the current index uses.
 *
 * - A recorded, known profile wins.
 * - Nothing recorded and the collection already holds points: the index predates profiles, so it was
 *   built with nomic-embed-text v1.5. Keep it; switching silently would make every search return noise
 *   until a full rebuild finished.
 * - Nothing recorded and an empty (or missing) collection: a fresh index, built with the default.
 *
 * `persist` tells the caller to record the decision, so the answer cannot change later when the
 * collection fills up.
 */
export function resolveEmbeddingProfile(
  recorded: unknown,
  collectionHasPoints: boolean
): { profile: EmbeddingProfile; persist: boolean } {
  if (isEmbeddingProfileId(recorded)) {
    return { profile: EMBEDDING_PROFILES[recorded], persist: false }
  }
  const id = collectionHasPoints ? LEGACY_EMBEDDING_PROFILE : DEFAULT_EMBEDDING_PROFILE
  return { profile: EMBEDDING_PROFILES[id], persist: true }
}

/** Every embedding model the app may load, so chat-model housekeeping never unloads one by mistake. */
export function isKnownEmbeddingModel(name: string): boolean {
  const lower = name.toLowerCase()
  return Object.values(EMBEDDING_PROFILES).some((p) => lower.includes(p.matches))
}

export type RelevancePresetKey = 'off' | keyof RelevanceFloors

const RELEVANCE_PRESET_LABELS: Record<RelevancePresetKey, string> = {
  off: 'Off — use every passage retrieved',
  lenient: 'Lenient',
  balanced: 'Balanced (recommended)',
  strict: 'Strict',
}

/** The relevance presets offered in Settings > Models for an index built with this profile. */
export function relevancePresets(
  profile: EmbeddingProfile
): { key: RelevancePresetKey; value: number; label: string }[] {
  return (['off', 'lenient', 'balanced', 'strict'] as const).map((key) => ({
    key,
    value: key === 'off' ? 0 : profile.relevanceFloors[key],
    label: RELEVANCE_PRESET_LABELS[key],
  }))
}

/**
 * The floor to store when the index moves from one profile to another: a stored preset becomes the
 * same preset on the new model's scale; off and custom values return null (keep what is stored).
 */
export function remapRelevanceFloor(
  stored: number,
  from: EmbeddingProfile,
  to: EmbeddingProfile
): number | null {
  const preset = (Object.keys(from.relevanceFloors) as (keyof RelevanceFloors)[]).find(
    (key) => from.relevanceFloors[key] === stored
  )
  if (!preset) return null
  const next = to.relevanceFloors[preset]
  return next === stored ? null : next
}
