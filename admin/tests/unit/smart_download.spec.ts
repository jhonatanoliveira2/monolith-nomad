/**
 * Smart download end to end against real local HTTP servers (Range support, failures, corrupt and gated
 * sources), with the native engine and — when the binary is installed — the real aria2c.
 */
import * as assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import http from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'

import {
  Aria2PartialKeptError,
  smartDownload,
  type SmartDownloadDeps,
} from '../../app/utils/smart_download.js'
import {
  ChecksumMismatchError,
  doResumableDownload,
  GatedContentAuthError,
} from '../../app/utils/downloads.js'
import {
  DEFAULT_DOWNLOAD_PREFERENCES,
  type DownloadPreferences,
} from '../../app/utils/download_preferences.js'
import { Aria2Error, aria2Version, runAria2 } from '../../app/utils/aria2.js'
import { startConnectGuard } from '../../app/utils/connect_guard.js'
import { setLoggerForTests } from '../../app/utils/lazy_logger.js'
import type { DownloadSource, HostStats } from '../../app/utils/mirror_selection.js'

const SIZE = 3 * 1024 * 1024 + 123
const DATA = randomBytes(SIZE)
const SHA = createHash('sha256').update(DATA).digest('hex')
const CORRUPT = Buffer.from(DATA)
CORRUPT[SIZE - 10] ^= 0xff

let server: http.Server
let port = 0
const seen: { path: string; host: string; auth: string | undefined; range: string | undefined }[] =
  []
let workdir = ''
const logs: string[] = []

function serve(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url!, 'http://x')
  const [, mode] = url.pathname.split('/')
  seen.push({
    path: url.pathname,
    host: String(req.headers.host),
    auth: req.headers.authorization,
    range: req.headers.range,
  })
  if (mode === 'fail') {
    res.writeHead(500).end('boom')
    return
  }
  if (mode === 'auth' && req.headers.authorization !== 'Bearer good') {
    res.writeHead(401).end()
    return
  }
  if (mode === 'html') {
    res.writeHead(200, { 'content-type': 'text/html' }).end('<html>not a zim</html>')
    return
  }
  const body = mode === 'corrupt' ? CORRUPT : mode === 'other' ? DATA.subarray(0, SIZE - 1) : DATA
  const headers: Record<string, string | number> = {
    'accept-ranges': 'bytes',
    'content-type': 'application/octet-stream',
  }
  const range = req.headers.range
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range)!
    const start = Number(m[1])
    const end = m[2] ? Math.min(Number(m[2]), body.length - 1) : body.length - 1
    res.writeHead(206, {
      ...headers,
      'content-range': `bytes ${start}-${end}/${body.length}`,
      'content-length': end - start + 1,
    })
    res.end(req.method === 'HEAD' ? undefined : body.subarray(start, end + 1))
    return
  }
  res.writeHead(200, { ...headers, 'content-length': body.length })
  res.end(req.method === 'HEAD' ? undefined : body)
}

before(async () => {
  server = http.createServer(serve)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  port = (server.address() as AddressInfo).port
  workdir = await mkdtemp(path.join(tmpdir(), 'smart-dl-'))
  setLoggerForTests({
    debug: () => {},
    info: (m) => logs.push(m),
    warn: (m) => logs.push(m),
    error: (m) => logs.push(m),
  })
})

after(async () => {
  setLoggerForTests(null)
  await new Promise<void>((r) => server.close(() => r()))
  await rm(workdir, { recursive: true, force: true })
})

// 127.0.0.1 and localhost reach the same server but count as two hosts (header/statistics separation)
const u = (host: '127.0.0.1' | 'localhost', mode: string) =>
  `http://${host}:${port}/${mode}/file.bin`
const source = (
  url: string,
  kind: 'origin' | 'mirror',
  location: string | null = null,
  priority: number | null = null
): DownloadSource => ({
  url,
  host: new URL(url).hostname,
  kind,
  location,
  priority,
})

function prefs(over: Partial<DownloadPreferences> = {}): DownloadPreferences {
  return {
    ...DEFAULT_DOWNLOAD_PREFERENCES,
    benchmark: false,
    benchmarkSampleBytes: 256 * 1024,
    ...over,
  }
}

