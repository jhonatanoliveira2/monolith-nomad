import axios from 'axios'
import path from 'node:path'
import { rename } from 'node:fs/promises'
import type { DoResumableDownloadParams } from '../../types/downloads.js'
import {
  ChecksumMismatchError,
  DisallowedMimeTypeError,
  DOWNLOAD_HEADERS,
  doResumableDownload,
  GatedContentAuthError,
  getFreeBytesAt,
  InsufficientDiskSpaceError,
  preflightDownload,
} from './downloads.js'
import {
  DOWNLOAD_FREE_SPACE_HEADROOM_BYTES,
  formatGiB,
  hasRoomForDownload,
} from './download_integrity.js'
import { deleteFileIfExists, ensureDirectoryExists, getFileStatsIfExists } from './fs.js'
import { getLogger, type DownloadLogger } from './lazy_logger.js'
import { startConnectGuard } from './connect_guard.js'
import {
  assertSafeMirrorRedirect,
  filterPublicMirrors,
  proxyFromEnv,
  safeLookup,
  systemLookup,
  type LookupFn,
} from './host_safety.js'
import { parseMetalink } from './metalink.js'
import { preferencesFromEnv, type DownloadPreferences } from './download_preferences.js'
import {
  connectionsPerServer,
  hostStatsRegistry,
  isFresh,
  rankSources,
  selectAria2Sources,
  updateHostStats,
  type DownloadSource,
  type HostStats,
} from './mirror_selection.js'
import { benchmarkSources } from './mirror_benchmark.js'
import { aria2Version, Aria2Error, ARIA2_EXIT, runAria2 } from './aria2.js'
import { computeBackoffDelay, sleep } from './backoff.js'

/**
 * Smart download: the entry point the download queue uses for every HTTP file (ZIM, maps, packs...).
 *
 *   1. sources   — for download.kiwix.org, the official mirror list and SHA-256 from `<url>.meta4`
 *                  (MirrorBrain); any other URL is a single source.
 *   2. ranking   — mirrors are measured (small ranged GET) and ordered by real performance; location only
 *                  breaks ties among mirrors not measured yet (mirror_selection.ts). Measurements and real
 *                  transfer speeds are remembered for the life of the worker.
 *   3. aria2c    — when available: segmented download spread over the best mirrors, SHA-256 checked by aria2c.
 *   4. native    — fallback (or `DOWNLOAD_ENGINE=native`): the resumable axios downloader, one source at a
 *                  time in ranked order, resuming the same .tmp from the next mirror, with exponential
 *                  backoff (full jitter) between sources.
 *
 * Invariants kept from the original downloader: the file is staged as `<file>.tmp` and renamed into place
 * only when complete and verified; `onComplete` receives the canonical (original) URL, never a mirror's, so
 * InstalledResource rows and job ids do not depend on which mirror served the bytes; request headers (e.g. a
 * Creator Pack's Authorization) are only ever sent to the original host.
 */
export type SmartDownloadDeps = {
  resolveSources: typeof resolveSources
  fetchText: (url: string, timeoutMs: number, signal?: AbortSignal) => Promise<string | null>
  fetchFn: typeof fetch
  aria2Version: typeof aria2Version
  runAria2: typeof runAria2
  nativeDownload: typeof doResumableDownload
  preflight: typeof preflightDownload
  stats: Map<string, HostStats>
  /**
   * DNS used to vet mirrors (resolveSources) and, at connect time, every native connection to a mirror,
   * redirects included (host_safety.safeLookup). null disables both (tests whose "mirrors" are local servers).
   */
  mirrorLookup: LookupFn | null
  /** proxy configured in the environment (host_safety.proxyFromEnv): connect-time checks are skipped behind it */
  envProxy: () => string | null
  now: () => number
  sleep: typeof sleep
  random: () => number
}

export type SmartDownloadParams = DoResumableDownloadParams & {
  preferences?: DownloadPreferences
  deps?: Partial<SmartDownloadDeps>
}

