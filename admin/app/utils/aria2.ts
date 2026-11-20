import { spawn, type ChildProcess } from 'node:child_process'

/**
 * aria2c backend: segmented, multi-source download of one file.
 *
 * - Every URI of the file is given to aria2c as a mirror of the same file (tab-separated on one input
 *   line), so its segments are spread over the chosen mirrors.
 * - The input (URIs, output path, checksum and request headers) goes through stdin (`--input-file=-`), never
 *   the command line: an `Authorization` header must not be visible in `ps` to other processes.
 * - Behaviour verified against aria2 1.37.0 with a local range server (see docs/downloads.md): a partial
 *   `.tmp` left by the native downloader is resumed (`--continue`), SIGTERM leaves `<out>.aria2` and the next
 *   run resumes it, a wrong SHA-256 exits with code 32 and leaves both files behind.
 * - Errors are classified by exit code only (aria2c localises its messages).
 */
export type Aria2Request = {
  uris: string[]
  dir: string
  out: string
  sha256?: string | null
  headers?: Record<string, string>
  split: number
  maxConnectionsPerServer: number
  /** seconds without progress on a connection before aria2c gives up on it */
  timeoutSeconds: number
  /** proxy for every connection (the loopback connect guard for mirror downloads, see connect_guard.ts) */
  proxy?: string
}

export type Aria2Progress = {
  downloadedBytes: number
  totalBytes: number
  connections: number
  speedBps: number
}

/** Documented aria2c exit codes we act on (aria2c(1), "EXIT STATUS"). */
export const ARIA2_EXIT = {
  OK: 0,
  NOT_ENOUGH_DISK: 9,
  HTTP_AUTH_FAILED: 24,
  CHECKSUM_FAILED: 32,
} as const

export class Aria2Error extends Error {
  constructor(
    message: string,
    readonly exitCode: number | null,
    readonly signal: string | null
  ) {
    super(message)
    this.name = 'Aria2Error'
  }
}

const HEADER_NAME_RE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/

function cleanValue(v: string): string {
  // input-file options are line based: a newline would inject another option
  return v.replace(/[\r\n]/g, '')
}

/** The stdin input file: the URIs of one file on one line, then its options (indented). */
export function buildAria2Input(req: Aria2Request): string {
  if (req.uris.length === 0) throw new Error('aria2: no URIs')
  const lines = [req.uris.map(cleanValue).join('\t')]
  lines.push(`  dir=${cleanValue(req.dir)}`)
  lines.push(`  out=${cleanValue(req.out)}`)
  if (req.sha256) lines.push(`  checksum=sha-256=${cleanValue(req.sha256)}`)
  for (const [name, value] of Object.entries(req.headers ?? {})) {
    if (!HEADER_NAME_RE.test(name)) continue
    lines.push(`  header=${name}: ${cleanValue(value)}`)
  }
  return lines.join('\n') + '\n'
}

export function buildAria2Args(req: Aria2Request): string[] {
  return [
    '--input-file=-',
    // isolated from the container's environment: no aria2.conf, no ~/.netrc credentials, and a downloaded
    // .metalink/.torrent is a file to install, never instructions to download more
    '--no-conf=true',
    '--no-netrc=true',
    '--follow-metalink=false',
    '--follow-torrent=false',
    `--split=${req.split}`,
    `--max-connection-per-server=${req.maxConnectionsPerServer}`,
    // 4 MiB = the piece size Kiwix publishes (aria2's default is 20M). Finer segments let a fast mirror take
    // over more of the file; measured against 16M on a 67 MiB ZIM (20/11/2026, docs/downloads.md) it made no
    // clear difference either way, so the change is kept for granularity, not for a measured gain.
    '--min-split-size=4M',
    '--continue=true',
    '--auto-file-renaming=false',
    '--allow-overwrite=false',
    '--remove-control-file=false',
    // sparse writes: works on every filesystem a bind-mounted storage volume may use
    '--file-allocation=none',
    // inorder + split == connections per server: every connection goes to the first (best ranked) mirror and
    // the others are spares aria2c switches to on errors. aria2c itself matches curl on one mirror (~15 MiB/s);
    // spreading segments over several mirrors with `adaptive` let slow mirrors hold back the end of the file
    // (measured 20/11/2026, docs/downloads.md).
    '--uri-selector=inorder',
    '--max-tries=3',
    '--retry-wait=5',
    `--timeout=${req.timeoutSeconds}`,
    '--connect-timeout=15',
    '--summary-interval=1',
    '--human-readable=false',
    '--enable-color=false',
    '--console-log-level=warn',
    '--download-result=hide',
    '--check-certificate=true',
    ...(req.proxy ? [`--all-proxy=${req.proxy}`] : []),
  ]
}