function deps(
  sources: DownloadSource[],
  sha256: string | null,
  over: Partial<SmartDownloadDeps> = {}
): Partial<SmartDownloadDeps> {
  return {
    resolveSources: async () => ({
      sources,
      sha256,
      size: SIZE,
      viaMetalink: sources.length > 1,
    }),
    stats: new Map<string, HostStats>(),
    sleep: async () => {},
    // the local test server stands in for public mirrors
    mirrorLookup: null,
    ...over,
  }
}

async function target(name: string) {
  return path.join(workdir, name, 'file.bin')
}

async function sha(file: string) {
  return createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
}

test('native: a failing mirror falls back to the next source; onComplete gets the canonical URL', async () => {
  const file = await target('fallback')
  const canonical = u('127.0.0.1', 'ok')
  let completed = ''
  await smartDownload({
    url: canonical,
    filepath: file,
    timeout: 5000,
    allowedMimeTypes: ['application/octet-stream'],
    preferences: prefs({ engine: 'native' }),
    deps: deps(
      [source(u('localhost', 'fail'), 'mirror', 'br', 1), source(canonical, 'origin')],
      SHA
    ),
    onComplete: async (url) => {
      completed = url
    },
  })
  assert.equal(await sha(file), SHA)
  assert.equal(completed, canonical)
  assert.deepEqual(await readdir(path.dirname(file)), ['file.bin'], 'no .tmp left behind')
})

test('native: a mirror serving corrupt bytes is caught by SHA-256 and the next source is used', async () => {
  const file = await target('corrupt')
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: file,
    timeout: 5000,
    allowedMimeTypes: [],
    preferences: prefs({ engine: 'native' }),
    deps: deps(
      [source(u('localhost', 'corrupt'), 'mirror'), source(u('127.0.0.1', 'ok'), 'origin')],
      SHA
    ),
  })
  assert.equal(await sha(file), SHA)
  assert.ok(
    logs.some((l) => l.includes('SHA-256 mismatch') && l.includes('partial file discarded'))
  )
})

test('native: when every source is corrupt the download fails and nothing is installed', async () => {
  const file = await target('allcorrupt')
  await assert.rejects(
    smartDownload({
      url: u('127.0.0.1', 'corrupt'),
      filepath: file,
      timeout: 5000,
      allowedMimeTypes: [],
      preferences: prefs({ engine: 'native' }),
      deps: deps([source(u('127.0.0.1', 'corrupt'), 'origin')], SHA),
    }),
    ChecksumMismatchError
  )
  assert.deepEqual(await readdir(path.dirname(file)), [])
})

test('native: a SHA-256 pinned by the caller (library manifest, no metalink) is enforced', async () => {
  // Library documents have no metalink: RunDownloadJob passes the hash from collections/library.json.
  const good = await target('pinned-ok')
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: good,
    timeout: 5000,
    allowedMimeTypes: [],
    expectedSha256: SHA,
    preferences: prefs({ engine: 'native' }),
    deps: deps([source(u('127.0.0.1', 'ok'), 'origin')], null),
  })
  assert.equal(await sha(good), SHA)

  const bad = await target('pinned-changed')
  await assert.rejects(
    smartDownload({
      url: u('127.0.0.1', 'ok'),
      filepath: bad,
      timeout: 5000,
      allowedMimeTypes: [],
      // the publisher replaced the file: the bytes no longer match what the catalog pinned
      expectedSha256: 'f'.repeat(64),
      preferences: prefs({ engine: 'native' }),
      deps: deps([source(u('127.0.0.1', 'ok'), 'origin')], null),
    }),
    ChecksumMismatchError
  )
  assert.deepEqual(await readdir(path.dirname(bad)), [], 'nothing installed, no partial left')
})

