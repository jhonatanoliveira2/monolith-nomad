/**
 * The connect guard is the loopback CONNECT proxy aria2c is pointed at when it downloads from metalink mirrors.
 * aria2c has no hook to vet the address it connects to (and follows redirects on its own), so every connection
 * goes through this proxy: only CONNECT to port 443 of a public hostname resolving to public addresses is
 * tunnelled; plain-http requests (e.g. a redirect to http://169.254.169.254/) and anything private are refused.
 */
import * as assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import net from 'node:net'
import { startConnectGuard, type ConnectGuard } from '../../app/utils/connect_guard.js'
import type { LookupFn } from '../../app/utils/host_safety.js'

const table: Record<string, string[]> = {
  'mirror.example.org': ['93.184.216.34'],
  'evil.example.org': ['10.0.0.8'],
  'mixed.example.org': ['93.184.216.34', '127.0.0.1'],
  'empty.example.org': [],
}
const lookup: LookupFn = async (host) => {
  const a = table[host]
  if (!a) throw Object.assign(new Error(`ENOTFOUND ${host}`), { code: 'ENOTFOUND' })
  return a.map((address) => ({ address, family: 4 }))
}

/** Sends a raw request to the guard and returns the first response line. */
function ask(guard: ConnectGuard, request: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { port } = new URL(guard.url)
    const socket = net.connect(Number(port), '127.0.0.1', () => socket.write(request))
    let data = ''
    socket.on('data', (chunk) => {
      data += chunk.toString('latin1')
      if (data.includes('\r\n')) {
        socket.destroy()
        resolve(data.split('\r\n')[0])
      }
    })
    socket.on('error', reject)
    socket.on('close', () => resolve(data.split('\r\n')[0]))
  })
}

let guard: ConnectGuard
before(async () => {
  guard = await startConnectGuard({ lookup })
})
after(async () => {
  await guard.close()
})

test('the guard listens on loopback only', () => {
  assert.match(guard.url, /^http:\/\/127\.0\.0\.1:\d+$/)
})

test('plain-http proxying (a redirect to an http:// URL) is refused', async () => {
  const line = await ask(
    guard,
    'GET http://169.254.169.254/latest/meta-data/ HTTP/1.1\r\nHost: 169.254.169.254\r\n\r\n'
  )
  assert.match(line, /^HTTP\/1\.1 403/)
})

for (const [target, why] of [
  ['evil.example.org:443', 'resolves to a private address'],
  ['mixed.example.org:443', 'one private answer is enough'],
  ['empty.example.org:443', 'no address'],
  ['gone.example.org:443', 'does not resolve'],
  ['mirror.example.org:6379', 'not port 443'],
  ['127.0.0.1:443', 'IP literal'],
  ['localhost:443', 'local name'],
  ['[::1]:443', 'IPv6 literal'],
]) {
  test(`CONNECT ${target} is refused (${why})`, async () => {
    const line = await ask(guard, `CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`)
    assert.match(line, /^HTTP\/1\.1 403/)
  })
}

test('an allowed CONNECT is tunnelled to the address the guard resolved itself', async () => {
  // a local "mirror": the address policy is relaxed for the test, the port and hostname rules are not
  const upstream = net.createServer((s) => s.end('hello through the tunnel'))
  await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', () => r()))
  const upstreamPort = (upstream.address() as net.AddressInfo).port
  const local = await startConnectGuard({
    lookup: async () => [{ address: '127.0.0.1', family: 4 }],
    allowAddress: () => true,
    allowPort: (p) => p === upstreamPort,
  })
  try {
    const { port } = new URL(local.url)
    const reply = await new Promise<string>((resolve, reject) => {
      const s = net.connect(Number(port), '127.0.0.1', () =>
        s.write(
          `CONNECT mirror.example.org:${upstreamPort} HTTP/1.1\r\nHost: mirror.example.org\r\n\r\n`
        )
      )
      let data = ''
      s.on('data', (c) => (data += c.toString()))
      s.on('end', () => resolve(data))
      s.on('error', reject)
    })
    assert.match(reply, /^HTTP\/1\.1 200 Connection Established\r\n\r\n/)
    assert.ok(reply.endsWith('hello through the tunnel'))
  } finally {
    await local.close()
    await new Promise<void>((r) => upstream.close(() => r()))
  }
})
