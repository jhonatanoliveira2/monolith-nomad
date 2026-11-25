/**
 * Which local models to install for the hardware the app finds, so the assistant is good in Brazilian
 * Portuguese without overflowing VRAM.
 *
 * The 16 GB tier was measured on 2026-11-24 on an RX 9060 XT 16 GB (Ollama 0.40.18, Vulkan, 16k
 * context, q8_0 KV cache) with Portuguese RAG, translation and classification tasks:
 *
 *     model         gen t/s  VRAM     grounded RAG answer   pt-BR translation
 *     gemma4:12b    65–76    ~8.9 GB  faithful, complete    very good ("antiofídicos")
 *     qwen3.5:9b    48–51    ~5.9 GB  faithful              good (anglicisms)
 *     gemma4:e4b    118–172  ~5.0 GB  faithful, shorter     very good
 *     qwen3:14b     30       ~10.6 GB faithful, small adds  good
 *     gpt-oss:20b   63       ~12.7 GB invented facts and attributed them to the sources → excluded
 *
 * gemma4:12b with gemma4:e4b and embeddinggemma loaded together needs ~15.4 GB, which Ollama will not
 * keep resident on a 16 GB card (it evicts), so on 16 GB the chat model also does the ancillary tasks.
 * Smaller tiers follow from the measured VRAM of each model; they are marked `measured: false`.
 */

export type ModelPlan = {
  tier: 'gpu-16' | 'gpu-10' | 'gpu-6' | 'cpu'
  chat: string
  /** Separate small model for query rewrites, titles and classification; null = reuse `chat`. */
  tasks: string | null
  embedding: string
  contextWindow: number
  measured: boolean
  notes: string[]
}

export const EMBEDDING_MODEL = 'embeddinggemma:latest'

/** Download sizes from the Ollama registry manifests (2026-11-24), for the setup disk summary. */
export const MODEL_DOWNLOAD_SIZES: Record<string, string> = {
  'gemma4:12b': '8.0 GB',
  'qwen3.5:9b': '6.6 GB',
  'gemma4:e4b': '6.6 GB',
  'gemma4:e2b': '4.6 GB',
  'embeddinggemma:latest': '622 MB',
}

/** Models never recommended for the survival agent, and why (shown in the model list). */
export const DISCOURAGED_MODELS: Record<string, string> = {
  'gpt-oss:20b':
    'Inventou dados e os atribuiu às fontes no teste de sobrevivência em português (24/11/2026).',
}

export function recommendModels(input: { vramMiB: number | null; ramMiB: number }): ModelPlan {
  const vram = input.vramMiB ?? 0
  if (vram >= 14_000) {
    return {
      tier: 'gpu-16',
      chat: 'gemma4:12b',
      tasks: null,
      embedding: EMBEDDING_MODEL,
      contextWindow: 16_384,
      measured: true,
      notes: [
        'gemma4:12b responde com fidelidade às fontes e traduz bem para o português (medido em uma RX 9060 XT 16 GB).',
        'O mesmo modelo faz as tarefas auxiliares: um segundo modelo não caberia junto na VRAM.',
      ],
    }
  }
  if (vram >= 9_000) {
    return {
      tier: 'gpu-10',
      chat: 'qwen3.5:9b',
      tasks: null,
      embedding: EMBEDDING_MODEL,
      contextWindow: 16_384,
      measured: false,
      notes: [
        'qwen3.5:9b ocupa ~5,9 GB com 16k de contexto; sobra espaço para o modelo de embedding.',
      ],
    }
  }
  if (vram >= 6_000) {
    return {
      tier: 'gpu-6',
      chat: 'gemma4:e4b',
      tasks: null,
      embedding: EMBEDDING_MODEL,
      contextWindow: 8_192,
      measured: false,
      notes: ['gemma4:e4b ocupa ~5 GB com 16k de contexto; com 8k cabe junto do embedding.'],
    }
  }
  return {
    tier: 'cpu',
    chat: input.ramMiB >= 16_000 ? 'gemma4:e4b' : 'gemma4:e2b',
    tasks: null,
    embedding: EMBEDDING_MODEL,
    contextWindow: 8_192,
    measured: false,
    notes: ['Sem GPU com VRAM suficiente: respostas mais lentas (CPU).'],
  }
}
