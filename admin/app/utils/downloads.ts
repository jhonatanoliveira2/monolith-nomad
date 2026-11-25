import {
  DoResumableDownloadParams,
  DoResumableDownloadWithRetryParams,
} from '../../types/downloads.js'
import axios from 'axios'
import { Transform } from 'node:stream'
import { deleteFileIfExists, ensureDirectoryExists, getFileStatsIfExists } from './fs.js'
import { createReadStream, createWriteStream } from 'node:fs'
import { rename } from 'node:fs/promises'
import { createHash, type Hash } from 'node:crypto'
import path from 'node:path'
import { getLogger } from './lazy_logger.js'
import { computeBackoffDelay, sleep } from './backoff.js'
import {
  checkDownloadedSize,
  DOWNLOAD_FREE_SPACE_HEADROOM_BYTES,
  formatGiB,
  hasRoomForDownload,
  isMatchingResume,
} from './download_integrity.js'
import { statfs } from 'node:fs/promises'

async function getFreeBytesAt(dir: string): Promise<number | null> {
  try {
    const stats = await statfs(dir)
    return Number(stats.bavail) * Number(stats.bsize)
  } catch {
    return null
  }
}

/**
 * A gated source rejected this install's credentials (401/403).
 *
 * Permanent by nature: whether the entitlement key is baked in is a property of
 * the build, so no amount of retrying changes the answer. Declared here rather
 * than thrown as an UnrecoverableError directly so this module stays free of a
 * BullMQ dependency — RunDownloadJob translates it at the queue boundary.
 */
export class GatedContentAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GatedContentAuthError'
  }
}

/** Not enough free disk space to finish a download (checked before writing any byte). */
export class InsufficientDiskSpaceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsufficientDiskSpaceError'
  }
}

/** The downloaded bytes do not match the SHA-256 published for the file. The partial file is deleted. */
export class ChecksumMismatchError extends Error {
  constructor(
    message: string,
    readonly expected: string,
    readonly actual: string
  ) {
    super(message)
    this.name = 'ChecksumMismatchError'
  }
}

// Some upstream mirrors reject requests with a missing or generic User-Agent.
// Notably, download.kiwix.org routes the large Wikimedia-family ZIMs (Wikipedia,
// Wikiversity, Wikibooks — including the flagship full Wikipedia) to
// dumps.wikimedia.org, which returns HTTP 403 for a default `axios/x` (or empty)
// User-Agent per Wikimedia's UA policy. Identify ourselves descriptively (name,
// version and where the software comes from) so those downloads succeed.
export const DOWNLOAD_USER_AGENT =
  'monolith-nomad/1.0 (+https://github.com/jhonatanoliveira2/monolith-nomad)'
export const DOWNLOAD_HEADERS: Record<string, string> = {
  'User-Agent': DOWNLOAD_USER_AGENT,
}

/** Lower-case hex SHA-256 of a file, streamed (constant memory). */
export async function sha256File(filepath: string, signal?: AbortSignal): Promise<string> {
  const hash = createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filepath, { highWaterMark: 4 * 1024 * 1024 })
    const onAbort = () => stream.destroy(new Error('Download aborted'))
    signal?.addEventListener('abort', onAbort, { once: true })
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort)
      reject(err)
    })
    stream.on('end', () => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    })
  })
  return hash.digest('hex')
}

/** Verify `tempPath` against `expected` (when given); a mismatch deletes the file and throws. */
async function verifyChecksum(
  tempPath: string,
  expected: string | null | undefined,
  computed: string | null,
  signal?: AbortSignal
): Promise<void> {
  if (!expected) return
  const actual = computed ?? (await sha256File(tempPath, signal))
  if (actual !== expected.toLowerCase()) {
    await deleteFileIfExists(tempPath)
    throw new ChecksumMismatchError(
      `SHA-256 mismatch for ${path.basename(tempPath.replace(/\.tmp$/, ''))}: expected ${expected}, got ${actual}`,
      expected,
      actual
    )
  }
}

