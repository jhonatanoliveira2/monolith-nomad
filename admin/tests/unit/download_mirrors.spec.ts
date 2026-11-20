import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { computeBackoffDelay, sleep } from '../../app/utils/backoff.js'
import { parseMetalink } from '../../app/utils/metalink.js'
import {
  DEFAULT_DOWNLOAD_PREFERENCES,
  preferencesFromEnv,
} from '../../app/utils/download_preferences.js'
import {
  connectionsPerServer,
  selectAria2Sources,
  locationTier,
  rankSources,
  updateHostStats,
  type DownloadSource,
  type HostStats,
} from '../../app/utils/mirror_selection.js'
import { buildAria2Args, buildAria2Input, parseAria2Readout } from '../../app/utils/aria2.js'
import { resolveSources } from '../../app/utils/smart_download.js'

// Trimmed copy of a real MirrorBrain answer from download.kiwix.org for a client in Brazil (20/11/2026):
// no Brazilian or South American mirror exists, BR is "handled" by North American mirrors first.
const META4 = `<?xml version="1.0" encoding="UTF-8"?>
<metalink xmlns="urn:ietf:params:xml:ns:metalink">
  <generator>MirrorBrain/2.19.0</generator>
  <file name="zimgit-medicine_en_2024-08.zim">
    <size>70179585</size>
    <hash type="md5">8d4376e557ce50e2a1528da0e85a6253</hash>
    <hash type="sha-256">a86c31b93e9800aae2cd812ef18cbf9c087a7537784c62fbc259db7f9f9d18c0</hash>
    <pieces length="4194304" type="sha-1"><hash>eb14f1bb76c1df6066a566ca36d6329b0a664e2d</hash></pieces>
    <!-- Mirrors which handle this country (BR): -->
    <url location="us" priority="1">https://ny.mirror.driftle.ss/kiwix/zim/other/zimgit-medicine_en_2024-08.zim</url>
    <url location="ca" priority="3">https://mirror-sites-ca.mblibrary.info/mirror-sites/download.kiwix.org/zim/other/zimgit-medicine_en_2024-08.zim</url>
    <url location="nl" priority="4">https://ftp.nluug.nl/pub/kiwix/zim/other/zimgit-medicine_en_2024-08.zim</url>
    <url location="dk" priority="6">https://mirrors.dotsrc.org/kiwix/zim/other/zimgit-medicine_en_2024-08.zim</url>
    <url location="de" priority="8">http://insecure.example.org/kiwix/zim/other/zimgit-medicine_en_2024-08.zim</url>
  </file>
</metalink>`

// ── backoff ──

test('backoff grows exponentially up to the cap; full jitter stays inside [0, cap]', () => {
  const opts = { baseMs: 1000, maxMs: 10_000, jitter: 'none' as const }
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((n) => computeBackoffDelay(n, opts)),
    [1000, 2000, 4000, 8000, 10_000, 10_000]
  )
  assert.equal(
    computeBackoffDelay(3, { baseMs: 1000, maxMs: 10_000 }, () => 0.5),
    2000
  )
  assert.equal(
    computeBackoffDelay(3, { baseMs: 1000, maxMs: 10_000 }, () => 0),
    0
  )
  assert.ok(computeBackoffDelay(10, { baseMs: 1000, maxMs: 10_000 }, () => 0.999) < 10_000)
})

test('sleep rejects as soon as the signal aborts', async () => {
  const ac = new AbortController()
  const p = sleep(60_000, ac.signal)
  ac.abort()
  await assert.rejects(p, /aborted/)
})

// ── metalink ──

test('the Kiwix metalink gives name, size, SHA-256 and the https mirrors in MirrorBrain order', () => {
  const ml = parseMetalink(META4)
  assert.ok(ml)
  assert.equal(ml.name, 'zimgit-medicine_en_2024-08.zim')
  assert.equal(ml.size, 70179585)
  assert.equal(ml.sha256, 'a86c31b93e9800aae2cd812ef18cbf9c087a7537784c62fbc259db7f9f9d18c0')
  assert.deepEqual(
    ml.urls.map((u) => [u.location, u.priority]),
    [
      ['us', 1],
      ['ca', 3],
      ['nl', 4],
      ['dk', 6],
    ],
    'the plain-http mirror is dropped'
  )
})

