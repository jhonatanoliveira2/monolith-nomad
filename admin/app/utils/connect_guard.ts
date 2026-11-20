/**
 * Connect guard: a loopback-only CONNECT proxy that aria2c is pointed at (`--all-proxy`) whenever it downloads
 * from metalink mirrors.
 *
 * aria2c resolves DNS and follows redirects on its own, and has no option to vet the address it connects to, so
 * a compromised mirror (or DNS answer) could make it reach the server's own network. Through this proxy every
 * connection aria2c opens, redirects included, is checked where it happens:
 *   - only CONNECT is served (TLS stays end to end; aria2c still verifies certificates), so a redirect to an
 *     http:// URL is refused;
 *   - only port 443 of a public hostname (host_safety.isPublicHostname);
 *   - the guard resolves the name itself and refuses it if ANY address is not public, then connects to the
 *     address it checked (no second lookup that DNS rebinding could change).
 *
 * The original URL never goes through the guard (it may legitimately be a LAN server), and neither do downloads
 * behind a proxy configured in the environment (see host_safety.proxyFromEnv).
 */
import http from 'node:http'
import net from 'node:net'
import { isPublicAddress, isPublicHostname, systemLookup, type LookupFn } from './host_safety.js'

export type ConnectGuard = { url: string; close: () => Promise<void> }

export type ConnectGuardOptions = {
  lookup?: LookupFn
  /** address policy (tests relax it to reach a local server) */
  allowAddress?: (address: string) => boolean
  allowPort?: (port: number) => boolean
  connectTimeoutMs?: number
}

const FORBIDDEN = 'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'

export async function startConnectGuard(options: ConnectGuardOptions = {}): Promise<ConnectGuard> {
  const lookup = options.lookup ?? systemLookup
  const allowAddress = options.allowAddress ?? isPublicAddress
  const allowPort = options.allowPort ?? ((port: number) => port === 443)
  const connectTimeoutMs = options.connectTimeoutMs ?? 15_000
  const sockets = new Set<net.Socket>()
  const track = (s: net.Socket) => {
    sockets.add(s)
    s.on('close', () => sockets.delete(s))
  }

  // plain proxied HTTP (GET http://...) is never served
  const server = http.createServer((_req, res) => {
    res.writeHead(403, { 'Connection': 'close', 'Content-Length': '0' }).end()
  })
  server.on('connection', track)

  server.on('connect', async (req: http.IncomingMessage, client: net.Socket, head: Buffer) => {
    client.on('error', () => {})
    const deny = () => {
      if (!client.destroyed) client.end(FORBIDDEN)
    }
    // host:port only; "[::1]:443" style literals do not match and are refused
    const target = /^([A-Za-z0-9.-]+):(\d{1,5})$/.exec(req.url ?? '')
    if (!target) return deny()
    const host = target[1].toLowerCase().replace(/\.$/, '')
    const port = Number(target[2])
    if (!allowPort(port) || !isPublicHostname(host)) return deny()

    let addresses: { address: string; family: number }[]
    try {
      addresses = await lookup(host)
    } catch {
      return deny()
    }
    if (addresses.length === 0 || !addresses.every((a) => allowAddress(a.address))) return deny()
    if (client.destroyed) return

    const upstream = net.connect({ host: addresses[0].address, port })
    track(upstream)
    upstream.setTimeout(connectTimeoutMs, () => upstream.destroy())
    upstream.once('connect', () => {
      upstream.setTimeout(0)
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length > 0) upstream.write(head)
      upstream.pipe(client)
      client.pipe(upstream)
    })
    upstream.on('error', () => {
      if (!client.destroyed) client.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n')
    })
    client.on('close', () => upstream.destroy())
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const { port } = server.address() as net.AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy()
        server.close(() => resolve())
      }),
  }
}
