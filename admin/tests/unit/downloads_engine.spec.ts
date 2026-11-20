/**
 * The native download engine (app/utils/downloads.ts) against a local HTTP server:
 * - doResumableDownloadWithRetry: network errors (ECONNRESET) are retried with backoff up to max_retries,
 *   everything else fails at once, an abort is final, and a wrong SHA-256 never installs the file;
 * - doResumableDownload: a partial .tmp is resumed with Range (and the SHA-256 then checked from disk), a stale
 *   or unusable partial is discarded, a finished file is not downloaded again, and gated / wrong-type
 *   content is refused before anything is written.
 */
import * as assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import http from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import {
  DisallowedMimeTypeError,
  doResumableDownload,
  doResumableDownloadWithRetry,
  GatedContentAuthError,
} from '../../app/utils/downloads.js'
import { setLoggerForTests } from '../../app/utils/lazy_logger.js'

const DATA = randomBytes(64 * 1024)
const SHA = createHash('sha256').update(DATA).digest('hex')

let server: http.Server
let port = 0
let workdir = ''
/** how many more connections to /flaky/* are reset before the server starts answering */
let resetsLeft = 0
/** Range headers received, per request, for the resume tests */
const ranges: (string | undefined)[] = []

function serve(req: http.IncomingMessage, res: http.ServerResponse) {
  const mode = new URL(req.url!, 'http://x').pathname.split('/')[1]
  if (mode === 'reset' || (mode === 'flaky' && resetsLeft-- > 0)) {
    req.socket.destroy() // the client sees ECONNRESET
    return
  }
  if (mode === 'missing') {
    res.writeHead(404).end()
    return
  }
  if (mode === 'gated') {
    res.writeHead(401).end()
    return
  }
  if (mode === 'html') {
    res.writeHead(200, { 'content-type': 'text/html' }).end('<html>error page</html>')
    return
  }
  if (req.method === 'GET') ranges.push(req.headers.range)
  const range = /^bytes=(\d+)-$/.exec(req.headers.range ?? '')
  if (range && mode !== 'ignores-range') {
    const start = Number(range[1])
    res.writeHead(206, {
      'content-type': 'application/octet-stream',
      'content-length': DATA.length - start,
      'content-range': `bytes ${start}-${DATA.length - 1}/${DATA.length}`,
      'accept-ranges': 'bytes',
    })
    res.end(DATA.subarray(start))
    return
  }
  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-length': DATA.length,
    'accept-ranges': 'bytes',
  })
  res.end(req.method === 'HEAD' ? undefined : DATA)
}

before(async () => {
  server = http.createServer(serve)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  port = (server.address() as AddressInfo).port
  workdir = await mkdtemp(path.join(tmpdir(), 'dl-retry-'))
  setLoggerForTests({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} })
})

after(async () => {
  setLoggerForTests(null)
  await new Promise<void>((r) => server.close(() => r()))
  await rm(workdir, { recursive: true, force: true })
})

/** required by the params type; an empty list skips the MIME check */
const BASE = { timeout: 5000, allowedMimeTypes: [] as string[] }
const url = (mode: string) => `http://127.0.0.1:${port}/${mode}/file.bin`
const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false
  )

test('a reset connection is retried and the download then completes', async () => {
  resetsLeft = 2
  const attempts: number[] = []
  const filepath = path.join(workdir, 'flaky', 'file.bin')
  await doResumableDownloadWithRetry({
    ...BASE,
    url: url('flaky'),
    filepath,
    max_retries: 3,
    retry_delay: 1,
    onAttemptError: (_e, attempt) => attempts.push(attempt),
  })
  assert.deepEqual(attempts, [1, 2])
  assert.deepEqual(await readFile(filepath), DATA)
})

test('network errors stop after max_retries and the last error is raised', async () => {
  const attempts: number[] = []
  await assert.rejects(
    doResumableDownloadWithRetry({
      ...BASE,
      url: url('reset'),
      filepath: path.join(workdir, 'reset', 'file.bin'),
      max_retries: 2,
      retry_delay: 1,
      onAttemptError: (_e, attempt) => attempts.push(attempt),
    }),
    (error: any) => error.code === 'ECONNRESET'
  )
  assert.deepEqual(attempts, [1, 2])
})

test('a non-network error (HTTP 404) is not retried', async () => {
  const attempts: number[] = []
  await assert.rejects(
    doResumableDownloadWithRetry({
      ...BASE,
      url: url('missing'),
      filepath: path.join(workdir, 'missing', 'file.bin'),
      max_retries: 5,
      retry_delay: 1,
      onAttemptError: (_e, attempt) => attempts.push(attempt),
    })
  )
  assert.deepEqual(attempts, [1])
})

test('an aborted download is final (not retried)', async () => {
  const controller = new AbortController()
  controller.abort()
  const attempts: number[] = []
  await assert.rejects(
    doResumableDownloadWithRetry({
      ...BASE,
      url: url('ok'),
      filepath: path.join(workdir, 'aborted', 'file.bin'),
      signal: controller.signal,
      max_retries: 3,
      retry_delay: 1,
      onAttemptError: (_e, attempt) => attempts.push(attempt),
    }),
    // axios rejects with CanceledError (ERR_CANCELED). The wrapper's own "Download aborted for URL" branch only
    // matches AbortError/ABORT_ERR, so it is not reached here; the cancellation is still not retried.
    (error: any) => error.code === 'ERR_CANCELED'
  )
  assert.deepEqual(attempts, [1])
})

