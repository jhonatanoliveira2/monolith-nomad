/** Shapes of /api/assistant/* responses, shared by the controller and the interface. */
import type { DrmGpuTelemetry } from '../app/utils/gpu_sysfs.js'
import type { ModelPlan } from '../app/utils/model_recommendation.js'
import type { InferenceSample, InferenceSummary } from '../app/utils/inference_stats.js'
import type { ScenarioClassification, SurvivalLocation } from '../app/utils/survival_knowledge.js'
import type { TranslationLanguage } from '../app/utils/translation.js'

export type AssistantStatus = {
  offline: true
  today: string
  hardware: { vramMiB: number | null; ramMiB: number; amd: boolean }
  recommendation: ModelPlan
  discouraged: Record<string, string>
  installedModels: string[]
  amdBackend: { backend: 'rocm' | 'vulkan'; source: 'kv' | 'rdna4' | 'default' } | null
  embedding: {
    profile: 'embeddinggemma' | 'nomic-v1.5'
    model: string
    multilingual: boolean
    recommended: 'embeddinggemma' | 'nomic-v1.5'
    migrationAvailable: boolean
  } | null
  translation: { bergamotPairs: string[]; cache: { segments: number; chars: number } }
  survival: {
    works: number
    newest: string | null
    oldest: string | null
    files: string[]
    specVersion: string | null
  } | null
  region: { state: string | null; environment: string | null; place: string | null }
}

export type AssistantPerformance = {
  at: number
  gpus: DrmGpuTelemetry[]
  memory: { totalMiB: number; availableMiB: number; usedMiB: number }
  loadedModels: Array<{
    name: string
    sizeBytes: number
    vramBytes: number
    contextLength: number | null
    expiresAt: string | null
  }>
  models: InferenceSummary[]
  recent: InferenceSample[]
}

export type TranslationResponse = {
  source: TranslationLanguage | null
  target: TranslationLanguage
  engine: string
  segments: { source: string; translated: string; after: string; cached: boolean }[]
  cachedSegments: number
  ms: number
}

/** Leading event of a survival-mode chat stream. */
export type SurvivalMeta = {
  labels: {
    level: string
    hazards: string[]
    phase: string
    region: string | null
    state: string | null
  }
  scenario: ScenarioClassification
  location: SurvivalLocation
  knowledge: { works: number; newest: string | null; oldest: string | null; titles: string[] }
}

export type { TranslationLanguage }