test('native: a partial .tmp is resumed from another mirror with a Range request', async () => {
  const file = await target('resume')
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: file,
    timeout: 5000,
    allowedMimeTypes: [],
    preferences: prefs({ engine: 'native' }),
    deps: deps([source(u('127.0.0.1', 'ok'), 'origin')], null),
  })
  const partialDir = await target('resume2')
  await doResumableDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: partialDir,
    timeout: 5000,
    allowedMimeTypes: [],
  }).catch(() => {})
  // simulate an interrupted download: keep only the first MiB as .tmp
  await rm(partialDir)
  await writeFile(partialDir + '.tmp', DATA.subarray(0, 1024 * 1024))
  seen.length = 0
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: partialDir,
    timeout: 5000,
    allowedMimeTypes: [],
    preferences: prefs({ engine: 'native' }),
    deps: deps(
      [source(u('localhost', 'ok'), 'mirror'), source(u('127.0.0.1', 'ok'), 'origin')],
      SHA
    ),
  })
  assert.equal(await sha(partialDir), SHA)
  assert.ok(seen.some((s) => s.host.startsWith('localhost') && s.range === `bytes=${1024 * 1024}-`))
})

test('request headers (Authorization) are only sent to the original host, never to mirrors', async () => {
  const file = await target('auth')
  seen.length = 0
  await smartDownload({
    url: u('127.0.0.1', 'auth'),
    filepath: file,
    timeout: 5000,
    allowedMimeTypes: [],
    requestHeaders: { Authorization: 'Bearer good' },
    preferences: prefs({ engine: 'native' }),
    deps: deps(
      [source(u('localhost', 'fail'), 'mirror'), source(u('127.0.0.1', 'auth'), 'origin')],
      SHA
    ),
  })
  assert.equal(await sha(file), SHA)
  assert.ok(seen.filter((s) => s.host.startsWith('localhost')).every((s) => s.auth === undefined))
  assert.ok(seen.some((s) => s.host.startsWith('127.0.0.1') && s.auth === 'Bearer good'))
})

test('a 401 from a mirror (no credentials sent) is not fatal; from the original host it is', async () => {
  const file = await target('gated')
  seen.length = 0
  await assert.rejects(
    smartDownload({
      url: u('127.0.0.1', 'auth'),
      filepath: file,
      timeout: 5000,
      allowedMimeTypes: [],
      requestHeaders: { Authorization: 'Bearer wrong' },
      preferences: prefs({ engine: 'native' }),
      deps: deps(
        [source(u('localhost', 'auth'), 'mirror'), source(u('127.0.0.1', 'auth'), 'origin')],
        SHA
      ),
    }),
    GatedContentAuthError
  )
  assert.ok(
    seen.some((s) => s.host.startsWith('localhost')),
    'the mirror was tried first'
  )
  assert.ok(
    seen.some((s) => s.host.startsWith('127.0.0.1') && s.auth === 'Bearer wrong'),
    'then the origin, with the credentials'
  )
})

test('benchmark: a mirror with a different file size is rejected and ranked after the healthy one', async () => {
  const file = await target('bench')
  const stats = new Map<string, HostStats>()
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: file,
    timeout: 5000,
    allowedMimeTypes: [],
    preferences: prefs({ engine: 'native', benchmark: true }),
    deps: deps(
      [
        source(u('localhost', 'other'), 'mirror', 'br', 1),
        source(u('127.0.0.1', 'ok'), 'mirror', 'us', 2),
        source(u('127.0.0.1', 'ok'), 'origin'),
      ],
      SHA,
      { stats }
    ),
  })
  assert.equal(await sha(file), SHA)
  assert.equal(stats.get('localhost')?.recentFailures, 1, 'wrong size counts as a failed probe')
  assert.ok((stats.get('127.0.0.1')?.throughputBps ?? 0) > 0, 'a real measurement was recorded')
  assert.ok(logs.some((l) => l.includes('probe localhost: failed (size')))
  assert.ok(
    logs.some((l) => /order 127\.0\.0\.1\(us\) > localhost\(br\)/.test(l)),
    'measured mirror first, despite location'
  )
})

