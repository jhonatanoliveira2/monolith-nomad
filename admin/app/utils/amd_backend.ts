/**
 * Which Ollama compute backend an AMD GPU runs on: ROCm (the `ollama/ollama:rocm` image with /dev/kfd
 * and /dev/dri) or Vulkan (the standard image with OLLAMA_VULKAN=1 and /dev/dri only, using the Mesa
 * RADV driver shipped in the image).
 *
 * Measured on 2026-11-24 on an RX 9060 XT 16 GB (Navi 44, gfx1200), Ryzen 7 5700X, Ollama 0.40.18,
 * ROCm 7.2 vs RADV (Mesa 25.2.8 inside the official image), flash attention and q8_0 KV cache on:
 *
 *                                   ROCm        Vulkan (container)
 *     gemma4:12b generation         52.2 t/s    65.2 t/s     (+25 %)
 *     gemma4:12b 7.5k-token prompt  1165 t/s    996 t/s      (-15 %)
 *     embeddinggemma, 32 chunks     19.8 /s     37.6 /s      (+90 %)
 *
 * Generation and indexing dominate this app's use (chat answers, reader explanations, embedding whole
 * ZIMs), so RDNA 4 defaults to Vulkan. Older AMD generations keep ROCm: nothing was measured there and
 * the ROCm path (HSA overrides, iGPU flag) is the one with field history.
 */

export type AmdBackend = 'rocm' | 'vulkan'

export type AmdBackendResolution = {
  backend: AmdBackend
  source: 'kv' | 'rdna4' | 'default'
}

/** RDNA 4 PCI device ids: Navi 44 (RX 9060 XT / 9050) and Navi 48 (RX 9070 series). */
const RDNA4_PCI_DEVICE_IDS = new Set(['7590', '7550', '7551'])

export function isRdna4(input: { gfx?: string | null; pciDeviceId?: string | null }): boolean {
  const gfx = input.gfx?.trim().toLowerCase()
  if (gfx && /^gfx12\d\d$/.test(gfx)) return true
  const id = input.pciDeviceId?.trim().toLowerCase().replace(/^0x/, '')
  return !!id && RDNA4_PCI_DEVICE_IDS.has(id)
}

/**
 * Resolution order:
 *   1. KV `ai.amdBackend`: 'rocm' or 'vulkan' forces it; 'auto', empty or anything else is ignored.
 *   2. RDNA 4 (from the install-time gfx marker or the PCI device id in sysfs) → Vulkan.
 *   3. ROCm, unchanged behaviour for every other AMD card.
 */
export function pickAmdBackend(input: {
  manual: unknown
  gfx?: string | null
  pciDeviceIds?: string[]
}): AmdBackendResolution {
  const manual = typeof input.manual === 'string' ? input.manual.trim().toLowerCase() : ''
  if (manual === 'rocm' || manual === 'vulkan') return { backend: manual, source: 'kv' }
  const rdna4 =
    isRdna4({ gfx: input.gfx }) ||
    (input.pciDeviceIds ?? []).some((id) => isRdna4({ pciDeviceId: id }))
  return rdna4 ? { backend: 'vulkan', source: 'rdna4' } : { backend: 'rocm', source: 'default' }
}

/** Container env a backend needs on top of the common Ollama env. */
export function amdBackendEnv(backend: AmdBackend): string[] {
  return backend === 'vulkan' ? ['OLLAMA_VULKAN=1'] : []
}

/** Env entries that belong to one backend and must not survive a switch to the other. */
export function stripAmdBackendEnv(env: string[]): string[] {
  return env.filter(
    (e) =>
      !e.startsWith('HSA_OVERRIDE_GFX_VERSION=') &&
      !e.startsWith('OLLAMA_IGPU_ENABLE=') &&
      !e.startsWith('OLLAMA_VULKAN=')
  )
}
