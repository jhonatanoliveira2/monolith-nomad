import type { DownloadPreferences } from './download_preferences.js'

/**
 * Ordering of download sources (mirrors) for one file.
 *
 * Rule: real measurements first, geography only as a tie-breaker for what was not measured. A mirror in the
 * same country is not assumed to be fast — routes and peering often make a farther mirror quicker (the Kiwix
 * metalink for a Brazilian client lists no Brazilian or South American mirror at all; MirrorBrain sends BR
 * clients to North America first).
 *
 *   1. measured and healthy mirrors, by score (throughput, penalised by latency and by recent failures)
 *   2. not measured yet: same country, then same region, then the rest; MirrorBrain priority inside a tier
 *   3. mirrors whose last measurement or transfer failed
 *   4. the origin URL (download.kiwix.org redirects to a mirror by itself) is always kept as last resort
 */
export type SourceKind = 'origin' | 'mirror'

export type DownloadSource = {
  url: string
  host: string
  kind: SourceKind
  location: string | null
  priority: number | null
}

export type HostStats = {
  /** exponentially weighted average, bytes/second */
  throughputBps: number
  /** time to first byte, ms (weighted average) */
  ttfbMs: number
  successes: number
  failures: number
  /** consecutive failures since the last success */
  recentFailures: number
  measuredAt: number
}

/** ISO 3166-1 alpha-2 -> continent (MirrorBrain codes), for the countries that host Kiwix-style mirrors. */
const COUNTRY_REGION: Record<string, string> = {
  ar: 'sa',
  bo: 'sa',
  br: 'sa',
  cl: 'sa',
  co: 'sa',
  ec: 'sa',
  gf: 'sa',
  gy: 'sa',
  pe: 'sa',
  py: 'sa',
  sr: 'sa',
  uy: 'sa',
  ve: 'sa',
  fk: 'sa',
  us: 'na',
  ca: 'na',
  mx: 'na',
  cr: 'na',
  pa: 'na',
  de: 'eu',
  fr: 'eu',
  nl: 'eu',
  dk: 'eu',
  se: 'eu',
  no: 'eu',
  fi: 'eu',
  gb: 'eu',
  uk: 'eu',
  ie: 'eu',
  es: 'eu',
  pt: 'eu',
  it: 'eu',
  ch: 'eu',
  at: 'eu',
  be: 'eu',
  lu: 'eu',
  pl: 'eu',
  cz: 'eu',
  sk: 'eu',
  hu: 'eu',
  ro: 'eu',
  bg: 'eu',
  gr: 'eu',
  md: 'eu',
  ua: 'eu',
  lt: 'eu',
  lv: 'eu',
  ee: 'eu',
  is: 'eu',
  jp: 'as',
  kr: 'as',
  cn: 'as',
  tw: 'as',
  hk: 'as',
  sg: 'as',
  in: 'as',
  id: 'as',
  th: 'as',
  vn: 'as',
  au: 'oc',
  nz: 'oc',
  za: 'af',
  ke: 'af',
  ng: 'af',
  eg: 'af',
}

export function regionOf(country: string | null): string | null {
  if (!country) return null
  return COUNTRY_REGION[country] ?? null
}

/** 0 = same country, 1 = same region, 2 = elsewhere / unknown */
export function locationTier(
  location: string | null,
  prefs: Pick<DownloadPreferences, 'country' | 'region'>
): number {
  if (!location) return 2
  if (location === prefs.country) return 0
  if (regionOf(location) === prefs.region) return 1
  return 2
}

/**
 * Higher is better. Throughput dominates; every 100 ms of TTFB costs 5 % and each recent failure halves the
 * score, so a mirror that just failed has to be clearly faster to be tried first again.
 */
export function scoreHost(stats: HostStats): number {
  const latencyFactor = 1 / (1 + Math.max(0, stats.ttfbMs) / 2000)
  const failureFactor = Math.pow(0.5, Math.max(0, stats.recentFailures))
  return stats.throughputBps * latencyFactor * failureFactor
}

export function isFresh(
  stats: HostStats | undefined,
  ttlMs: number,
  now: number
): stats is HostStats {
  return !!stats && now - stats.measuredAt <= ttlMs
}

