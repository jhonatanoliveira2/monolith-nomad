/**
 * Mirror probes (app/utils/mirror_benchmark.ts) with an injected fetch and clock: only a 206 with a matching
 * Content-Range counts, throughput is measured on the second half of the sample, and every failure mode
 * (no range support, bad range, empty body, timeout, network error) is reported instead of thrown.
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  benchmarkSources,
  probeSource,
  type ProbeOptions,
} from '../../app/utils/mirror_benchmark.js'
import type { DownloadSource, HostStats } from '../../app/utils/mirror_selection.js'

const MiB = 1024 * 1024
const source = (host: string): DownloadSource => ({
  url: `https://${host}/file.zim`,
  host,
  kind: 'mirror',
  location: null,
  priority: null,
})
const opts = (over: Partial<ProbeOptions> = {}): ProbeOptions => ({
  sampleBytes: 2 * MiB,
  timeoutMs: 1000,
  expectedSize: 10 * MiB,
  ...over,
})

function body(chunks: number[]): ReadableStream<Uint8Array> {
  const queue = [...chunks]
  return new ReadableStream({
    pull(controller) {
      const size = queue.shift()
      if (size === undefined) controller.close()
      else controller.enqueue(new Uint8Array(size))
    },
  })
}

function reply(status: number, headers: Record<string, string> = {}, chunks: number[] = []) {
  return (async () =>
    new Response(status === 204 ? null : body(chunks), { status, headers })) as typeof fetch
}

/** A clock that returns the given readings in order (then keeps the last one). */
function clock(...readings: number[]) {
  let i = 0
  return () => readings[Math.min(i++, readings.length - 1)]
}

const range206 = { 'content-range': `bytes 0-${2 * MiB - 1}/${10 * MiB}` }

test('throughput is measured on the second half of the sample only', async () => {
  // readings: start, first byte, body start, half reached, end
  const r = await probeSource(
    source('a'),
    opts(),
    reply(206, range206, [MiB, MiB]),
    clock(0, 50, 50, 100, 1100)
  )
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.ttfbMs, 50)
  assert.equal(r.bytes, 2 * MiB)
  assert.equal(r.throughputBps, MiB) // 1 MiB in the last 1000 ms
})

test('reading stops at the sample size even when the server sends more', async () => {
  const r = await probeSource(
    source('a'),
    opts(),
    reply(206, range206, [MiB, MiB, MiB, MiB]),
    clock(0, 1, 1, 2, 3)
  )
  assert.equal(r.ok && r.bytes, 2 * MiB)
})

test('a sample read in one chunk falls back to whole-body throughput', async () => {
  // half and end are reached on the same chunk, so the second half has no bytes of its own
  const r = await probeSource(
    source('a'),
    opts(),
    reply(206, range206, [2 * MiB]),
    clock(0, 10, 10, 500, 2010)
  )
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.throughputBps, MiB) // 2 MiB over the 2000 ms since the body started
})

test('the Range header asks for the sample and keeps the caller headers', async () => {
  let seen: Headers | undefined
  const fetchFn = (async (_url: string, init: RequestInit) => {
    seen = new Headers(init.headers)
    return new Response(body([2 * MiB]), { status: 206, headers: range206 })
  }) as unknown as typeof fetch
  await probeSource(
    source('a'),
    opts({ headers: { 'User-Agent': 'monolith-nomad/test' } }),
    fetchFn
  )
  assert.equal(seen?.get('range'), `bytes=0-${2 * MiB - 1}`)
  assert.equal(seen?.get('user-agent'), 'monolith-nomad/test')
})

test('a mirror that ignores Range is rejected', async () => {
  const r = await probeSource(source('a'), opts(), reply(200, {}, [MiB]))
  assert.deepEqual(r, {
    host: 'a',
    url: 'https://a/file.zim',
    ok: false,
    reason: 'HTTP 200 (no range support)',
  })
})

test('a missing Content-Range or one that does not start at 0 is rejected', async () => {
  for (const headers of [
    {} as Record<string, string>,
    { 'content-range': `bytes 5-${2 * MiB}/${10 * MiB}` },
  ]) {
    const r = await probeSource(source('a'), opts(), reply(206, headers, [MiB]))
    assert.equal(!r.ok && r.reason, 'invalid Content-Range')
  }
})