test('an invalid or unrelated document is not a metalink', () => {
  assert.equal(parseMetalink(''), null)
  assert.equal(parseMetalink('<html><body>502</body></html>'), null)
  assert.equal(
    parseMetalink('<metalink><file name="../etc/passwd"><size>1</size></file></metalink>'),
    null
  )
  const noHash = parseMetalink(
    '<metalink><file name="a.zim"><hash type="sha-256">nothex</hash></file></metalink>'
  )
  assert.equal(noHash?.sha256, null)
})

/** Fixture mirrors resolve to a public address (no real DNS in unit tests). */
const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }]

test('resolveSources uses the metalink only for download.kiwix.org and only when it describes the same file', async () => {
  const url = 'https://download.kiwix.org/zim/other/zimgit-medicine_en_2024-08.zim'
  let asked = ''
  const r = await resolveSources(
    url,
    { useMetalink: true },
    async (u) => ((asked = u), META4),
    undefined,
    publicLookup
  )
  assert.equal(asked, url + '.meta4')
  assert.equal(r.viaMetalink, true)
  assert.equal(r.sha256, 'a86c31b93e9800aae2cd812ef18cbf9c087a7537784c62fbc259db7f9f9d18c0')
  assert.equal(r.sources.at(-1)?.kind, 'origin', 'the original URL stays as the last resort')
  assert.equal(r.sources.filter((s) => s.kind === 'mirror').length, 4)

  const other = await resolveSources(
    'https://download.kiwix.org/zim/other/another_2024-08.zim',
    { useMetalink: true },
    async () => META4,
    undefined,
    publicLookup
  )
  assert.equal(other.viaMetalink, false, 'metalink for a different file is ignored')

  let fetched = false
  const gh = await resolveSources(
    'https://github.com/x/y/raw/main/a.zim',
    { useMetalink: true },
    async () => ((fetched = true), META4),
    undefined,
    publicLookup
  )
  assert.equal(fetched, false, 'no metalink request to untrusted hosts')
  assert.equal(gh.sources.length, 1)

  const off = await resolveSources(
    url,
    { useMetalink: false },
    async () => META4,
    undefined,
    publicLookup
  )
  assert.equal(off.sources.length, 1)

  const down = await resolveSources(
    url,
    { useMetalink: true },
    async () => null,
    undefined,
    publicLookup
  )
  assert.equal(down.sources.length, 1, 'metalink unavailable: plain download')
})

test('the metalink drops mirror URLs that are not public https hosts', () => {
  const unsafe = [
    'https://192.168.0.5/zim/x.zim',
    'https://localhost/zim/x.zim',
    'https://user:pass@ftp.example.org/zim/x.zim',
    'https://mirror.example.org:8443/zim/x.zim',
    'https://nas.local/zim/x.zim',
  ]
  const extra = unsafe.map((u) => `    <url location="br" priority="1">${u}</url>`).join('\n')
  const ml = parseMetalink(META4.replace('</file>', `${extra}\n  </file>`))!
  assert.equal(ml.urls.length, 4, 'the four real https mirrors are kept')
  for (const u of unsafe) {
    const host = new URL(u).hostname
    assert.ok(!ml.urls.some((x) => new URL(x.url).hostname === host), u)
  }
})

test('resolveSources drops mirrors whose DNS points into a private network', async () => {
  const url = 'https://download.kiwix.org/zim/other/zimgit-medicine_en_2024-08.zim'
  const r = await resolveSources(
    url,
    { useMetalink: true },
    async () => META4,
    undefined,
    async (host) =>
      host === 'ftp.nluug.nl'
        ? [{ address: '10.0.0.7', family: 4 }]
        : [{ address: '93.184.216.34', family: 4 }]
  )
  assert.ok(!r.sources.some((s) => s.host === 'ftp.nluug.nl'), 'rebound mirror dropped')
  assert.ok(r.sources.filter((s) => s.kind === 'mirror').length >= 3)
  assert.equal(r.sources.at(-1)?.kind, 'origin')
})

test('a metalink without a SHA-256 brings no mirrors: nothing could verify what they serve', async () => {
  const url = 'https://download.kiwix.org/zim/other/zimgit-medicine_en_2024-08.zim'
  const noSha = META4.replace(/\s*<hash type="sha-256">[^<]*<\/hash>/, '')
  assert.ok(!noSha.includes('sha-256'), 'fixture without the sha-256 hash')
  const r = await resolveSources(
    url,
    { useMetalink: true },
    async () => noSha,
    undefined,
    publicLookup
  )
  assert.deepEqual(
    r.sources.map((s) => s.kind),
    ['origin']
  )
  assert.equal(r.sha256, null)
  assert.equal(r.viaMetalink, false)
})

