/**
 * Mirror hosts come from a third-party list (the Kiwix metalink). Before a download is sent to one, the host
 * must be public: not an IP literal, not a local name, and resolving only to public addresses (no SSRF into
 * the server's own network, also not through a redirect or DNS rebinding: safeLookup checks at connect time).
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assertSafeMirrorRedirect,
  filterPublicMirrors,
  proxyFromEnv,
  isPublicAddress,
  isPublicHostname,
  isSafeMirrorUrl,
  safeLookup,
  type LookupFn,
} from '../../app/utils/host_safety.js'
import type { DownloadSource } from '../../app/utils/mirror_selection.js'

test('private, loopback, link-local, CGNAT, multicast and reserved addresses are not public', () => {
  for (const ip of [
    '10.0.0.1',
    '172.16.5.4',
    '172.31.255.255',
    '192.168.1.1',
    '127.0.0.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.1.2.3',
  ]) {
    assert.equal(isPublicAddress(ip), false, ip)
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '145.220.21.40', '172.32.0.1', '2001:4860:4860::8888']) {
    assert.equal(isPublicAddress(ip), true, ip)
  }
  assert.equal(isPublicAddress('not-an-ip'), false)
})

test('hostnames: IP literals, local names and single labels are refused', () => {
  for (const host of [
    '127.0.0.1',
    '8.8.8.8', // even a public IP literal: official mirrors are named hosts
    '[::1]',
    'localhost',
    'mirror.localhost',
    'nas.local',
    'db.internal',
    'mysql',
    '',
  ]) {
    assert.equal(isPublicHostname(host), false, host)
  }
  for (const host of ['ftp.nluug.nl', 'mirror.download.kiwix.org', 'dumps.wikimedia.org']) {
    assert.equal(isPublicHostname(host), true, host)
  }
})

test('mirror URLs must be https on the default port, without credentials, on a public hostname', () => {
  assert.equal(isSafeMirrorUrl('https://ftp.nluug.nl/pub/kiwix/a.zim'), true)
  assert.equal(isSafeMirrorUrl('https://ftp.nluug.nl:443/pub/kiwix/a.zim'), true)
  for (const url of [
    'http://ftp.nluug.nl/a.zim',
    'https://ftp.nluug.nl:8443/a.zim',
    'https://user:pass@ftp.nluug.nl/a.zim',
    'https://192.168.0.10/a.zim',
    'https://localhost/a.zim',
    'ftp://ftp.nluug.nl/a.zim',
    'not a url',
  ]) {
    assert.equal(isSafeMirrorUrl(url), false, url)
  }
})

const fakeLookup =
  (table: Record<string, string[]>): LookupFn =>
  async (host) => {
    const addresses = table[host]
    if (!addresses)
      throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: 'ENOTFOUND' })
    return addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))
  }

const mirror = (host: string): DownloadSource => ({
  url: `https://${host}/f.zim`,
  host,
  kind: 'mirror',
  location: null,
  priority: null,
})

test('mirrors resolving to a private address (DNS rebinding) or not resolving at all are dropped', async () => {
  const lookup = fakeLookup({
    'good.example.org': ['93.184.216.34', '2606:2800:220:1::1'],
    'rebind.example.org': ['93.184.216.34', '10.0.0.5'], // one private answer is enough to refuse it
    'meta.example.org': ['169.254.169.254'],
  })
  const origin: DownloadSource = { ...mirror('download.kiwix.org'), kind: 'origin' }
  const kept = await filterPublicMirrors(
    [
      mirror('good.example.org'),
      mirror('rebind.example.org'),
      mirror('meta.example.org'),
      mirror('gone.example.org'),
      origin,
    ],
    lookup
  )
  assert.deepEqual(
    kept.map((s) => s.host),
    ['good.example.org', 'download.kiwix.org'],
    'the origin is never filtered (it may be a LAN server the user chose)'
  )
})

test('safeLookup refuses a connection to a non-public address and passes public ones through', async () => {
  const resolve = (host: string) =>
    new Promise<{ err: NodeJS.ErrnoException | null; address?: string; family?: number }>((done) =>
      safeLookup(
        fakeLookup({ 'ok.example.org': ['93.184.216.34'], 'evil.example.org': ['127.0.0.1'] })
      )(host, {}, (err, address, family) => done({ err, address: address as string, family }))
    )
  const ok = await resolve('ok.example.org')
  assert.equal(ok.err, null)
  assert.equal(ok.address, '93.184.216.34')
  assert.equal(ok.family, 4)
  const evil = await resolve('evil.example.org')
  assert.match(String(evil.err?.message), /non-public address/)
  assert.equal(evil.err?.code, 'ENONPUBLIC')
})

test('safeLookup honours the all:true form used by happy-eyeballs connects', async () => {
  const result = await new Promise<unknown>((done) =>
    safeLookup(fakeLookup({ 'dual.example.org': ['93.184.216.34', '2606:2800:220:1::1'] }))(
      'dual.example.org',
      { all: true },
      (_err, addresses) => done(addresses)
    )
  )
  assert.deepEqual(result, [
    { address: '93.184.216.34', family: 4 },
    { address: '2606:2800:220:1::1', family: 6 },
  ])
})

test('IPv6 forms that embed a private IPv4 (NAT64, 6to4, Teredo) are not public', () => {
  for (const ip of [
    '64:ff9b::a00:1', // NAT64 of 10.0.0.1
    '64:ff9b::7f00:1', // NAT64 of 127.0.0.1
    '64:ff9b::a9fe:a9fe', // NAT64 of 169.254.169.254
    '2002:a00:1::1', // 6to4 of 10.0.0.1
    '2002:c0a8:101::1', // 6to4 of 192.168.1.1
    '2001:0:4136:e378:8000:63bf:3fff:fdd2', // Teredo
    '::ffff:7f00:1', // IPv4-mapped, hex form
  ]) {
    assert.equal(isPublicAddress(ip), false, ip)
  }
  // NAT64 of a public IPv4 stays usable on IPv6-only networks
  assert.equal(isPublicAddress('64:ff9b::808:808'), true)
  assert.equal(isPublicAddress('2002:808:808::1'), true)
})

test('a mirror redirect must keep the default https port', () => {
  assert.doesNotThrow(() =>
    assertSafeMirrorRedirect({ protocol: 'https:', hostname: 'cdn.example.org', port: '' })
  )
  assert.doesNotThrow(() =>
    assertSafeMirrorRedirect({ protocol: 'https:', hostname: 'cdn.example.org', port: 443 })
  )
  for (const port of ['6379', 8443, '22']) {
    assert.throws(
      () => assertSafeMirrorRedirect({ protocol: 'https:', hostname: 'cdn.example.org', port }),
      /only public https hosts/
    )
  }
  assert.throws(() => assertSafeMirrorRedirect({ protocol: 'http:', hostname: 'cdn.example.org' }))
  assert.throws(() => assertSafeMirrorRedirect({ protocol: 'https:', hostname: '10.0.0.1' }))
})

test('a proxy in the environment is detected (connect-time checks would vet the proxy, not the mirror)', () => {
  assert.equal(proxyFromEnv({}), null)
  assert.equal(proxyFromEnv({ HTTPS_PROXY: 'http://10.0.0.1:3128' }), 'http://10.0.0.1:3128')
  assert.equal(proxyFromEnv({ https_proxy: 'http://proxy:8080' }), 'http://proxy:8080')
  assert.equal(proxyFromEnv({ ALL_PROXY: 'socks5://p:1080' }), 'socks5://p:1080')
  assert.equal(proxyFromEnv({ HTTPS_PROXY: '  ' }), null)
})