test('aria2c: segmented download over two mirrors with SHA-256 verified', async (t) => {
  if (!(await aria2Version())) {
    t.skip('aria2c is not installed')
    return
  }
  const file = await target('aria2')
  const progress: number[] = []
  let completed = ''
  seen.length = 0
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: file,
    timeout: 30000,
    allowedMimeTypes: ['application/octet-stream'],
    preferences: prefs({ engine: 'aria2', aria2Split: 4 }),
    deps: deps(
      [source(u('localhost', 'ok'), 'mirror'), source(u('127.0.0.1', 'ok'), 'origin')],
      SHA
    ),
    onProgress: (p) => progress.push(p.downloadedBytes),
    onComplete: async (url) => {
      completed = url
    },
  })
  assert.equal(await sha(file), SHA)
  assert.equal(completed, u('127.0.0.1', 'ok'))
  assert.deepEqual(await readdir(path.dirname(file)), ['file.bin'], 'no .tmp / .aria2 left behind')
  assert.equal(progress.at(-1), SIZE)
  assert.ok(
    seen.some((s) => s.host.startsWith('localhost')) &&
      seen.some((s) => s.host.startsWith('127.0.0.1')),
    'both mirrors served segments'
  )
  assert.ok(logs.some((l) => l.includes('done via aria2c')))
})

test('aria2c: wrong checksum discards the partial file and falls back to the native engine', async (t) => {
  if (!(await aria2Version())) {
    t.skip('aria2c is not installed')
    return
  }
  const file = await target('aria2bad')
  await assert.rejects(
    smartDownload({
      url: u('127.0.0.1', 'corrupt'),
      filepath: file,
      timeout: 30000,
      allowedMimeTypes: [],
      preferences: prefs({ engine: 'aria2' }),
      deps: deps([source(u('127.0.0.1', 'corrupt'), 'origin')], SHA),
    }),
    ChecksumMismatchError
  )
  assert.ok(logs.some((l) => l.includes('aria2c failed') && l.includes('code 32')))
  assert.deepEqual(await readdir(path.dirname(file)), [], 'neither .tmp nor .aria2 remain')
})

test('aria2c: an HTML error page instead of the file is refused before downloading', async (t) => {
  if (!(await aria2Version())) {
    t.skip('aria2c is not installed')
    return
  }
  const file = await target('aria2html')
  await assert.rejects(
    smartDownload({
      url: u('127.0.0.1', 'html'),
      filepath: file,
      timeout: 5000,
      allowedMimeTypes: ['application/octet-stream'],
      preferences: prefs({ engine: 'aria2' }),
      deps: deps([source(u('127.0.0.1', 'html'), 'origin')], null),
    }),
    /MIME type text\/html is not allowed/
  )
})

// ── review fixes (20/11/2026): credentials, partial progress, segmented partials ──

const fakeAria2 = { aria2Version: async () => '1.37.0' }

async function dirOf(name: string) {
  const file = await target(name)
  await mkdir(path.dirname(file), { recursive: true })
  return file
}

test('aria2c is not used when the request carries credentials (it would forward them on redirects)', async () => {
  const file = await dirOf('aria2-auth')
  let aria2Calls = 0
  await smartDownload({
    url: u('127.0.0.1', 'auth'),
    filepath: file,
    timeout: 30000,
    allowedMimeTypes: [],
    requestHeaders: { Authorization: 'Bearer good' },
    preferences: prefs({ engine: 'aria2' }),
    deps: deps([source(u('127.0.0.1', 'auth'), 'origin')], SHA, {
      ...fakeAria2,
      runAria2: async () => {
        aria2Calls++
      },
    }),
  })
  assert.equal(aria2Calls, 0)
  assert.equal(await sha(file), SHA)
})

test('aria2c: a failure after partial progress keeps the partial for the next attempt instead of restarting', async () => {
  const file = await dirOf('aria2-partial')
  let nativeCalls = 0
  await assert.rejects(
    smartDownload({
      url: u('127.0.0.1', 'ok'),
      filepath: file,
      timeout: 30000,
      allowedMimeTypes: [],
      preferences: prefs({ engine: 'aria2' }),
      deps: deps([source(u('127.0.0.1', 'ok'), 'origin')], SHA, {
        ...fakeAria2,
        runAria2: async (req) => {
          await writeFile(path.join(req.dir, req.out), DATA.subarray(0, 1024 * 1024))
          await writeFile(path.join(req.dir, `${req.out}.aria2`), 'control')
          throw new Aria2Error('aria2c exited with code 6 (network problem)', 6, null)
        },
        nativeDownload: async () => {
          nativeCalls++
          return file
        },
      }),
    }),
    (error: unknown) => error instanceof Aria2PartialKeptError
  )
  assert.equal(nativeCalls, 0, 'the native engine would have to start over')
  const left = await readdir(path.dirname(file))
  assert.deepEqual(left.sort(), ['file.bin.tmp', 'file.bin.tmp.aria2'])
})