// ── ranking ──

const prefs = { country: 'br', region: 'sa', benchmarkTtlMs: 60_000 }
const src = (
  host: string,
  location: string | null,
  priority: number | null,
  kind: 'mirror' | 'origin' = 'mirror'
): DownloadSource => ({
  url: `https://${host}/f.zim`,
  host,
  kind,
  location,
  priority,
})
const measured = (bps: number, ttfbMs = 100, recentFailures = 0): HostStats => ({
  throughputBps: bps,
  ttfbMs,
  successes: 1,
  failures: recentFailures,
  recentFailures,
  measuredAt: 1000,
})

test('location tiers: same country, same region, elsewhere', () => {
  assert.equal(locationTier('br', prefs), 0)
  assert.equal(locationTier('ar', prefs), 1)
  assert.equal(locationTier('us', prefs), 2)
  assert.equal(locationTier(null, prefs), 2)
})

test('a measured faraway mirror beats a nearer but slower one (distance is not the criterion)', () => {
  const sources = [
    src('br.example', 'br', 1),
    src('nl.example', 'nl', 4),
    src('download.kiwix.org', null, null, 'origin'),
  ]
  const stats = new Map([
    ['br.example', measured(1 * 1024 * 1024, 20)],
    ['nl.example', measured(20 * 1024 * 1024, 220)],
  ])
  assert.deepEqual(
    rankSources(sources, stats, prefs, 2000).map((s) => s.host),
    ['nl.example', 'br.example', 'download.kiwix.org']
  )
})

test('without measurements, geography then MirrorBrain priority; failing mirrors and the origin last', () => {
  const sources = [
    src('download.kiwix.org', null, null, 'origin'),
    src('us.example', 'us', 1),
    src('cl.example', 'cl', 7),
    src('br.example', 'br', 9),
    src('dead.example', 'br', 2),
    src('dk.example', 'dk', 6),
  ]
  const stats = new Map([['dead.example', updateHostStats(undefined, { ok: false }, 1000)]])
  assert.deepEqual(
    rankSources(sources, stats, prefs, 2000).map((s) => s.host),
    ['br.example', 'cl.example', 'us.example', 'dk.example', 'dead.example', 'download.kiwix.org']
  )
})

test('stale measurements are ignored; a recent failure halves the score', () => {
  const sources = [src('a.example', 'us', 1), src('b.example', 'us', 2)]
  const stale = new Map([
    ['a.example', { ...measured(1), measuredAt: 0 }],
    ['b.example', { ...measured(100), measuredAt: 90_000 }],
  ])
  assert.deepEqual(
    rankSources(sources, stale, prefs, 100_000).map((s) => s.host),
    ['b.example', 'a.example']
  )

  const failing = new Map([
    ['a.example', measured(150, 100, 1)],
    ['b.example', measured(100)],
  ])
  assert.deepEqual(
    rankSources(sources, failing, prefs, 2000).map((s) => s.host),
    ['b.example', 'a.example']
  )
})

test('host statistics are exponentially weighted and a success clears recent failures', () => {
  let s = updateHostStats(undefined, { ok: true, throughputBps: 100, ttfbMs: 50 }, 1)
  s = updateHostStats(s, { ok: false }, 2)
  assert.equal(s.recentFailures, 1)
  s = updateHostStats(s, { ok: true, throughputBps: 300, ttfbMs: 150 }, 3)
  assert.equal(s.throughputBps, 200)
  assert.equal(s.ttfbMs, 100)
  assert.equal(s.recentFailures, 0)
  assert.equal(s.successes, 2)
  assert.equal(s.failures, 1)
})