/** Hosts whose metalink (and therefore mirror list and SHA-256) we trust. */
// lb.download.kiwix.org is the same MirrorBrain: download.kiwix.org now answers 301 to it, and the Kiwix
// OPDS catalog hands out lb.* URLs, so catalog-resolved downloads would otherwise skip the SHA-256 check.
export const METALINK_HOSTS = new Set(['download.kiwix.org', 'lb.download.kiwix.org'])

async function defaultFetchText(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      headers: DOWNLOAD_HEADERS,
      timeout: timeoutMs,
      signal,
      responseType: 'text',
      maxContentLength: 2 * 1024 * 1024,
      validateStatus: (s) => s === 200,
    })
    return typeof res.data === 'string' ? res.data : null
  } catch {
    return null
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export type ResolvedSources = {
  sources: DownloadSource[]
  sha256: string | null
  size: number | null
  viaMetalink: boolean
}

export async function resolveSources(
  url: string,
  prefs: Pick<DownloadPreferences, 'useMetalink'>,
  fetchText: SmartDownloadDeps['fetchText'],
  signal?: AbortSignal,
  /** DNS for the mirror check (host_safety.filterPublicMirrors); null skips it (tests with local servers) */
  lookup: LookupFn | null = systemLookup
): Promise<ResolvedSources> {
  const origin: DownloadSource = {
    url,
    host: hostOf(url),
    kind: 'origin',
    location: null,
    priority: null,
  }
  const single: ResolvedSources = {
    sources: [origin],
    sha256: null,
    size: null,
    viaMetalink: false,
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return single
  }
  if (!prefs.useMetalink || parsed.protocol !== 'https:' || !METALINK_HOSTS.has(parsed.hostname))
    return single
  if (!parsed.pathname.endsWith('.zim')) return single

  const xml = await fetchText(`${parsed.origin}${parsed.pathname}.meta4`, 15_000, signal)
  const ml = xml ? parseMetalink(xml) : null
  // the metalink must describe exactly this file
  if (!ml || ml.name !== path.posix.basename(parsed.pathname)) return single
  // mirrors are third-party hosts: without the published SHA-256 nothing could verify what they serve
  if (!ml.sha256) return single

  const mirrors: DownloadSource[] = ml.urls
    .filter((u) => u.url !== url && path.posix.basename(new URL(u.url).pathname) === ml.name)
    .map((u) => ({
      url: u.url,
      host: hostOf(u.url),
      kind: 'mirror',
      location: u.location,
      priority: u.priority,
    }))
  // every mirror must resolve only to public addresses (a tampered list or DNS must not aim at the LAN)
  const sources = lookup
    ? await filterPublicMirrors([...mirrors, origin], lookup)
    : [...mirrors, origin]
  return { sources, sha256: ml.sha256, size: ml.size, viaMetalink: true }
}

/** Size in bytes of a file, 0 when it does not exist. */
async function sizeOf(file: string): Promise<number> {
  const stats = await getFileStatsIfExists(file)
  return Number(stats?.size ?? 0)
}

function mib(bytesPerSecond: number): string {
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MiB/s`
}

/**
 * aria2c failed after writing part of the file. The segmented partial (.tmp + .tmp.aria2) is kept and the error
 * goes to the queue, whose next attempt resumes it with aria2c; falling back to the native engine here would
 * have to throw the progress away (it cannot resume a file with holes).
 */
export class Aria2PartialKeptError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'Aria2PartialKeptError'
  }
}

function isAbort(error: any): boolean {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'ABORT_ERR' ||
    error?.code === 'ERR_CANCELED' ||
    error?.message === 'Download aborted' ||
    error?.message === 'canceled'
  )
}

/** Errors that no other source or engine can fix: give up immediately (the queue decides what happens next). */
function isFatal(error: any): boolean {
  return (
    isAbort(error) ||
    error instanceof GatedContentAuthError ||
    error instanceof InsufficientDiskSpaceError
  )
}

export async function smartDownload(params: SmartDownloadParams): Promise<string> {
  const prefs = params.preferences ?? preferencesFromEnv()
  const deps: SmartDownloadDeps = {
    resolveSources,
    fetchText: defaultFetchText,
    fetchFn: fetch,
    aria2Version,
    runAria2,
    nativeDownload: doResumableDownload,
    preflight: preflightDownload,
    stats: hostStatsRegistry,
    mirrorLookup: systemLookup,
    envProxy: () => proxyFromEnv(),
    now: () => Date.now(),
    sleep,
    random: Math.random,
    ...params.deps,
  }
  const logger = await getLogger()
  const { url, filepath, signal } = params
  const name = path.basename(filepath)
  const timeout = params.timeout ?? 30000

  // 1. sources
  const resolved = await deps.resolveSources(url, prefs, deps.fetchText, signal, deps.mirrorLookup)
  const expectedSha256 = (params.expectedSha256 || resolved.sha256 || null)?.toLowerCase() ?? null
  if (
    params.expectedSha256 &&
    resolved.sha256 &&
    params.expectedSha256.toLowerCase() !== resolved.sha256
  ) {
    logger.warn(
      `[SmartDownload] ${name}: caller SHA-256 differs from the metalink's; using the caller's`
    )
  }
  logger.info(
    `[SmartDownload] ${name}: ${resolved.sources.length} source(s)` +
      (resolved.viaMetalink ? ` via metalink` : '') +
      (expectedSha256 ? `, sha256 ${expectedSha256.slice(0, 12)}…` : ', no published checksum')
  )

  // 2. ranking (+ benchmark of mirrors not measured recently)
  let ranked = rankSources(resolved.sources, deps.stats, prefs, deps.now())
  const mirrors = ranked.filter((s) => s.kind === 'mirror')
  if (prefs.benchmark && mirrors.length > 1) {
    const toProbe = mirrors
      .slice(0, prefs.maxMirrors + 2)
      .filter((s) => !isFresh(deps.stats.get(s.host), prefs.benchmarkTtlMs, deps.now()))
    if (toProbe.length > 0) {
      const results = await benchmarkSources(
        toProbe,
        deps.stats,
        {
          sampleBytes: prefs.benchmarkSampleBytes,
          timeoutMs: prefs.benchmarkTimeoutMs,
          expectedSize: resolved.size,
          headers: DOWNLOAD_HEADERS,
          signal,
          // one small request per host, so all hosts can be probed at once: a mirror that times out no longer
          // delays the others (with 3 at a time, two 5 s timeouts added ~10 s per file)
          concurrency: toProbe.length,
        },
        deps.fetchFn
      )
      for (const r of results) {
        logger.info(
          r.ok
            ? `[SmartDownload] probe ${r.host}: ttfb ${Math.round(r.ttfbMs)} ms, ${mib(r.throughputBps)} (${r.bytes} B sample)`
            : `[SmartDownload] probe ${r.host}: failed (${r.reason})`
        )
      }
      ranked = rankSources(resolved.sources, deps.stats, prefs, deps.now())
    }
  }
  // keep the best N mirrors, the origin always last
  const chosen = [
    ...ranked.filter((s) => s.kind === 'mirror').slice(0, prefs.maxMirrors),
    ...ranked.filter((s) => s.kind === 'origin'),
  ]
  logger.info(
    `[SmartDownload] ${name}: order ${chosen.map((s) => s.host + (s.location ? `(${s.location})` : '')).join(' > ')}`
  )

  const originHost = hostOf(url)
  const headersFor = (s: DownloadSource) =>
    s.host === originHost ? params.requestHeaders : undefined

  // 3. aria2c
  if (prefs.engine !== 'native') {
    const version = await deps.aria2Version(prefs.aria2Path)
    if (!version) {
      if (prefs.engine === 'aria2')
        logger.warn(
          `[SmartDownload] aria2c not found at "${prefs.aria2Path}"; using the native downloader`
        )
    } else {
      try {
        const done = await downloadWithAria2(
          params,
          prefs,
          deps,
          logger,
          chosen,
          expectedSha256,
          resolved.size,
          timeout,
          version
        )
        if (done) return done
      } catch (error: any) {
        if (isFatal(error) || error instanceof Aria2PartialKeptError) throw error
        logger.warn(
          `[SmartDownload] ${name}: aria2c failed (${error?.message}); falling back to the native downloader`
        )
      }
    }
  }

  // 4. native, source by source
  // A .tmp with an aria2c control file was written in segments and may have holes: the native engine resumes by
  // size and would build a corrupt file from it (silently so when there is no checksum). Start that one over.
  const strayControl = filepath + '.tmp.aria2'
  if (await getFileStatsIfExists(strayControl)) {
    logger.warn(
      `[SmartDownload] ${name}: discarding a segmented aria2c partial before the native download`
    )
    await deleteFileIfExists(filepath + '.tmp')
    await deleteFileIfExists(strayControl)
  }
  let lastError: any = null
  for (let i = 0; i < chosen.length; i++) {
    const source = chosen[i]
    const before = await sizeOf(filepath + '.tmp')
    const started = deps.now()
    try {
      const result = await deps.nativeDownload({
        ...params,
        url: source.url,
        timeout,
        // only the first attempt may discard a partial file; later sources resume it
        forceNew: i === 0 ? params.forceNew : false,
        requestHeaders: headersFor(source),
        expectedSha256,
        onComplete: undefined,
        // mirrors (third-party hosts) may only reach public addresses, redirects included
        ...(source.kind === 'mirror' &&
          deps.mirrorLookup &&
          // behind a proxy the connection goes to the proxy, whose address is not the mirror's
          !deps.envProxy() && {
            // node's LookupFunction is what axios hands to http.request; its own type is narrower
            lookup: safeLookup(deps.mirrorLookup) as DoResumableDownloadParams['lookup'],
            beforeRedirect: assertSafeMirrorRedirect,
          }),
      })
      const after = await sizeOf(filepath)
      const seconds = Math.max(0.001, (deps.now() - started) / 1000)
      const transferred = Math.max(0, after - before)
      if (transferred > 1024 * 1024) {
        deps.stats.set(
          source.host,
          updateHostStats(
            deps.stats.get(source.host),
            {
              ok: true,
              throughputBps: transferred / seconds,
              ttfbMs: deps.stats.get(source.host)?.ttfbMs ?? 0,
            },
            deps.now()
          )
        )
      }
      logger.info(
        `[SmartDownload] ${name}: done via native from ${source.host} (${transferred} B in ${seconds.toFixed(1)} s, ${mib(transferred / seconds)})`
      )
      if (params.onComplete) await params.onComplete(url, result)
      return result
    } catch (error: any) {
      lastError = error
      // credentials are only sent to the original host: a 401/403 from a mirror says nothing about them
      const gatedMirror = error instanceof GatedContentAuthError && source.host !== originHost
      if (isFatal(error) && !gatedMirror) throw error
      deps.stats.set(
        source.host,
        updateHostStats(deps.stats.get(source.host), { ok: false }, deps.now())
      )
      // a wrong MIME type from the only/original source is the caller's problem, from a mirror it is the mirror's
      if (
        error instanceof DisallowedMimeTypeError &&
        source.kind === 'origin' &&
        chosen.length === 1
      )
        throw error
      logger.warn(
        `[SmartDownload] ${name}: attempt ${i + 1}/${chosen.length} from ${source.host} failed: ${error?.message}` +
          (error instanceof ChecksumMismatchError ? ' (partial file discarded)' : '')
      )
      if (i < chosen.length - 1) {
        await deps.sleep(
          computeBackoffDelay(i + 1, { baseMs: 2000, maxMs: 30_000 }, deps.random),
          signal
        )
      }
    }
  }
  throw lastError ?? new Error(`Download failed: ${url}`)
}

async function downloadWithAria2(
  params: SmartDownloadParams,
  prefs: DownloadPreferences,
  deps: SmartDownloadDeps,
  logger: DownloadLogger,
  chosen: DownloadSource[],
  expectedSha256: string | null,
  metalinkSize: number | null,
  timeout: number,
  version: string
): Promise<string | null> {
  const { url, filepath, signal, onProgress } = params
  const name = path.basename(filepath)
  const dir = path.dirname(filepath)
  const tempPath = filepath + '.tmp'
  const controlPath = tempPath + '.aria2'
  await ensureDirectoryExists(dir)

  // Requests with credentials (Authorization for gated Creator Packs) never go through aria2c: it re-sends custom
  // headers to wherever a redirect points, while the native engine (follow-redirects) drops Authorization when the
  // redirect leaves the original host.
  if (params.requestHeaders && Object.keys(params.requestHeaders).length > 0) {
    logger.info(`[SmartDownload] ${name}: request carries credentials; using the native downloader`)
    return null
  }
  const sources = selectAria2Sources(chosen, deps.stats, prefs.benchmarkTtlMs, deps.now())
  if (sources.length === 0) return null

  let pre: Awaited<ReturnType<SmartDownloadDeps['preflight']>>
  try {
    pre = await deps.preflight({
      url,
      headers: { ...DOWNLOAD_HEADERS, ...params.requestHeaders },
      timeout,
      signal,
      allowedMimeTypes: params.allowedMimeTypes,
    })
  } catch (error: any) {
    // A transient HEAD failure must not cost the progress of a segmented partial left by an earlier attempt:
    // the native fallback would have to discard it. Keep it and let the queue retry with aria2c.
    if (!isFatal(error) && !(error instanceof DisallowedMimeTypeError)) {
      const written = await sizeOf(tempPath)
      if (written > 0 && (await getFileStatsIfExists(controlPath))) {
        throw new Aria2PartialKeptError(
          `HEAD for ${name} failed (${error?.message}); the ${written}-byte aria2c partial is kept for the next attempt`,
          { cause: error }
        )
      }
    }
    throw error
  }
  const totalBytes = pre.totalBytes || metalinkSize || 0
  if (metalinkSize && pre.totalBytes && metalinkSize !== pre.totalBytes) {
    logger.warn(
      `[SmartDownload] ${name}: metalink size ${metalinkSize} != HEAD size ${pre.totalBytes}`
    )
  }

  if (params.forceNew) {
    await deleteFileIfExists(tempPath)
    await deleteFileIfExists(controlPath)
  } else {
    const existing = await getFileStatsIfExists(filepath)
    if (existing && totalBytes > 0 && Number(existing.size) === totalBytes) return filepath
  }

  // a control file without its .tmp (e.g. the .tmp was deleted on cancel) would confuse aria2c's resume
  if ((await getFileStatsIfExists(controlPath)) && !(await getFileStatsIfExists(tempPath))) {
    await deleteFileIfExists(controlPath)
  }

  // a .tmp from the native downloader without range support on the server cannot be resumed
  const partial = await sizeOf(tempPath)
  if (partial > 0 && (!pre.supportsRangeRequests || (totalBytes > 0 && partial > totalBytes))) {
    await deleteFileIfExists(tempPath)
    await deleteFileIfExists(controlPath)
  }

  if (totalBytes > 0) {
    const remaining = totalBytes - (await sizeOf(tempPath))
    const free = await getFreeBytesAt(dir)
    if (free !== null && !hasRoomForDownload(remaining, free)) {
      throw new InsufficientDiskSpaceError(
        `Not enough free disk space for ${name}: needs ${formatGiB(remaining)} ` +
          `plus ${formatGiB(DOWNLOAD_FREE_SPACE_HEADROOM_BYTES)} headroom, only ${formatGiB(free)} free.`
      )
    }
  }

  const hosts = [...new Set(sources.map((s) => s.host))]
  const perServer = connectionsPerServer(hosts, prefs.maxConnectionsPerServer)
  logger.info(
    `[SmartDownload] ${name}: aria2c ${version}, ${sources.length} URI(s), split ${Math.min(prefs.aria2Split, perServer)}, ${perServer} conn/server, inorder`
  )
  const started = deps.now()
  // what an earlier attempt left: a failure is only worth retrying with aria2c if this run added to it
  const writtenBefore = await sizeOf(tempPath)
  let lastProgressAt = 0
  // aria2c cannot vet the addresses it connects to (or the redirects it follows): mirror downloads go through
  // the loopback connect guard, which only tunnels to public https hosts (connect_guard.ts)
  const guard =
    deps.mirrorLookup && !deps.envProxy() && sources.some((s) => s.kind === 'mirror')
      ? await startConnectGuard({ lookup: deps.mirrorLookup })
      : null
  try {
    await deps.runAria2(
      {
        uris: sources.map((s) => s.url),
        dir,
        out: path.basename(tempPath),
        sha256: expectedSha256,
        headers: { 'User-Agent': DOWNLOAD_HEADERS['User-Agent'], ...params.requestHeaders },
        // all connections on the best mirror (see --uri-selector=inorder in aria2.ts)
        split: Math.min(prefs.aria2Split, perServer),
        maxConnectionsPerServer: perServer,
        timeoutSeconds: Math.max(30, Math.round(timeout / 1000)),
        proxy: guard?.url,
      },
      {
        bin: prefs.aria2Path,
        signal,
        onProgress(p) {
          const now = deps.now()
          if (!onProgress || now - lastProgressAt < 500) return
          lastProgressAt = now
          onProgress({
            downloadedBytes: p.downloadedBytes,
            totalBytes: p.totalBytes || totalBytes,
            lastProgressTime: now,
            lastDownloadedBytes: p.downloadedBytes,
            url,
          })
        },
      }
    )
  } catch (error: any) {
    if (isAbort(error)) throw error
    if (error instanceof Aria2Error) {
      if (error.exitCode === ARIA2_EXIT.NOT_ENOUGH_DISK)
        throw new InsufficientDiskSpaceError(error.message)
      if (error.exitCode === ARIA2_EXIT.HTTP_AUTH_FAILED) {
        throw new GatedContentAuthError(
          `The download server rejected this install's credentials (${error.message}).`
        )
      }
    }
    // Wrong bytes: nothing of the partial can be trusted.
    if (error instanceof Aria2Error && error.exitCode === ARIA2_EXIT.CHECKSUM_FAILED) {
      await deleteFileIfExists(tempPath)
      await deleteFileIfExists(controlPath)
      throw error
    }
    // Progress was made in this run: keep the segmented partial for the queue's next attempt (aria2c resumes it
    // from its control file) instead of falling back to the native engine, which would have to start over. A run
    // that added nothing (failing again at the same point) falls back, so the retries cannot loop forever.
    const written = await sizeOf(tempPath)
    if ((await getFileStatsIfExists(controlPath)) && written > writtenBefore) {
      throw new Aria2PartialKeptError(
        `aria2c stopped after writing ${written}${totalBytes ? ` of ${totalBytes}` : ''} bytes (${error?.message}); ` +
          'the partial file is kept and the next attempt resumes it',
        { cause: error }
      )
    }
    // No new progress: clean up and let the native engine try (it cannot resume a segmented file).
    await deleteFileIfExists(tempPath)
    await deleteFileIfExists(controlPath)
    throw error
  } finally {
    await guard?.close()
  }

  const done = await getFileStatsIfExists(tempPath)
  const size = Number(done?.size ?? 0)
  if (totalBytes > 0 && size !== totalBytes) {
    // the bytes aria2c wrote may have holes: the native fallback must not resume them by size
    await deleteFileIfExists(tempPath)
    await deleteFileIfExists(controlPath)
    throw new Error(`aria2c finished but ${name}.tmp has ${size} of ${totalBytes} bytes`)
  }
  await deleteFileIfExists(controlPath)
  await rename(tempPath, filepath)

  const seconds = Math.max(0.001, (deps.now() - started) / 1000)
  logger.info(
    `[SmartDownload] ${name}: done via aria2c (${size} B in ${seconds.toFixed(1)} s, ${mib(size / seconds)})`
  )
  onProgress?.({
    downloadedBytes: size,
    totalBytes: size,
    lastProgressTime: deps.now(),
    lastDownloadedBytes: size,
    url,
  })
  if (params.onComplete) await params.onComplete(url, filepath)
  return filepath
}