test('aria2c: a failure before any progress still falls back to the native engine', async () => {
  const file = await dirOf('aria2-noprogress')
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: file,
    timeout: 30000,
    allowedMimeTypes: [],
    preferences: prefs({ engine: 'aria2' }),
    deps: deps([source(u('127.0.0.1', 'ok'), 'origin')], SHA, {
      ...fakeAria2,
      runAria2: async () => {
        throw new Aria2Error('aria2c exited with code 1', 1, null)
      },
    }),
  })
  assert.equal(await sha(file), SHA)
})

test('native: a segmented partial left by aria2c is discarded, never resumed by size', async () => {
  const file = await dirOf('native-sparse')
  // aria2c writes segments out of order: the bytes before its last write may be holes (zeros)
  await writeFile(`${file}.tmp`, Buffer.alloc(1024 * 1024))
  await writeFile(`${file}.tmp.aria2`, 'control')
  seen.length = 0
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: file,
    timeout: 30000,
    allowedMimeTypes: [],
    preferences: prefs({ engine: 'native' }),
    deps: deps([source(u('127.0.0.1', 'ok'), 'origin')], SHA),
  })
  assert.equal(await sha(file), SHA)
  assert.ok(
    seen.every((r) => r.range === undefined),
    'no Range request on top of a sparse file'
  )
  assert.deepEqual(await readdir(path.dirname(file)), ['file.bin'])
})

test('aria2c: an orphan control file without its .tmp is removed before aria2c starts', async () => {
  const file = await dirOf('aria2-orphan')
  await writeFile(`${file}.tmp.aria2`, 'control')
  let controlAtStart: boolean | null = null
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: file,
    timeout: 30000,
    allowedMimeTypes: [],
    preferences: prefs({ engine: 'aria2' }),
    deps: deps([source(u('127.0.0.1', 'ok'), 'origin')], SHA, {
      ...fakeAria2,
      runAria2: async (req) => {
        controlAtStart = await access(path.join(req.dir, `${req.out}.aria2`)).then(
          () => true,
          () => false
        )
        await writeFile(path.join(req.dir, req.out), DATA)
      },
    }),
  })
  assert.equal(controlAtStart, false)
  assert.equal(await sha(file), SHA)
})

test('aria2c: a failure that made no new progress discards the partial and falls back (no endless retries)', async () => {
  const file = await dirOf('aria2-stuck')
  // left by a previous attempt
  await writeFile(`${file}.tmp`, DATA.subarray(0, 1024 * 1024))
  await writeFile(`${file}.tmp.aria2`, 'control')
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: file,
    timeout: 30000,
    allowedMimeTypes: [],
    preferences: prefs({ engine: 'aria2' }),
    deps: deps([source(u('127.0.0.1', 'ok'), 'origin')], SHA, {
      ...fakeAria2,
      runAria2: async () => {
        // fails again at the same point: nothing new written
        throw new Aria2Error('aria2c exited with code 6 (network problem)', 6, null)
      },
    }),
  })
  assert.equal(await sha(file), SHA)
  assert.deepEqual(await readdir(path.dirname(file)), ['file.bin'])
})

test('aria2c: finishing with the wrong size leaves no partial for the native engine to resume', async () => {
  const file = await dirOf('aria2-short')
  seen.length = 0
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: file,
    timeout: 30000,
    allowedMimeTypes: [],
    preferences: prefs({ engine: 'aria2' }),
    deps: deps([source(u('127.0.0.1', 'ok'), 'origin')], null, {
      ...fakeAria2,
      runAria2: async (req) => {
        // "done", but short: the bytes it wrote may have holes
        await writeFile(path.join(req.dir, req.out), Buffer.alloc(1024 * 1024))
      },
    }),
  })
  assert.equal(await sha(file), SHA)
  assert.ok(
    seen.every((r) => r.range === undefined),
    'the native download started over'
  )
})