test('a different total size is rejected; an unknown expected size or total is accepted', async () => {
  const wrong = await probeSource(
    source('a'),
    opts({ expectedSize: 9 * MiB }),
    reply(206, range206, [2 * MiB])
  )
  assert.equal(!wrong.ok && wrong.reason, `size ${10 * MiB} != expected ${9 * MiB}`)

  const unknownExpected = await probeSource(
    source('a'),
    opts({ expectedSize: null }),
    reply(206, range206, [2 * MiB])
  )
  assert.equal(unknownExpected.ok, true)

  const starTotal = { 'content-range': `bytes 0-${2 * MiB - 1}/*` }
  const unknownTotal = await probeSource(source('a'), opts(), reply(206, starTotal, [2 * MiB]))
  assert.equal(unknownTotal.ok, true)
})

test('an empty body is a failure', async () => {
  const r = await probeSource(source('a'), opts(), reply(206, range206, []))
  assert.equal(!r.ok && r.reason, 'empty body')
})

test('a probe that does not answer in time reports a timeout', async () => {
  // a real hanging socket keeps the process alive; AbortSignal.timeout's timer does not (it is unref'd), so
  // without this handle Node 22 ends the event loop before the timeout fires
  const hang = ((_url: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      const socket = setInterval(() => {}, 1000)
      init.signal!.addEventListener('abort', () => {
        clearInterval(socket)
        reject(init.signal!.reason)
      })
    })) as unknown as typeof fetch
  const r = await probeSource(source('a'), opts({ timeoutMs: 20 }), hang)
  assert.equal(!r.ok && r.reason, 'timeout after 20 ms')
})

test('a network error is reported with its message', async () => {
  const refused = (async () => {
    throw new Error('connect ECONNREFUSED')
  }) as typeof fetch
  const r = await probeSource(source('a'), opts(), refused)
  assert.equal(!r.ok && r.reason, 'connect ECONNREFUSED')
})

test('benchmark keeps at most `concurrency` probes in flight and folds every result into the stats', async () => {
  let inFlight = 0
  let peak = 0
  const fetchFn = (async (url: string) => {
    inFlight++
    peak = Math.max(peak, inFlight)
    await new Promise((r) => setTimeout(r, 5))
    inFlight--
    if (url.includes('bad')) return new Response(body([MiB]), { status: 200 })
    return new Response(body([2 * MiB]), { status: 206, headers: range206 })
  }) as unknown as typeof fetch

  const stats = new Map<string, HostStats>()
  const sources = ['a', 'b', 'bad', 'c', 'd'].map(source)
  const results = await benchmarkSources(sources, stats, { ...opts(), concurrency: 2 }, fetchFn)

  assert.equal(peak, 2)
  assert.equal(results.length, 5)
  assert.deepEqual([...stats.keys()].sort(), ['a', 'b', 'bad', 'c', 'd'])
  assert.equal(stats.get('bad')!.failures, 1)
  assert.equal(stats.get('bad')!.successes, 0)
  assert.equal(stats.get('a')!.successes, 1)
  assert.ok(stats.get('a')!.throughputBps > 0)
})

test('benchmark stops taking new sources once the signal aborts', async () => {
  const controller = new AbortController()
  let calls = 0
  const fetchFn = (async () => {
    calls++
    controller.abort()
    return new Response(body([2 * MiB]), { status: 206, headers: range206 })
  }) as unknown as typeof fetch
  const results = await benchmarkSources(
    ['a', 'b', 'c'].map(source),
    new Map(),
    { ...opts(), concurrency: 1, signal: controller.signal },
    fetchFn
  )
  assert.equal(calls, 1, 'no new probe after the abort')
  assert.deepEqual(results, [], 'the probe in flight when it aborted is not reported either')
})

test('probes cut short by the caller abort record nothing (they say nothing about the mirrors)', async () => {
  const controller = new AbortController()
  const fetchFn = ((_url: string, init: RequestInit) => {
    controller.abort()
    return Promise.reject(init.signal?.reason ?? new Error('aborted'))
  }) as unknown as typeof fetch
  const stats = new Map<string, HostStats>()
  await benchmarkSources(
    ['a', 'b'].map(source),
    stats,
    { ...opts(), concurrency: 2, signal: controller.signal },
    fetchFn
  )
  assert.equal(stats.size, 0)
})

test('a probe never follows a redirect (it could point anywhere, including the local network)', async () => {
  let redirectMode: string | undefined
  const fetchFn = (async (_url: string, init: RequestInit) => {
    redirectMode = init.redirect
    return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:6379/' } })
  }) as unknown as typeof fetch
  const r = await probeSource(source('a'), opts(), fetchFn)
  assert.equal(redirectMode, 'manual')
  assert.equal(!r.ok && r.reason, 'HTTP 302 (redirect not followed)')
})
