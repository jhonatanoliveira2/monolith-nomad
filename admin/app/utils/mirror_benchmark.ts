import { parseContentRange } from './download_integrity.js'
import type { DownloadSource, HostStats } from './mirror_selection.js'
import { updateHostStats } from './mirror_selection.js'

/**
 * Measures download sources with one small ranged GET each (default 2 MiB, at most 3 probes at a time, and
 * each host re-probed only after the TTL): time to first byte and throughput of the sample.
 *
 * A probe only counts as a success when the mirror answers 206 with a Content-Range whose total equals the
 * expected file size — a mirror that ignores Range cannot resume, and one with a different size is serving
 * an older or newer build of the file. Nothing here is estimated: every number comes from a real transfer.
 */
export type ProbeResult =
  | { host: string; url: string; ok: true; ttfbMs: number; throughputBps: number; bytes: number }
  | { host: string; url: string; ok: false; reason: string }

export type ProbeOptions = {
  sampleBytes: number
  timeoutMs: number
  expectedSize: number | null
  headers?: Record<string, string>
  signal?: AbortSignal
}

type FetchFn = typeof fetch

export async function probeSource(
  source: DownloadSource,
  opts: ProbeOptions,
  fetchFn: FetchFn = fetch,
  now: () => number = () => performance.now()
): Promise<ProbeResult> {
  const { host, url } = source
  const timeout = AbortSignal.timeout(opts.timeoutMs)
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
  const started = now()
  try {
    const res = await fetchFn(url, {
      headers: { ...opts.headers, Range: `bytes=0-${opts.sampleBytes - 1}` },
      // a redirect could point anywhere (the local network included): a probe never follows one
      redirect: 'manual',
      signal,
    })
    const ttfbMs = now() - started
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel().catch(() => {})
      return { host, url, ok: false, reason: `HTTP ${res.status} (redirect not followed)` }
    }
    if (res.status !== 206) {
      await res.body?.cancel().catch(() => {})
      return { host, url, ok: false, reason: `HTTP ${res.status} (no range support)` }
    }
    const range = parseContentRange(res.headers.get('content-range') ?? undefined)
    if (!range || range.start !== 0) {
      await res.body?.cancel().catch(() => {})
      return { host, url, ok: false, reason: 'invalid Content-Range' }
    }
    if (opts.expectedSize !== null && range.total !== null && range.total !== opts.expectedSize) {
      await res.body?.cancel().catch(() => {})
      return {
        host,
        url,
        ok: false,
        reason: `size ${range.total} != expected ${opts.expectedSize}`,
      }
    }
    // Throughput is measured on the second half of the sample only: the first half is dominated by TCP slow
    // start, which made a 2 MiB sample read ~1.6 MiB/s for a mirror that then sustained 20 MiB/s and rank a
    // 0.4 MiB/s mirror first (measured 20/11/2026, docs/downloads.md).
    let bytes = 0
    let halfBytes = 0
    let halfAt = 0
    const reader = res.body?.getReader()
    const bodyStart = now()
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (!halfAt && bytes >= opts.sampleBytes / 2) {
          halfAt = now()
          halfBytes = bytes
        }
        if (bytes >= opts.sampleBytes) {
          await reader.cancel().catch(() => {})
          break
        }
      }
    }
    const end = now()
    if (bytes === 0) return { host, url, ok: false, reason: 'empty body' }
    const tail = bytes - halfBytes
    const throughputBps =
      halfAt && tail > 0 && end > halfAt
        ? tail / ((end - halfAt) / 1000)
        : bytes / Math.max(0.001, (end - bodyStart) / 1000)
    return { host, url, ok: true, ttfbMs, throughputBps, bytes }
  } catch (error: any) {
    const reason = timeout.aborted
      ? `timeout after ${opts.timeoutMs} ms`
      : error?.message || String(error)
    return { host, url, ok: false, reason }
  }
}

/** Probe `sources` (bounded concurrency) and fold the results into `stats`. Returns the raw results. */
export async function benchmarkSources(
  sources: DownloadSource[],
  stats: Map<string, HostStats>,
  opts: ProbeOptions & { concurrency?: number },
  fetchFn: FetchFn = fetch
): Promise<ProbeResult[]> {
  const queue = [...sources]
  const results: ProbeResult[] = []
  const workers = Array.from(
    { length: Math.min(opts.concurrency ?? 3, queue.length) },
    async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        if (opts.signal?.aborted) return
        const r = await probeSource(s, opts, fetchFn)
        // a probe cut short by the caller says nothing about the mirror: do not let it poison the ranking
        if (opts.signal?.aborted) return
        results.push(r)
        stats.set(
          r.host,
          updateHostStats(
            stats.get(r.host),
            r.ok ? { ok: true, throughputBps: r.throughputBps, ttfbMs: r.ttfbMs } : { ok: false }
          )
        )
      }
    }
  )
  await Promise.all(workers)
  return results
}
