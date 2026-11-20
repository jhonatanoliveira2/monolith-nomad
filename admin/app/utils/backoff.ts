/**
 * Exponential backoff with "full jitter" (AWS Architecture Blog, "Exponential Backoff And Jitter").
 *
 * The delay for attempt n (1-based) is a random value in [0, min(maxMs, baseMs * factor^(n-1))]. Jitter
 * keeps many clients that failed at the same moment (a mirror going down for every download queue at
 * once) from retrying in lockstep against the same server.
 */
export type BackoffOptions = {
  baseMs?: number
  maxMs?: number
  factor?: number
  /** 'full' (default): random in [0, cap]. 'none': exactly the cap (deterministic). */
  jitter?: 'full' | 'none'
}

export function computeBackoffDelay(
  attempt: number,
  { baseMs = 2000, maxMs = 60_000, factor = 2, jitter = 'full' }: BackoffOptions = {},
  random: () => number = Math.random
): number {
  const n = Math.max(1, Math.floor(attempt))
  const cap = Math.min(maxMs, baseMs * Math.pow(factor, n - 1))
  if (jitter === 'none') return cap
  return Math.floor(random() * cap)
}

/** Resolves after `ms`, or rejects early when the signal aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Download aborted'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error('Download aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
