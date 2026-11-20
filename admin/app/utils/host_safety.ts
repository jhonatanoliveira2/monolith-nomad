/**
 * Safety checks for third-party download hosts (the mirrors listed by the Kiwix metalink).
 *
 * A mirror must be a public, named https host: no IP literals, no local names, and every address it resolves to
 * must be public, so a tampered or compromised mirror list cannot point the server at its own network
 * (database, Redis, Docker socket proxies, cloud metadata at 169.254.169.254). The checks run three times:
 * when the metalink is parsed (isSafeMirrorUrl), when the sources are resolved (filterPublicMirrors, DNS), and
 * at connect time for native mirror downloads (safeLookup), which also covers redirects and DNS rebinding.
 *
 * The ORIGINAL url is never filtered here: it is what the user or a catalog asked for, and may legitimately be a
 * server on the LAN.
 */
import { BlockList, isIP } from 'node:net'
import dns from 'node:dns'
import type { LookupFunction } from 'node:net'
import type { DownloadSource } from './mirror_selection.js'

const NON_PUBLIC = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // RFC 1918
  ['100.64.0.0', 10], // CGNAT (RFC 6598)
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // RFC 1918
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // RFC 1918
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
] as const) {
  NON_PUBLIC.addSubnet(net, prefix, 'ipv4')
}
for (const [net, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  NON_PUBLIC.addSubnet(net, prefix, 'ipv6')
}

/** The 16 bytes of an IPv6 address (with "::" and an embedded dotted IPv4 expanded), or null. */
function ipv6Bytes(ip: string): number[] | null {
  if (isIP(ip) !== 6) return null
  let text = ip.toLowerCase()
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text)
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number)
    text =
      text.slice(0, dotted.index) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head, tail] = text.includes('::') ? text.split('::') : [text, null]
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups =
    tail === null ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
  if (groups.length !== 8) return null
  return groups.flatMap((g) => {
    const n = Number.parseInt(g, 16)
    return [n >> 8, n & 0xff]
  })
}

/**
 * True for a public unicast IPv4/IPv6 address. IPv6 forms that carry an IPv4 address are judged by that IPv4:
 * IPv4-mapped (::ffff:a.b.c.d, any notation), NAT64 (64:ff9b::/96) and 6to4 (2002::/16). Teredo (2001::/32)
 * hides the real address and is refused.
 */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) return false
  if (family === 4) return !NON_PUBLIC.check(address, 'ipv4')
  const b = ipv6Bytes(address)
  if (!b) return false
  const v4 = (o: number) => `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`
  const zero = (from: number, to: number) => b.slice(from, to).every((x) => x === 0)
  if (zero(0, 10) && b[10] === 0xff && b[11] === 0xff) return isPublicAddress(v4(12)) // ::ffff:0:0/96
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && zero(4, 12))
    return isPublicAddress(v4(12)) // NAT64 64:ff9b::/96
  if (b[0] === 0x20 && b[1] === 0x02) return isPublicAddress(v4(2)) // 6to4 2002::/16
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) return false // Teredo 2001::/32
  return !NON_PUBLIC.check(address, 'ipv6')
}

const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.arpa']

/** A public DNS name: not an IP literal, not localhost / a local suffix, and with at least one dot. */
export function isPublicHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host || host.startsWith('[') || isIP(host) !== 0) return false
  if (host === 'localhost' || LOCAL_SUFFIXES.some((s) => host.endsWith(s))) return false
  if (!host.includes('.')) return false
  return /^[a-z0-9.-]+$/.test(host)
}

/** https, default port, no user:password@, public hostname. */
export function isSafeMirrorUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    (url.port === '' || url.port === '443') &&
    url.username === '' &&
    url.password === '' &&
    isPublicHostname(url.hostname)
  )
}

export type LookupFn = (hostname: string) => Promise<{ address: string; family: number }[]>

export const systemLookup: LookupFn = (hostname) => dns.promises.lookup(hostname, { all: true })

/**
 * Keep the sources that are safe to contact: mirrors must pass isSafeMirrorUrl and resolve only to public
 * addresses (one private answer is enough to drop the host); the origin is always kept.
 */
export async function filterPublicMirrors(
  sources: DownloadSource[],
  lookup: LookupFn = systemLookup
): Promise<DownloadSource[]> {
  const verdicts = await Promise.all(
    sources.map(async (s) => {
      if (s.kind !== 'mirror') return true
      if (!isSafeMirrorUrl(s.url)) return false
      try {
        const addresses = await lookup(new URL(s.url).hostname.replace(/\.$/, ''))
        return addresses.length > 0 && addresses.every((a) => isPublicAddress(a.address))
      } catch {
        return false
      }
    })
  )
  return sources.filter((_, i) => verdicts[i])
}

/**
 * A `lookup` for http(s) requests (axios / http.request option) that refuses non-public addresses at connect
 * time. Because it runs for every connection, it also covers redirects and DNS rebinding between the check in
 * filterPublicMirrors and the actual download.
 */
export function safeLookup(lookup: LookupFn = systemLookup): LookupFunction {
  return (hostname, options, callback) => {
    const all = Boolean((options as { all?: boolean } | undefined)?.all)
    lookup(hostname)
      .then((addresses) => {
        const blocked = addresses.find((a) => !isPublicAddress(a.address))
        if (addresses.length === 0 || blocked) {
          const error: NodeJS.ErrnoException = new Error(
            `Refusing to connect to ${hostname}: it resolves to a non-public address${blocked ? ` (${blocked.address})` : ''}`
          )
          error.code = 'ENONPUBLIC'
          callback(error, all ? [] : '', 0)
          return
        }
        if (all) callback(null, addresses as never)
        else callback(null, addresses[0].address, addresses[0].family)
      })
      .catch((error) => callback(error, all ? [] : '', 0))
  }
}

/** follow-redirects `beforeRedirect` hook for mirror downloads: a redirect may only go to a safe https URL. */
export function assertSafeMirrorRedirect(options: {
  protocol?: string
  hostname?: string
  port?: string | number | null
  href?: string
}) {
  const target = options.href ?? `${options.protocol ?? ''}//${options.hostname ?? ''}`
  const port = options.port === undefined || options.port === null ? '' : String(options.port)
  if (
    options.protocol !== 'https:' ||
    (port !== '' && port !== '443') ||
    !isPublicHostname(options.hostname ?? '')
  ) {
    throw new Error(`Refusing a mirror redirect to ${target}: only public https hosts are allowed`)
  }
}

/**
 * The proxy configured in the environment (HTTPS_PROXY / HTTP_PROXY / ALL_PROXY, either case), or null. Behind a
 * proxy, a connect-time check would vet the proxy's address instead of the mirror's, so the callers skip it there
 * (the URL and DNS checks of the mirror list still apply).
 */
export function proxyFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  for (const name of [
    'HTTPS_PROXY',
    'https_proxy',
    'HTTP_PROXY',
    'http_proxy',
    'ALL_PROXY',
    'all_proxy',
  ]) {
    const value = env[name]?.trim()
    if (value) return value
  }
  return null
}