export function rankSources(
  sources: DownloadSource[],
  stats: Map<string, HostStats>,
  prefs: Pick<DownloadPreferences, 'country' | 'region' | 'benchmarkTtlMs'>,
  now: number = Date.now()
): DownloadSource[] {
  const origins = sources.filter((s) => s.kind === 'origin')
  const mirrors = sources.filter((s) => s.kind === 'mirror')

  const measured: { s: DownloadSource; score: number }[] = []
  const unmeasured: DownloadSource[] = []
  const failing: DownloadSource[] = []

  for (const s of mirrors) {
    const st = stats.get(s.host)
    if (!isFresh(st, prefs.benchmarkTtlMs, now)) {
      unmeasured.push(s)
    } else if (st.recentFailures > 0 && st.throughputBps <= 0) {
      failing.push(s)
    } else {
      measured.push({ s, score: scoreHost(st) })
    }
  }

  measured.sort((a, b) => b.score - a.score)
  const byGeo = (a: DownloadSource, b: DownloadSource) =>
    locationTier(a.location, prefs) - locationTier(b.location, prefs) ||
    (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER)
  unmeasured.sort(byGeo)
  failing.sort(byGeo)

  return [...measured.map((m) => m.s), ...unmeasured, ...failing, ...origins]
}

/** Exponentially weighted update of a host's statistics with one new observation. */
export function updateHostStats(
  previous: HostStats | undefined,
  observation: { ok: true; throughputBps: number; ttfbMs: number } | { ok: false },
  now: number = Date.now(),
  weight = 0.5
): HostStats {
  const base: HostStats = previous ?? {
    throughputBps: 0,
    ttfbMs: 0,
    successes: 0,
    failures: 0,
    recentFailures: 0,
    measuredAt: now,
  }
  if (!observation.ok) {
    return {
      ...base,
      failures: base.failures + 1,
      recentFailures: base.recentFailures + 1,
      measuredAt: now,
    }
  }
  const first = base.successes === 0
  return {
    throughputBps: first
      ? observation.throughputBps
      : base.throughputBps * (1 - weight) + observation.throughputBps * weight,
    ttfbMs: first ? observation.ttfbMs : base.ttfbMs * (1 - weight) + observation.ttfbMs * weight,
    successes: base.successes + 1,
    failures: base.failures,
    recentFailures: 0,
    measuredAt: now,
  }
}

/**
 * Per-host connection limits published by the operators. aria2c's --max-connection-per-server applies to
 * every server of the download, so the lowest limit among the chosen hosts wins.
 * - dumps.wikimedia.org (where download.kiwix.org sends Wikimedia ZIMs): "rate limited and capped at
 *   3 connections per-IP" (https://dumps.wikimedia.org/, read 20/11/2026), and clients that evade the limit
 *   may be blocked. The cap is per IP while the download queue runs up to 3 jobs at once, so each download
 *   uses a single connection there (3 jobs x 1 = 3).
 */
export const HOST_CONNECTION_LIMITS: Record<string, number> = {
  'dumps.wikimedia.org': 1,
  // MirrorBrain: redirects each request to a mirror of its choice, dumps.wikimedia.org included, so whatever
  // reaches it may end up on a host with a published limit (see selectAria2Sources)
  'download.kiwix.org': 1,
  // the MirrorBrain host download.kiwix.org redirects to (and the Kiwix catalog links to directly)
  'lb.download.kiwix.org': 1,
}

/**
 * The subset of ranked sources handed to aria2c. aria2c spreads segments over every URI it gets, so a slow
 * mirror holds back the end of the download: measured inside the production image (20/11/2026, 67 MiB ZIM
 * from São Paulo), 6 URIs including two mirrors below 1 MiB/s gave 4.8 MiB/s, while the best mirror alone
 * gave 20 MiB/s. Keep only measured mirrors with at least `minShare` of the best one's score; the origin
 * (download.kiwix.org redirects to an arbitrary mirror) is only used when no mirror was measured as healthy.
 */
export function selectAria2Sources(
  ranked: DownloadSource[],
  stats: Map<string, HostStats>,
  ttlMs: number,
  now: number = Date.now(),
  minShare = 0.5
): DownloadSource[] {
  const healthy = ranked.filter((s) => {
    if (s.kind !== 'mirror') return false
    const st = stats.get(s.host)
    return isFresh(st, ttlMs, now) && st.recentFailures === 0 && st.throughputBps > 0
  })
  if (healthy.length === 0) {
    // Nothing measured: the listed mirrors, but not the origin when there are any. download.kiwix.org
    // redirects to an arbitrary mirror (dumps.wikimedia.org included), so its per-host limits could not be
    // applied; it stays the native engine's last resort.
    const mirrors = ranked.filter((s) => s.kind === 'mirror')
    return mirrors.length > 0 ? mirrors : ranked
  }
  const best = Math.max(...healthy.map((s) => scoreHost(stats.get(s.host)!)))
  return healthy.filter((s) => scoreHost(stats.get(s.host)!) >= best * minShare)
}

export function connectionsPerServer(hosts: string[], configured: number): number {
  let limit = configured
  for (const h of hosts) {
    const l = HOST_CONNECTION_LIMITS[h]
    if (l !== undefined) limit = Math.min(limit, l)
  }
  return Math.max(1, limit)
}

/** In-process statistics shared by every download in this worker (survives across jobs, not restarts). */
export const hostStatsRegistry: Map<string, HostStats> = new Map()