test('native: a mirror resolving to a non-public address is refused at connect time; the origin is used', async () => {
  const file = await dirOf('native-private-mirror')
  seen.length = 0
  await smartDownload({
    url: u('127.0.0.1', 'ok'),
    filepath: file,
    timeout: 30000,
    allowedMimeTypes: [],
    preferences: prefs({ engine: 'native' }),
    deps: deps(
      [source(u('localhost', 'ok'), 'mirror'), source(u('127.0.0.1', 'ok'), 'origin')],
      SHA,
      // production policy: mirrors must resolve to public addresses (localhost does not)
      { mirrorLookup: async () => [{ address: '127.0.0.1', family: 4 }] }
    ),
  })
  assert.equal(await sha(file), SHA)
  assert.ok(!seen.some((r) => r.host.startsWith('localhost')), 'no request reached the "mirror"')
  assert.ok(logs.some((l) => l.includes('non-public address')))
})

test('aria2c: a failed HEAD with a segmented partial on disk keeps it for the next attempt', async () => {
  const file = await dirOf('aria2-head-fails')
  await writeFile(`${file}.tmp`, DATA.subarray(0, 1024 * 1024))
  await writeFile(`${file}.tmp.aria2`, 'control')
  let nativeCalls = 0
  await assert.rejects(
    smartDownload({
      url: u('127.0.0.1', 'ok'),
      filepath: file,
      timeout: 30000,
      allowedMimeTypes: [],
      preferences: prefs({ engine: 'aria2' }),
      deps: deps([source(u('127.0.0.1', 'ok'), 'origin')], SHA, {
        ...fakeAria2,
        preflight: async () => {
          throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })
        },
        nativeDownload: async () => {
          nativeCalls++
          return file
        },
      }),
    }),
    (error: unknown) => error instanceof Aria2PartialKeptError
  )
  assert.equal(nativeCalls, 0)
  const left = await readdir(path.dirname(file))
  assert.deepEqual(left.sort(), ['file.bin.tmp', 'file.bin.tmp.aria2'])
})

test('aria2c downloads mirrors through the loopback connect guard; not behind a proxy from the environment', async () => {
  const seenProxy: (string | undefined)[] = []
  const run = (envProxy: string | null) =>
    smartDownload({
      url: u('127.0.0.1', 'ok'),
      filepath: path.join(workdir, `guard-${envProxy ? 'proxied' : 'direct'}`, 'file.bin'),
      timeout: 30000,
      allowedMimeTypes: [],
      preferences: prefs({ engine: 'aria2' }),
      deps: deps(
        [source(u('localhost', 'ok'), 'mirror'), source(u('127.0.0.1', 'ok'), 'origin')],
        SHA,
        {
          ...fakeAria2,
          mirrorLookup: async () => [{ address: '93.184.216.34', family: 4 }],
          envProxy: () => envProxy,
          runAria2: async (req) => {
            seenProxy.push(req.proxy)
            await writeFile(path.join(req.dir, req.out), DATA)
          },
        }
      ),
    })
  await run(null)
  await run('http://10.0.0.1:3128')
  assert.match(String(seenProxy[0]), /^http:\/\/127\.0\.0\.1:\d+$/)
  assert.equal(seenProxy[1], undefined)
})

test('real aria2c through the guard: a plain-http (or private) mirror is refused before any request', async (t) => {
  if (!(await aria2Version())) {
    t.skip('aria2c is not installed')
    return
  }
  const guard = await startConnectGuard()
  const dir = path.join(workdir, 'guard-real')
  await mkdir(dir, { recursive: true })
  seen.length = 0
  try {
    await assert.rejects(
      runAria2({
        uris: [u('127.0.0.1', 'ok')],
        dir,
        out: 'file.bin.tmp',
        split: 1,
        maxConnectionsPerServer: 1,
        timeoutSeconds: 10,
        proxy: guard.url,
      }),
      Aria2Error
    )
  } finally {
    await guard.close()
  }
  assert.equal(seen.length, 0, 'the local server never saw a request')
})