/** A MIME type outside the caller's allowlist (typically an HTML error page instead of the file). */
export class DisallowedMimeTypeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DisallowedMimeTypeError'
  }
}

export type DownloadPreflight = {
  contentType: string
  totalBytes: number
  supportsRangeRequests: boolean
}

type ProbeOptions = {
  signal?: AbortSignal
  timeout: number
  headers: Record<string, string>
  lookup?: DoResumableDownloadParams['lookup']
  beforeRedirect?: DoResumableDownloadParams['beforeRedirect']
}

function hasCredentials(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((h) => h.toLowerCase() === 'authorization')
}

/**
 * A one-byte GET standing in for HEAD, shaped like a HEAD response: content-length is the full size
 * (from Content-Range on a 206), accept-ranges is "bytes" when the range was honoured. The body is
 * discarded unread. Null when the probe fails too.
 */
export async function rangeProbe(url: string, opts: ProbeOptions) {
  try {
    const res = await axios.get(url, {
      signal: opts.signal,
      timeout: opts.timeout,
      headers: { ...opts.headers, Range: 'bytes=0-0' },
      responseType: 'stream',
      ...(opts.lookup && { lookup: opts.lookup }),
      ...(opts.beforeRedirect && { beforeRedirect: opts.beforeRedirect }),
    })
    res.data?.destroy?.()
    return { headers: probeHeaders(res.status, res.headers as Record<string, unknown>) }
  } catch {
    return null
  }
}

/** HEAD-equivalent headers from a ranged GET's status and headers (pure, unit-tested). */
export function probeHeaders(status: number, headers: Record<string, unknown>) {
  const range = /\/(\d+)\s*$/.exec(String(headers['content-range'] ?? ''))
  const partial = status === 206 && range
  return {
    'content-type': headers['content-type'],
    'content-length': partial ? range[1] : headers['content-length'],
    'accept-ranges': partial ? 'bytes' : headers['accept-ranges'],
  } as Record<string, unknown>
}

/**
 * The error to raise when the probe failed: a 401/403 from a gated source is translated, because the
 * raw axios message ("Request failed with status code 401") reads like our server is broken and the
 * cause is almost always a build without the entitlement key. failedReason is shown verbatim.
 */
function translateHeadError(error: any): Error {
  const status = error?.response?.status
  if (status === 401 || status === 403) {
    return new GatedContentAuthError(
      'This content requires credentials that this install does not have. ' +
        `The download server rejected this install's credentials (HTTP ${status}).`
    )
  }
  return error
}

/**
 * HEAD probe shared by both download engines: size, range support and the MIME allowlist, with a gated
 * source's 401/403 translated to GatedContentAuthError.
 */
export async function preflightDownload({
  url,
  headers,
  timeout,
  signal,
  allowedMimeTypes,
  lookup,
  beforeRedirect,
}: {
  url: string
  headers: Record<string, string>
  timeout: number
  signal?: AbortSignal
  allowedMimeTypes?: string[]
  lookup?: DoResumableDownloadParams['lookup']
  beforeRedirect?: DoResumableDownloadParams['beforeRedirect']
}): Promise<DownloadPreflight> {
  // Get file info with HEAD request first. Gated sources (Creator Packs) require
  // the auth header on the HEAD too, or the probe 401s before the GET is reached.
  let headResponse
  let headError: any = null
  try {
    headResponse = await axios.head(url, {
      signal,
      timeout,
      headers,
      ...(lookup && { lookup }),
      ...(beforeRedirect && { beforeRedirect }),
    })
  } catch (error: any) {
    headError = error
    // Some publishers refuse HEAD but serve GET: gov.br answers 403 to every HEAD
    // (measured 2026-11-24 on the Ministério da Saúde and MMA PDFs) and 206 to a
    // ranged GET. Without credentials in play, ask for the first byte instead.
    const refused = [403, 405, 501].includes(error?.response?.status)
    if (refused && !hasCredentials(headers)) {
      const probe = await rangeProbe(url, { signal, timeout, headers, lookup, beforeRedirect })
      if (probe) headResponse = probe
    }
  }
  if (!headResponse) throw translateHeadError(headError)

  // Some upstream hosts (notably download.kiwix.org for .zim files) don't set a
  // Content-Type header at all. Per RFC 7231 §3.1.1.5, "if no Content-Type is
  // provided" the recipient may treat it as application/octet-stream — which is
  // already in every binary-content allowlist we use (ZIM, PMTILES, base assets).
  // Without this default, the validator below throws `MIME type  is not allowed`
  // and breaks all downloads from kiwix's primary host (#848).
  const contentType = headResponse.headers['content-type']?.toString() || 'application/octet-stream'
  const totalBytes = Number.parseInt(headResponse.headers['content-length']?.toString() || '0', 10)
  const supportsRangeRequests = headResponse.headers['accept-ranges'] === 'bytes'

  // If allowedMimeTypes is provided, check content type
  if (allowedMimeTypes && allowedMimeTypes.length > 0) {
    const isMimeTypeAllowed = allowedMimeTypes.some((mimeType) => contentType.includes(mimeType))
    if (!isMimeTypeAllowed) {
      throw new DisallowedMimeTypeError(`MIME type ${contentType} is not allowed`)
    }
  }

  return { contentType, totalBytes, supportsRangeRequests }
}

