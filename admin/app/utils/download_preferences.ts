/**
 * Download engine and mirror preferences.
 *
 * Read from environment variables (all optional, see admin/.env.example) so the defaults can be changed per
 * install without a code change. The defaults target an install in São Paulo, Brazil: country `br`, region
 * `sa` (South America). Location only orders mirrors that were not measured yet — a measured mirror is
 * always ranked by its real performance (see mirror_selection.ts).
 */
export type DownloadEngine = 'auto' | 'aria2' | 'native'

export type DownloadPreferences = {
  /** auto: aria2c when available, native fallback. aria2: same, but warn when aria2c is missing. native: axios only. */
  engine: DownloadEngine
  /** ISO 3166-1 alpha-2, lower case */
  country: string
  /** continent code as used by MirrorBrain: af, an, as, eu, na, oc, sa */
  region: string
  /** Fetch `<url>.meta4` from download.kiwix.org for the official mirror list and the SHA-256. */
  useMetalink: boolean
  /** Measure mirrors (small ranged GET) before choosing. */
  benchmark: boolean
  benchmarkSampleBytes: number
  benchmarkTimeoutMs: number
  /** Reuse a measurement for this long before probing the mirror again. */
  benchmarkTtlMs: number
  /** At most this many mirrors are probed / handed to aria2c for one file. */
  maxMirrors: number
  aria2Path: string
  /** aria2c --split: segments per file (spread over the mirrors). */
  aria2Split: number
  /** aria2c --max-connection-per-server; lowered further for hosts with a published limit. */
  maxConnectionsPerServer: number
}

export const DEFAULT_DOWNLOAD_PREFERENCES: DownloadPreferences = {
  engine: 'auto',
  country: 'br',
  region: 'sa',
  useMetalink: true,
  benchmark: true,
  benchmarkSampleBytes: 2 * 1024 * 1024,
  // a mirror that has not answered 2 MiB in 5 s is not one to pick; 10 s cost ~13 s per file in practice
  benchmarkTimeoutMs: 5_000,
  benchmarkTtlMs: 6 * 60 * 60 * 1000,
  maxMirrors: 5,
  aria2Path: 'aria2c',
  aria2Split: 8,
  maxConnectionsPerServer: 4,
}

const REGIONS = new Set(['af', 'an', 'as', 'eu', 'na', 'oc', 'sa'])

function bool(value: string | undefined, fallback: boolean): boolean {
  const v = (value ?? '').trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  // empty or unrecognised (a typo such as "ture"): keep the default instead of silently turning it off
  return fallback
}

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

export function preferencesFromEnv(
  env: Record<string, string | undefined> = process.env
): DownloadPreferences {
  const d = DEFAULT_DOWNLOAD_PREFERENCES
  const engine = (env.DOWNLOAD_ENGINE || '').trim().toLowerCase()
  const country = (env.DOWNLOAD_LOCATION_COUNTRY || '').trim().toLowerCase()
  const region = (env.DOWNLOAD_LOCATION_REGION || '').trim().toLowerCase()
  return {
    engine: engine === 'aria2' || engine === 'native' || engine === 'auto' ? engine : d.engine,
    country: /^[a-z]{2}$/.test(country) ? country : d.country,
    region: REGIONS.has(region) ? region : d.region,
    useMetalink: bool(env.DOWNLOAD_USE_METALINK, d.useMetalink),
    benchmark: bool(env.DOWNLOAD_MIRROR_BENCHMARK, d.benchmark),
    benchmarkSampleBytes: int(
      env.DOWNLOAD_BENCHMARK_SAMPLE_BYTES,
      d.benchmarkSampleBytes,
      64 * 1024,
      16 * 1024 * 1024
    ),
    benchmarkTimeoutMs: d.benchmarkTimeoutMs,
    benchmarkTtlMs: d.benchmarkTtlMs,
    maxMirrors: int(env.DOWNLOAD_MAX_MIRRORS, d.maxMirrors, 1, 10),
    aria2Path: (env.DOWNLOAD_ARIA2_PATH || '').trim() || d.aria2Path,
    aria2Split: int(env.DOWNLOAD_ARIA2_SPLIT, d.aria2Split, 1, 16),
    maxConnectionsPerServer: int(
      env.DOWNLOAD_MAX_CONNECTIONS_PER_SERVER,
      d.maxConnectionsPerServer,
      1,
      16
    ),
  }
}