test('aria2c only gets measured mirrors within half of the best score; origin only as a last resort', () => {
  const sources = [
    src('fast.example', 'us', 1),
    src('ok.example', 'nl', 4),
    src('slow.example', 'us', 2),
    src('dead.example', 'ca', 3),
    src('new.example', 'br', 5),
    src('download.kiwix.org', null, null, 'origin'),
  ]
  const stats = new Map<string, HostStats>([
    ['fast.example', measured(10_000_000)],
    ['ok.example', measured(6_000_000)],
    ['slow.example', measured(800_000)],
    ['dead.example', updateHostStats(undefined, { ok: false }, 1000)],
  ])
  const ranked = rankSources(sources, stats, prefs, 2000)
  assert.deepEqual(
    selectAria2Sources(ranked, stats, prefs.benchmarkTtlMs, 2000).map((s) => s.host),
    ['fast.example', 'ok.example']
  )
  // nothing measured healthy: the ranked mirrors, without the origin (download.kiwix.org redirects to an
  // arbitrary mirror aria2c cannot apply per-host limits to; it stays the native engine's last resort)
  assert.deepEqual(
    selectAria2Sources(ranked, new Map(), prefs.benchmarkTtlMs, 2000).map((s) => s.host),
    ranked.filter((s) => s.kind === 'mirror').map((s) => s.host)
  )
  // only the origin: aria2c gets it
  const originOnly = [src('download.kiwix.org', null, null, 'origin')]
  assert.deepEqual(
    selectAria2Sources(originOnly, new Map(), prefs.benchmarkTtlMs, 2000).map((s) => s.host),
    ['download.kiwix.org']
  )
})

test('published per-host connection limits lower the per-server connections', () => {
  assert.equal(connectionsPerServer(['mirrors.dotsrc.org'], 4), 4)
  assert.equal(connectionsPerServer(['mirrors.dotsrc.org', 'dumps.wikimedia.org'], 4), 1)
  // download.kiwix.org redirects to any mirror, dumps.wikimedia.org included: 1 connection
  assert.equal(connectionsPerServer(['download.kiwix.org'], 4), 1)
})

// ── preferences ──

test('preferences default to São Paulo / Brazil and validate every variable', () => {
  assert.deepEqual(preferencesFromEnv({}), DEFAULT_DOWNLOAD_PREFERENCES)
  assert.equal(DEFAULT_DOWNLOAD_PREFERENCES.country, 'br')
  assert.equal(DEFAULT_DOWNLOAD_PREFERENCES.region, 'sa')
  const p = preferencesFromEnv({
    DOWNLOAD_ENGINE: 'NATIVE',
    DOWNLOAD_LOCATION_COUNTRY: 'PT',
    DOWNLOAD_LOCATION_REGION: 'eu',
    DOWNLOAD_USE_METALINK: 'false',
    DOWNLOAD_MIRROR_BENCHMARK: '0',
    DOWNLOAD_MAX_MIRRORS: '99',
    DOWNLOAD_ARIA2_SPLIT: '0',
  })
  assert.equal(p.engine, 'native')
  assert.equal(p.country, 'pt')
  assert.equal(p.region, 'eu')
  assert.equal(p.useMetalink, false)
  assert.equal(p.benchmark, false)
  assert.equal(p.maxMirrors, 10)
  assert.equal(p.aria2Split, 1)
  const bad = preferencesFromEnv({
    DOWNLOAD_ENGINE: 'wget',
    DOWNLOAD_LOCATION_COUNTRY: 'brazil',
    DOWNLOAD_LOCATION_REGION: 'xx',
  })
  assert.equal(bad.engine, 'auto')
  assert.equal(bad.country, 'br')
  assert.equal(bad.region, 'sa')
})

test('boolean preferences accept yes/no/on/off and fall back to the default on anything else', () => {
  const on = preferencesFromEnv({ DOWNLOAD_USE_METALINK: 'on', DOWNLOAD_MIRROR_BENCHMARK: 'YES' })
  assert.equal(on.useMetalink, true)
  assert.equal(on.benchmark, true)
  const off = preferencesFromEnv({ DOWNLOAD_USE_METALINK: 'off', DOWNLOAD_MIRROR_BENCHMARK: 'no' })
  assert.equal(off.useMetalink, false)
  assert.equal(off.benchmark, false)
  // a typo must not silently turn a feature off: it keeps the default
  const typo = preferencesFromEnv({
    DOWNLOAD_USE_METALINK: 'ture',
    DOWNLOAD_MIRROR_BENCHMARK: 'maybe',
  })
  assert.equal(typo.useMetalink, DEFAULT_DOWNLOAD_PREFERENCES.useMetalink)
  assert.equal(typo.benchmark, DEFAULT_DOWNLOAD_PREFERENCES.benchmark)
  const nan = preferencesFromEnv({ DOWNLOAD_MAX_MIRRORS: 'lots' })
  assert.equal(nan.maxMirrors, DEFAULT_DOWNLOAD_PREFERENCES.maxMirrors)
})