export { getFreeBytesAt }

/**
 * Perform a resumable download with progress tracking
 * @param param0 - Download parameters. Leave allowedMimeTypes empty to skip mime type checking.
 * Otherwise, mime types should be in the format "application/pdf", "image/png", etc.
 * @returns Path to the downloaded file
 */
export async function doResumableDownload({
  url,
  filepath,
  timeout = 30000,
  signal,
  onProgress,
  onComplete,
  forceNew = false,
  allowedMimeTypes,
  requestHeaders,
  expectedSha256,
  lookup,
  beforeRedirect,
}: DoResumableDownloadParams): Promise<string> {
  const logger = await getLogger()
  const dirname = path.dirname(filepath)
  await ensureDirectoryExists(dirname)

  // Stage download to a .tmp file so consumers (e.g. Kiwix) never see a partial file
  const tempPath = filepath + '.tmp'

  // Check if partial .tmp file exists for resume
  let startByte = 0
  let appendMode = false

  const existingStats = await getFileStatsIfExists(tempPath)
  if (existingStats && !forceNew) {
    startByte = Number(existingStats.size)
    appendMode = true
  }

  // Merge default headers with any caller-supplied headers (e.g. Creator Packs' Authorization)
  const headers: Record<string, string> = { ...DOWNLOAD_HEADERS, ...requestHeaders }

  const { totalBytes, supportsRangeRequests } = await preflightDownload({
    url,
    headers,
    timeout,
    signal,
    allowedMimeTypes,
    lookup,
    beforeRedirect,
  })

  // If final file already exists at correct size, return early (idempotent)
  const finalFileStats = await getFileStatsIfExists(filepath)
  if (finalFileStats && Number(finalFileStats.size) === totalBytes && totalBytes > 0 && !forceNew) {
    return filepath
  }

  // If .tmp file is already at correct size (complete but never renamed), just rename it
  if (startByte === totalBytes && totalBytes > 0 && !forceNew) {
    await verifyChecksum(tempPath, expectedSha256, null, signal)
    await rename(tempPath, filepath)
    if (onComplete) {
      await onComplete(url, filepath)
    }
    return filepath
  }

  // If server doesn't support range requests and we have a partial .tmp file, delete it
  if (!supportsRangeRequests && startByte > 0) {
    await deleteFileIfExists(tempPath)
    startByte = 0
    appendMode = false
  }

  // A .tmp bigger than the file now on the server cannot be a prefix of it — the
  // publisher replaced the file under the same name (openZIM rolls builds forward,
  // see #1189/#1187). Resuming would ask for a range past the end and get a 416 on
  // every attempt, with nothing deleting the .tmp, so the download could never
  // recover on its own. Discard and start clean.
  if (startByte > totalBytes && totalBytes > 0) {
    logger.warn(
      `[Download] Discarding stale partial for ${filepath}: .tmp is ${startByte}B but the server reports ${totalBytes}B`
    )
    await deleteFileIfExists(tempPath)
    startByte = 0
    appendMode = false
  }

  // Refuse before writing anything when the rest of the file won't fit. Covers manual downloads
  // and unattended content auto-updates alike (a 100 GB Wikipedia update at 3 AM must not fill
  // the volume the database and Redis share). Unknown sizes and unreadable stats are not blocked.
  if (totalBytes > 0) {
    const remainingBytes = totalBytes - (supportsRangeRequests ? startByte : 0)
    const freeBytes = await getFreeBytesAt(dirname)
    if (freeBytes !== null && !hasRoomForDownload(remainingBytes, freeBytes)) {
      throw new InsufficientDiskSpaceError(
        `Not enough free disk space for ${path.basename(filepath)}: needs ${formatGiB(remainingBytes)} ` +
          `plus ${formatGiB(DOWNLOAD_FREE_SPACE_HEADROOM_BYTES)} headroom, only ${formatGiB(freeBytes)} free.`
      )
    }
  }

  // Add Range header if resuming
  if (supportsRangeRequests && startByte > 0) {
    headers.Range = `bytes=${startByte}-`
  }

  const fetchStream = (streamHeaders: Record<string, string>) =>
    axios.get(url, {
      responseType: 'stream',
      headers: streamHeaders,
      signal,
      timeout,
      ...(lookup && { lookup }),
      ...(beforeRedirect && { beforeRedirect }),
    })

  let response = await fetchStream(headers)

  if (response.status !== 200 && response.status !== 206) {
    throw new Error(`Failed to download: HTTP ${response.status}`)
  }

  // If we requested a range but the server returned 200 (ignored the Range header), or a 206 that
  // does not continue our partial file, appending would corrupt the .tmp — delete it and restart.
  if (
    headers.Range &&
    (response.status === 200 ||
      !isMatchingResume(response.headers['content-range']?.toString(), startByte, totalBytes))
  ) {
    if (response.status === 206) {
      logger.warn(
        `[Download] Resume of ${filepath} got Content-Range "${response.headers['content-range']}" for a request from byte ${startByte}; restarting from scratch`
      )
    }
    response.data.destroy()
    await deleteFileIfExists(tempPath)
    startByte = 0
    appendMode = false
    delete headers.Range
    response = await fetchStream(headers)
    if (response.status !== 200 && response.status !== 206) {
      throw new Error(`Failed to download: HTTP ${response.status}`)
    }
  }

  return new Promise((resolve, reject) => {
    let downloadedBytes = startByte
    let lastProgressTime = Date.now()
    let lastDownloadedBytes = startByte
    // A download from byte 0 is hashed on the fly; a resumed one is hashed from disk once complete.
    const streamHash: Hash | null = expectedSha256 && startByte === 0 ? createHash('sha256') : null

    // Stall detection: if no data arrives for 5 minutes, abort the download
    const STALL_TIMEOUT_MS = 5 * 60 * 1000
    let stallTimer: ReturnType<typeof setTimeout> | null = null

    const clearStallTimer = () => {
      if (stallTimer) {
        clearTimeout(stallTimer)
        stallTimer = null
      }
    }

    const resetStallTimer = () => {
      clearStallTimer()
      stallTimer = setTimeout(() => {
        cleanup(new Error('Download stalled - no data received for 5 minutes'))
      }, STALL_TIMEOUT_MS)
    }

    // Progress tracking stream to monitor data flow
    const progressStream = new Transform({
      transform(chunk: Buffer, _: any, callback: Function) {
        downloadedBytes += chunk.length
        streamHash?.update(chunk)
        resetStallTimer()

        // Update progress tracking
        const now = Date.now()
        if (onProgress && now - lastProgressTime >= 500) {
          lastProgressTime = now
          lastDownloadedBytes = downloadedBytes
          onProgress({
            downloadedBytes,
            totalBytes,
            lastProgressTime,
            lastDownloadedBytes,
            url,
          })
        }

        this.push(chunk)
        callback()
      },
    })

    const writeStream = createWriteStream(tempPath, {
      flags: appendMode ? 'a' : 'w',
    })

    const cleanup = (error?: Error) => {
      clearStallTimer()
      progressStream.destroy()
      response.data.destroy()
      writeStream.destroy()
      if (error) {
        reject(error)
      }
    }

    response.data.on('error', cleanup)
    progressStream.on('error', cleanup)
    writeStream.on('error', cleanup)

    signal?.addEventListener('abort', () => {
      cleanup(new Error('Download aborted'))
    })

    writeStream.on('finish', async () => {
      clearStallTimer()
      // A server that closes the connection cleanly before the end leaves a truncated file. Never
      // install it: a short .tmp is kept so the next attempt resumes it, an oversized one is junk.
      const completeness = checkDownloadedSize(downloadedBytes, totalBytes)
      if (completeness !== 'complete') {
        if (completeness === 'oversized') await deleteFileIfExists(tempPath)
        reject(
          new Error(
            `Download incomplete: received ${downloadedBytes} of ${totalBytes} bytes (${completeness})`
          )
        )
        return
      }
      try {
        await verifyChecksum(
          tempPath,
          expectedSha256,
          streamHash ? streamHash.digest('hex') : null,
          signal
        )
      } catch (checksumError) {
        reject(checksumError)
        return
      }
      try {
        // Atomically move the completed .tmp file to the final path
        await rename(tempPath, filepath)
      } catch (renameError) {
        // A parallel job may have completed the same file first — treat as success
        // if the destination already exists at the expected size.
        const existing = await getFileStatsIfExists(filepath)
        if (existing && Number(existing.size) === totalBytes && totalBytes > 0) {
          // fall through to resolve
        } else {
          reject(renameError)
          return
        }
      }
      if (onProgress) {
        onProgress({
          downloadedBytes,
          totalBytes,
          lastProgressTime: Date.now(),
          lastDownloadedBytes: downloadedBytes,
          url,
        })
      }
      if (onComplete) {
        await onComplete(url, filepath)
      }
      resolve(filepath)
    })

    // Start stall timer and pipe: response -> progressStream -> writeStream
    resetStallTimer()
    response.data.pipe(progressStream).pipe(writeStream)
  })
}