test('a wrong SHA-256 fails without retrying and installs nothing', async () => {
  const attempts: number[] = []
  const filepath = path.join(workdir, 'bad-sha', 'file.bin')
  await assert.rejects(
    doResumableDownloadWithRetry({
      ...BASE,
      url: url('ok'),
      filepath,
      expectedSha256: '0'.repeat(64),
      max_retries: 3,
      retry_delay: 1,
      onAttemptError: (_e, attempt) => attempts.push(attempt),
    }),
    /SHA-256 mismatch/
  )
  assert.deepEqual(attempts, [1])
  assert.equal(await exists(filepath), false)
  assert.equal(await exists(`${filepath}.tmp`), false)
})

test('the right SHA-256 installs the file', async () => {
  const filepath = path.join(workdir, 'good-sha', 'file.bin')
  await doResumableDownloadWithRetry({
    ...BASE,
    url: url('ok'),
    filepath,
    expectedSha256: SHA,
    retry_delay: 1,
  })
  assert.deepEqual(await readFile(filepath), DATA)
})

async function partial(name: string, content: Buffer) {
  const filepath = path.join(workdir, name, 'file.bin')
  await mkdir(path.dirname(filepath), { recursive: true })
  await writeFile(`${filepath}.tmp`, content)
  ranges.length = 0
  return filepath
}

test('a partial .tmp is resumed with a Range request and the result is checked from disk', async () => {
  const filepath = await partial('resume', DATA.subarray(0, 1000))
  await doResumableDownload({ ...BASE, url: url('ok'), filepath, expectedSha256: SHA })
  assert.deepEqual(ranges, ['bytes=1000-'])
  assert.deepEqual(await readFile(filepath), DATA)
  assert.equal(await exists(`${filepath}.tmp`), false)
})

test('a resumed file with the wrong SHA-256 is not installed', async () => {
  const wrong = Buffer.from(DATA.subarray(0, 1000))
  wrong[0] ^= 0xff // the partial on disk is corrupt; the server's tail is fine
  const filepath = await partial('resume-corrupt', wrong)
  await assert.rejects(
    doResumableDownload({ ...BASE, url: url('ok'), filepath, expectedSha256: SHA }),
    /SHA-256 mismatch/
  )
  assert.equal(await exists(filepath), false)
  assert.equal(await exists(`${filepath}.tmp`), false)
})

test('a server that ignores Range makes the download restart from scratch', async () => {
  const filepath = await partial('ignores-range', DATA.subarray(0, 1000))
  await doResumableDownload({ ...BASE, url: url('ignores-range'), filepath, expectedSha256: SHA })
  assert.deepEqual(ranges, ['bytes=1000-', undefined])
  assert.deepEqual(await readFile(filepath), DATA)
})

test('a .tmp larger than the file on the server is discarded (the publisher replaced the file)', async () => {
  const filepath = await partial('stale', Buffer.concat([DATA, Buffer.from('extra')]))
  await doResumableDownload({ ...BASE, url: url('ok'), filepath, expectedSha256: SHA })
  assert.deepEqual(ranges, [undefined])
  assert.deepEqual(await readFile(filepath), DATA)
})

test('a complete .tmp that was never renamed is verified and installed without downloading', async () => {
  const filepath = await partial('complete-tmp', DATA)
  const completed: string[] = []
  await doResumableDownload({
    ...BASE,
    url: url('ok'),
    filepath,
    expectedSha256: SHA,
    onComplete: async (u) => {
      completed.push(u)
    },
  })
  assert.deepEqual(ranges, [])
  assert.deepEqual(completed, [url('ok')])
  assert.deepEqual(await readFile(filepath), DATA)
})

test('a complete .tmp with the wrong SHA-256 is rejected', async () => {
  const wrong = Buffer.from(DATA)
  wrong[10] ^= 0xff
  const filepath = await partial('complete-tmp-corrupt', wrong)
  await assert.rejects(
    doResumableDownload({ ...BASE, url: url('ok'), filepath, expectedSha256: SHA }),
    /SHA-256 mismatch/
  )
  assert.equal(await exists(filepath), false)
})

test('a final file already at the right size is not downloaded again', async () => {
  const filepath = path.join(workdir, 'done', 'file.bin')
  await mkdir(path.dirname(filepath), { recursive: true })
  await writeFile(filepath, DATA)
  ranges.length = 0
  assert.equal(await doResumableDownload({ ...BASE, url: url('ok'), filepath }), filepath)
  assert.deepEqual(ranges, [])
})

test('gated content without credentials is refused with a readable error', async () => {
  await assert.rejects(
    doResumableDownload({
      ...BASE,
      url: url('gated'),
      filepath: path.join(workdir, 'gated', 'f.bin'),
    }),
    (error: unknown) => error instanceof GatedContentAuthError && /HTTP 401/.test(error.message)
  )
})

test('a disallowed Content-Type is refused before anything is written', async () => {
  const filepath = path.join(workdir, 'html', 'file.bin')
  await assert.rejects(
    doResumableDownload({
      ...BASE,
      url: url('html'),
      filepath,
      allowedMimeTypes: ['application/octet-stream'],
    }),
    (error: unknown) => error instanceof DisallowedMimeTypeError
  )
  assert.equal(await exists(`${filepath}.tmp`), false)
})