test('the DOWNLOAD_* variables are plain optional strings in start/env.ts (an invalid value must not stop the app)', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = await readFile(new URL('../../start/env.ts', import.meta.url), 'utf8')
  const entries = [...source.matchAll(/^\s+(DOWNLOAD_[A-Z0-9_]+):\s*(.+?),?$/gm)]
  assert.ok(entries.length >= 10, 'DOWNLOAD_* entries found')
  for (const [, name, schema] of entries) {
    assert.equal(
      schema.replace(/,$/, ''),
      'Env.schema.string.optional()',
      `${name} is validated by preferencesFromEnv, not by the schema`
    )
  }
})

// ── aria2 (pure parts) ──

test('aria2 input puts mirrors on one line and options below; newlines cannot inject options', () => {
  const input = buildAria2Input({
    uris: ['https://a/f.zim', 'https://b/f.zim'],
    dir: '/storage/zim',
    out: 'f.zim.tmp',
    sha256: 'ab'.repeat(32),
    headers: { 'Authorization': 'Bearer x\n  dir=/etc', 'Bad Header': 'v' },
    split: 8,
    maxConnectionsPerServer: 2,
    timeoutSeconds: 60,
  })
  const lines = input.trimEnd().split('\n')
  assert.equal(lines[0], 'https://a/f.zim\thttps://b/f.zim')
  assert.ok(lines.includes('  dir=/storage/zim'))
  assert.ok(lines.includes('  out=f.zim.tmp'))
  assert.ok(lines.includes(`  checksum=sha-256=${'ab'.repeat(32)}`))
  assert.ok(
    lines.includes('  header=Authorization: Bearer x  dir=/etc'),
    'newline removed, still one header line'
  )
  assert.equal(lines.filter((l) => l.startsWith('  dir=')).length, 1)
  assert.ok(!input.includes('Bad Header'), 'invalid header names are dropped')
})

test('aria2 arguments never carry headers or URIs (they go through stdin)', () => {
  const args = buildAria2Args({
    uris: ['https://secret/f'],
    dir: '/d',
    out: 'o',
    headers: { Authorization: 'Bearer s' },
    split: 4,
    maxConnectionsPerServer: 2,
    timeoutSeconds: 60,
  })
  assert.ok(args.includes('--input-file=-'))
  assert.ok(args.includes('--split=4'))
  assert.ok(args.includes('--max-connection-per-server=2'))
  assert.ok(args.includes('--human-readable=false'))
  assert.ok(!args.join(' ').includes('Bearer'))
  assert.ok(!args.join(' ').includes('secret'))
})

test('aria2 goes through the connect guard only when given one', () => {
  const base = {
    uris: ['https://m/f'],
    dir: '/d',
    out: 'o',
    split: 1,
    maxConnectionsPerServer: 1,
    timeoutSeconds: 60,
  }
  assert.ok(
    buildAria2Args({ ...base, proxy: 'http://127.0.0.1:41234' }).includes(
      '--all-proxy=http://127.0.0.1:41234'
    )
  )
  assert.ok(!buildAria2Args(base).some((a) => a.startsWith('--all-proxy')))
})

test('aria2 ignores local config and .netrc and never follows metalinks or torrents it downloads', () => {
  const args = buildAria2Args({
    uris: ['https://m/f'],
    dir: '/d',
    out: 'o',
    split: 1,
    maxConnectionsPerServer: 1,
    timeoutSeconds: 60,
  })
  for (const flag of [
    '--no-conf=true',
    '--no-netrc=true',
    '--follow-metalink=false',
    '--follow-torrent=false',
  ]) {
    assert.ok(args.includes(flag), `missing ${flag}`)
  }
})

test('aria2 readout lines are parsed in bytes', () => {
  assert.deepEqual(parseAria2Readout('[#43f45f 12582912/29360128(42%) CN:4 DL:6291456 ETA:2s]'), {
    downloadedBytes: 12582912,
    totalBytes: 29360128,
    connections: 4,
    speedBps: 6291456,
  })
  assert.deepEqual(parseAria2Readout('[#2089b0 0B/0B CN:1 DL:0B]'), {
    downloadedBytes: 0,
    totalBytes: 0,
    connections: 1,
    speedBps: 0,
  })
  assert.equal(parseAria2Readout('*** Download Progress Summary ***'), null)
})