// "[#43f45f 12582912/29360128(42%) CN:4 DL:6291456 ETA:2s]" (sizes in bytes with --human-readable=false)
const READOUT_RE =
  /\[#[0-9a-f]+\s+(\d+)B?\/(\d+)B?(?:\((\d+)%\))?(?:\s+CN:(\d+))?(?:\s+(?:SD:\d+\s+)?DL:(\d+)B?)?/

export function parseAria2Readout(line: string): Aria2Progress | null {
  const m = READOUT_RE.exec(line)
  if (!m) return null
  return {
    downloadedBytes: Number(m[1]),
    totalBytes: Number(m[2]),
    connections: m[4] ? Number(m[4]) : 0,
    speedBps: m[5] ? Number(m[5]) : 0,
  }
}

const versionCache = new Map<string, Promise<string | null>>()

/** "1.37.0", or null when the binary cannot run. Cached per path. */
export function aria2Version(bin = 'aria2c'): Promise<string | null> {
  let p = versionCache.get(bin)
  if (!p) {
    p = new Promise((resolve) => {
      let out = ''
      let child: ChildProcess
      try {
        child = spawn(bin, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] })
      } catch {
        resolve(null)
        return
      }
      child.stdout?.on('data', (c) => (out += c.toString()))
      child.on('error', () => resolve(null))
      child.on('close', (code) =>
        resolve(code === 0 ? (/(\d+\.\d+\.\d+)/.exec(out)?.[1] ?? 'unknown') : null)
      )
    })
    versionCache.set(bin, p)
  }
  return p
}

/** Tests only */
export function resetAria2VersionCache() {
  versionCache.clear()
}

export type RunAria2Options = {
  bin?: string
  signal?: AbortSignal
  onProgress?: (p: Aria2Progress) => void
  spawnFn?: typeof spawn
}

export function runAria2(req: Aria2Request, opts: RunAria2Options = {}): Promise<void> {
  const spawnFn = opts.spawnFn ?? spawn
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new Error('Download aborted'))
      return
    }
    const child = spawnFn(opts.bin ?? 'aria2c', buildAria2Args(req), {
      stdio: ['pipe', 'pipe', 'pipe'],
      // a predictable locale for the few lines we keep for the error message
      env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
    })
    const tail: string[] = []
    let buffer = ''
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString()
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        const p = parseAria2Readout(line)
        if (p) opts.onProgress?.(p)
        else if (
          !line.startsWith('***') &&
          !line.startsWith('===') &&
          !line.startsWith('---') &&
          !line.startsWith('FILE:')
        ) {
          tail.push(line)
          if (tail.length > 8) tail.shift()
        }
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)

    let aborted = false
    const onAbort = () => {
      aborted = true
      // SIGTERM: aria2c writes its control file and exits, so the download can be resumed later
      child.kill('SIGTERM')
    }
    opts.signal?.addEventListener('abort', onAbort, { once: true })

    child.on('error', (err) => {
      opts.signal?.removeEventListener('abort', onAbort)
      reject(new Aria2Error(`aria2c could not start: ${err.message}`, null, null))
    })
    child.on('close', (code, signal) => {
      opts.signal?.removeEventListener('abort', onAbort)
      if (aborted) {
        reject(new Error('Download aborted'))
        return
      }
      if (code === ARIA2_EXIT.OK) {
        resolve()
        return
      }
      const detail = tail.length ? `: ${tail.join(' | ')}` : ''
      reject(
        new Aria2Error(
          `aria2c exited with code ${code ?? 'null'}${signal ? ` (${signal})` : ''}${detail}`,
          code,
          signal
        )
      )
    })

    child.stdin?.on('error', () => {})
    child.stdin?.end(buildAria2Input(req))
  })
}
