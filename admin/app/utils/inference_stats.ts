/**
 * The last few model generations this process ran, for the AI performance panel: prompt and
 * generation speed per model, measured from Ollama's own counters (eval_count / eval_duration).
 * In-memory and bounded; a restart simply starts a new window.
 */

export type InferenceSample = {
  at: number
  model: string
  /** chat | survival | reader | translate */
  kind: string
  promptTokens: number | null
  completionTokens: number | null
  promptTps: number | null
  genTps: number | null
}

const MAX_SAMPLES = 50
const samples: InferenceSample[] = []

const rate = (tokens: number | undefined, ms: number | undefined) =>
  tokens && ms && ms > 0 ? Math.round((tokens / (ms / 1000)) * 10) / 10 : null

export function recordInference(
  model: string,
  kind: string,
  usage: {
    promptTokens?: number
    completionTokens?: number
    promptEvalMs?: number
    evalMs?: number
  }
) {
  samples.push({
    at: Date.now(),
    model,
    kind,
    promptTokens: usage.promptTokens ?? null,
    completionTokens: usage.completionTokens ?? null,
    promptTps: rate(usage.promptTokens, usage.promptEvalMs),
    genTps: rate(usage.completionTokens, usage.evalMs),
  })
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES)
}

export type InferenceSummary = {
  model: string
  runs: number
  avgGenTps: number | null
  avgPromptTps: number | null
  lastAt: number
}

/** Per-model averages over the window, most recently used first. */
export function summarizeInference(list: InferenceSample[] = samples): InferenceSummary[] {
  const byModel = new Map<string, InferenceSample[]>()
  for (const s of list) byModel.set(s.model, [...(byModel.get(s.model) ?? []), s])
  const avg = (values: (number | null)[]) => {
    const v = values.filter((x): x is number => x !== null)
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
  }
  // Most recent last sample first; the position breaks ties within the same millisecond
  const lastIndex = (model: string) => list.map((s) => s.model).lastIndexOf(model)
  return [...byModel.entries()]
    .map(([model, runs]) => ({
      model,
      runs: runs.length,
      avgGenTps: avg(runs.map((r) => r.genTps)),
      avgPromptTps: avg(runs.map((r) => r.promptTps)),
      lastAt: Math.max(...runs.map((r) => r.at)),
    }))
    .sort((a, b) => lastIndex(b.model) - lastIndex(a.model))
}

export function recentInference(): InferenceSample[] {
  return [...samples].reverse()
}

/** Test hook. */
export function resetInferenceStats() {
  samples.length = 0
}