export async function doResumableDownloadWithRetry({
  url,
  filepath,
  signal,
  timeout = 30000,
  onProgress,
  max_retries = 3,
  retry_delay = 2000,
  onAttemptError,
  allowedMimeTypes,
  expectedSha256,
}: DoResumableDownloadWithRetryParams): Promise<string> {
  const dirname = path.dirname(filepath)
  await ensureDirectoryExists(dirname)

  let attempt = 0
  let lastError: Error | null = null

  while (attempt < max_retries) {
    try {
      const result = await doResumableDownload({
        url,
        filepath,
        signal,
        timeout,
        allowedMimeTypes,
        onProgress,
        expectedSha256,
      })

      return result // return on success
    } catch (error: any) {
      attempt++
      lastError = error as Error

      const isAborted = error.name === 'AbortError' || error.code === 'ABORT_ERR'
      const isNetworkError =
        error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT'

      onAttemptError?.(error, attempt)
      if (isAborted) {
        throw new Error(`Download aborted for URL: ${url}`)
      }

      if (attempt < max_retries && isNetworkError) {
        // exponential backoff with full jitter, starting at retry_delay (default 2 s), capped at 60 s
        await sleep(computeBackoffDelay(attempt, { baseMs: retry_delay, maxMs: 60_000 }), signal)
        continue
      }

      // If max retries reached or non-retriable error, throw
      if (attempt >= max_retries || !isNetworkError) {
        throw error
      }
    }
  }

  // should not reach here, but TypeScript needs a return
  throw lastError || new Error('Unknown error during download')
}
