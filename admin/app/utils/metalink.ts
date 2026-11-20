import { isSafeMirrorUrl } from './host_safety.js'
import * as cheerio from 'cheerio'

/**
 * Metalink v4 (RFC 5854) as served by MirrorBrain at download.kiwix.org (`<file>.meta4`).
 *
 * Kiwix publishes, for every ZIM, the file size, its SHA-256 and the list of official mirrors, already
 * ordered by MirrorBrain for the requesting client's country (the document carries comments such as
 * "Mirrors which handle this country (BR)"). Only https mirrors are kept; the hash lets any mirror be
 * used safely because the bytes are verified against the value published by download.kiwix.org itself.
 */
export type MetalinkUrl = {
  url: string
  /** ISO 3166-1 alpha-2 code in lower case, as published by MirrorBrain (`location="us"`). */
  location: string | null
  /** MirrorBrain's order for this client (1 = preferred). */
  priority: number | null
}

export type MetalinkFile = {
  name: string
  size: number | null
  sha256: string | null
  urls: MetalinkUrl[]
}

const SHA256_RE = /^[0-9a-f]{64}$/

export function parseMetalink(xml: string): MetalinkFile | null {
  if (!xml || !xml.includes('<metalink')) return null
  let $: cheerio.CheerioAPI
  try {
    $ = cheerio.load(xml, { xml: true })
  } catch {
    return null
  }
  const file = $('file').first()
  if (file.length === 0) return null

  const name = (file.attr('name') || '').trim()
  if (!name || name.includes('/') || name.includes('\\')) return null

  const sizeText = file.children('size').first().text().trim()
  const size = /^\d+$/.test(sizeText) ? Number(sizeText) : null

  let sha256: string | null = null
  file.children('hash').each((_, el) => {
    const type = ($(el).attr('type') || '').toLowerCase()
    const value = $(el).text().trim().toLowerCase()
    if (type === 'sha-256' && SHA256_RE.test(value)) sha256 = value
  })

  const urls: MetalinkUrl[] = []
  const seen = new Set<string>()
  file.children('url').each((_, el) => {
    const raw = $(el).text().trim()
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      return
    }
    // https only: a plain-http mirror could be tampered with in transit (the hash would catch it, but
    // there is no reason to spend the bandwidth) and would leak what is being downloaded. And only public
    // named hosts on the default port, without credentials: a tampered list must not point the server at its
    // own network (host_safety.ts).
    if (!isSafeMirrorUrl(parsed.href) || seen.has(parsed.href)) return
    seen.add(parsed.href)
    const location = ($(el).attr('location') || '').trim().toLowerCase()
    const priorityText = ($(el).attr('priority') || '').trim()
    urls.push({
      url: parsed.href,
      location: /^[a-z]{2}$/.test(location) ? location : null,
      priority: /^\d+$/.test(priorityText) ? Number(priorityText) : null,
    })
  })

  return { name, size, sha256, urls }
}
