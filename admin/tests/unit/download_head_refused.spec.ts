/**
 * Hosts that refuse HEAD but serve GET (gov.br answers 403 to every HEAD and 206 to a ranged GET,
 * measured 2026-11-24): the preflight falls back to a one-byte ranged GET, the full download still
 * works, and a source sending credentials keeps the gated-content error.
 *
 *   npm run test:unit
 */
import * as assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import {
  doResumableDownload,
  GatedContentAuthError,
  preflightDownload,
  probeHeaders,
} from '../../app/utils/downloads.js'
import { setLoggerForTests } from '../../app/utils/lazy_logger.js'

const DATA = Buffer.concat([Buffer.from('%PDF-1.7\n'), randomBytes(32 * 1024)])
let server: http.Server
let base = ''
let workdir = ''

before(async () => {
  setLoggerForTests({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} })
  workdir = await mkdtemp(path.join(tmpdir(), 'head-refused-'))
  server = http.createServer((req, res) => {
    if (req.method === 'HEAD') {
      res.writeHead(403)
      return res.end()
    }
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '')
    if (range) {
      const start = Number(range[1])
      const end = range[2] ? Number(range[2]) : DATA.length - 1
      res.writeHead(206, {
        'Content-Type': 'application/pdf',
        'Content-Range': `bytes ${start}-${end}/${DATA.length}`,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
      })
      return res.end(DATA.subarray(start, end + 1))
    }
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': String(DATA.length) })
    res.end(DATA)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(async () => {
  setLoggerForTests(null)
  await new Promise((resolve) => server.close(resolve))
  await rm(workdir, { recursive: true, force: true })
})

test('probeHeaders reads the full size from Content-Range on a 206', () => {
  assert.deepEqual(
    probeHeaders(206, {
      'content-type': 'application/pdf',
      'content-range': 'bytes 0-0/2904963',
      'content-length': '1',
    }),
    { 'content-type': 'application/pdf', 'content-length': '2904963', 'accept-ranges': 'bytes' }
  )
  // a server ignoring Range answers 200 with the whole length
  assert.deepEqual(probeHeaders(200, { 'content-length': '10', 'accept-ranges': 'none' }), {
    'content-type': undefined,
    'content-length': '10',
    'accept-ranges': 'none',
  })
})

test('preflight falls back to a ranged GET when HEAD is refused', async () => {
  const pre = await preflightDownload({
    url: `${base}/doc.pdf`,
    headers: {},
    timeout: 5000,
    allowedMimeTypes: ['application/pdf'],
  })
  assert.deepEqual(pre, {
    contentType: 'application/pdf',
    totalBytes: DATA.length,
    supportsRangeRequests: true,
  })
})

test('the whole download succeeds against a HEAD-refusing host', async () => {
  const filepath = path.join(workdir, 'doc.pdf')
  await doResumableDownload({
    url: `${base}/doc.pdf`,
    filepath,
    timeout: 5000,
    allowedMimeTypes: ['application/pdf'],
  })
  assert.deepEqual(await readFile(filepath), DATA)
})

test('with credentials, a refused HEAD is still the gated-content error', async () => {
  await assert.rejects(
    preflightDownload({
      url: `${base}/doc.pdf`,
      headers: { Authorization: 'Bearer x' },
      timeout: 5000,
    }),
    GatedContentAuthError
  )
})
