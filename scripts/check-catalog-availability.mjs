#!/usr/bin/env node
/**
 * Checks, over the network, that every file in the content manifests still exists upstream.
 *
 * For Kiwix files it asks the official MirrorBrain metalink (`<url>.meta4`), which only exists for files
 * that are really published and carries the exact size, the SHA-256 the app verifies downloads against,
 * and the mirror list the app falls back to. Other hosts get a HEAD request.
 *
 * Usage (repository root):  node scripts/check-catalog-availability.mjs
 * Exit code 1 when any file is missing, has no published SHA-256, no mirror, or a size more than 5 % away
 * from the manifest's size_mb (at least 1 MB of slack, since size_mb is rounded).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const load = (f) => JSON.parse(readFileSync(path.join(ROOT, 'collections', f), 'utf8'))
const KIWIX_HOSTS = new Set(['download.kiwix.org', 'lb.download.kiwix.org'])
const CONCURRENCY = 6
const TIMEOUT_MS = 60_000

const entries = new Map()
for (const c of load('kiwix-categories.json').categories)
  for (const t of c.tiers)
    for (const r of t.resources) entries.set(r.url, { id: r.id, size_mb: r.size_mb, language: r.language, type: r.type })
for (const o of load('wikipedia.json').options)
  if (o.url) entries.set(o.url, { id: `wikipedia:${o.id}`, size_mb: o.size_mb, language: o.language })
// Library PDFs/EPUBs (collections/library.json). ZIM entries there reuse kiwix-categories ids, checked above.
const VERIFY_HASHES = process.argv.includes('--hashes')
for (const item of load('library.json').items)
  for (const f of item.files)
    if (f.format !== 'zim')
      entries.set(f.url, {
        id: `library:${item.id}.${f.format}`,
        size_mb: f.size_bytes / 1048576,
        size_bytes: f.size_bytes,
        sha256: f.sha256,
        format: f.format,
        language: item.language,
        type: 'document',
      })

const tag = (xml, re) => (xml.match(re) || [])[1]

async function checkKiwix(url, e) {
  const res = await fetch(`${url}.meta4`, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (res.status !== 200) return { ok: false, why: `metalink HTTP ${res.status}` }
  const xml = await res.text()
  const name = tag(xml, /<file name="([^"]+)"/)
  const size = Number(tag(xml, /<size>(\d+)<\/size>/))
  const sha = tag(xml, /<hash type="sha-256">([0-9a-f]{64})<\/hash>/)
  const mirrors = (xml.match(/<url /g) || []).length
  const file = url.split('/').pop()
  const problems = []
  if (name !== file) problems.push(`metalink describes ${name}`)
  if (!sha) problems.push('no published SHA-256')
  if (mirrors < 1) problems.push('no mirror')
  const sizeMb = size / 1048576
  // size_mb is rounded, so tiny files need an absolute slack of 1 MB on top of the 5 %
  if (e.size_mb && Math.abs(sizeMb - e.size_mb) > Math.max(1, e.size_mb * 0.05))
    problems.push(`size ${sizeMb.toFixed(0)} MB vs manifest ${e.size_mb} MB`)
  return { ok: problems.length === 0, why: problems.join('; '), detail: `${sizeMb.toFixed(0)} MB, ${mirrors} mirrors, sha256 ${sha?.slice(0, 12)}…` }
}

async function checkOther(url) {
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) })
  return { ok: res.ok, why: res.ok ? '' : `HTTP ${res.status}`, detail: `HTTP ${res.status}` }
}

/**
 * Library documents have no metalink: HEAD for existence and size, and with --hashes the whole file is
 * fetched to compare against the SHA-256 pinned in library.json and to check the PDF/EPUB signature.
 */
async function checkDocument(url, e) {
  if (!VERIFY_HASHES) {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return { ok: false, why: `HTTP ${res.status}` }
    const len = Number(res.headers.get('content-length') || 0)
    if (len && e.sha256 && len !== e.size_bytes) return { ok: false, why: `size ${len} B vs pinned ${e.size_bytes} B (file changed)` }
    return { ok: true, detail: `HTTP ${res.status}, ${len || '?'} B` }
  }
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS * 5) })
  if (!res.ok) return { ok: false, why: `HTTP ${res.status}` }
  const bytes = Buffer.from(await res.arrayBuffer())
  const { createHash } = await import('node:crypto')
  const sha = createHash('sha256').update(bytes).digest('hex')
  const isPdf = bytes.subarray(0, 5).toString('latin1') === '%PDF-'
  const isEpub = bytes.readUInt32LE(0) === 0x04034b50 && bytes.subarray(30, 58).toString('latin1') === 'mimetypeapplication/epub+zip'
  const problems = []
  if ((e.format === 'pdf' && !isPdf) || (e.format === 'epub' && !isEpub)) problems.push(`not a valid ${e.format.toUpperCase()}`)
  if (e.sha256 && sha !== e.sha256) problems.push(`sha256 ${sha.slice(0, 12)}… differs from the pinned ${e.sha256.slice(0, 12)}…`)
  return { ok: problems.length === 0, why: problems.join('; '), detail: `${bytes.length} B, ${e.sha256 ? 'sha256 ok' : 'format ok (continuous edition)'}` }
}

async function check(url, e) {
  try {
    if (e.type === 'dataset') return { ok: true, detail: 'dataset (API, checked at install time)' }
    if (e.type === 'document') {
      // Institutional DSpace servers (Senado) answer 500 to bursts of parallel requests; one retry after
      // a pause tells a transient refusal from a file that is really gone (the app's download job retries
      // with exponential backoff for the same reason).
      let r = await checkDocument(url, e)
      for (let i = 0; i < 2 && !r.ok && /^HTTP 5\d\d$/.test(r.why); i++) {
        await new Promise((s) => setTimeout(s, 5000 * (i + 1)))
        r = await checkDocument(url, e)
      }
      return r
    }
    return KIWIX_HOSTS.has(new URL(url).hostname) ? await checkKiwix(url, e) : await checkOther(url)
  } catch (err) {
    return { ok: false, why: String(err?.cause?.code || err?.message || err) }
  }
}

const list = [...entries]
const results = new Array(list.length)
let next = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < list.length) {
      const i = next++
      results[i] = await check(...list[i])
    }
  })
)

let failed = 0
list.forEach(([url, e], i) => {
  const r = results[i]
  if (!r.ok) failed++
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} [${e.language ?? '--'}] ${e.id}  ${r.ok ? r.detail : r.why}  ${r.ok ? '' : url}`)
})
console.log(`\n${list.length - failed}/${list.length} files available`)
process.exit(failed ? 1 : 0)
