#!/usr/bin/env node
/**
 * Turns a curation file (collections/curation/*.json) into entries of collections/library.json.
 *
 * The curation holds what a person decides: title, authors, areas, levels, the official URL and the
 * licence. What must never be typed by hand is measured here, from the publisher's own file:
 *   - the bytes are downloaded from the official URL (no mirrors, no re-hosting);
 *   - the format is checked from the signature (`%PDF-`, or a ZIP whose `mimetype` is EPUB);
 *   - `license_evidence` must appear in the text of the first pages of the PDF itself, so a work only
 *     enters the library when its licence or reproduction permission is printed in the file;
 *   - `size_bytes` and `sha256` are computed from those bytes.
 *
 * Usage (repository root):
 *   node scripts/build-library-entries.mjs collections/curation/survival-library.json [--dry-run]
 *
 * Items are merged by id (replaced when present, appended otherwise) and the curation's area is added
 * at the top of the area list when missing. spec_version becomes today's date. Exit code 1 when any
 * file fails a check; nothing is written in that case.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIBRARY = path.join(ROOT, 'collections', 'library.json')
const EVIDENCE_PAGES = 8
const TIMEOUT_MS = 300_000

const args = process.argv.slice(2)
const curationPath = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')
if (!curationPath) {
  console.error('usage: node scripts/build-library-entries.mjs <curation.json> [--dry-run]')
  process.exit(2)
}

const { PDFParse } = await import(
  pathToFileURL(path.join(ROOT, 'admin/node_modules/pdf-parse/dist/pdf-parse/esm/index.js')).href
)

/** Whitespace-insensitive, case-insensitive comparison (PDF text extraction breaks lines anywhere). */
const squash = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase()

function detectFormat(buf) {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf'
  // EPUB: ZIP local header, first entry "mimetype" holding application/epub+zip
  if (buf.readUInt32LE(0) === 0x04034b50 && buf.subarray(30, 38).toString('latin1') === 'mimetype') {
    return buf.subarray(38, 58).toString('latin1').startsWith('application/epub+zip') ? 'epub' : null
  }
  return null
}

async function firstPagesText(buf) {
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  try {
    const result = await parser.getText({ first: EVIDENCE_PAGES })
    return result.text
  } finally {
    await parser.destroy()
  }
}

async function fetchFile(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (monolith-nomad library curation)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

const curation = JSON.parse(readFileSync(path.resolve(curationPath), 'utf8'))
const library = JSON.parse(readFileSync(LIBRARY, 'utf8'))
const built = []
const failures = []

for (const item of curation.items) {
  const license = curation.licenses?.[item.license] ?? item.license
  if (!license || typeof license !== 'object') {
    failures.push(`${item.id}: unknown licence "${item.license}"`)
    continue
  }
  const files = []
  for (const file of item.files) {
    try {
      const buf = await fetchFile(file.url)
      const format = detectFormat(buf)
      if (format !== file.format) throw new Error(`expected ${file.format}, got ${format ?? 'unknown bytes'}`)
      if (item.license_evidence && format === 'pdf') {
        const text = squash(await firstPagesText(buf))
        if (!text.includes(squash(item.license_evidence))) {
          throw new Error(`licence evidence "${item.license_evidence}" not found in the first ${EVIDENCE_PAGES} pages`)
        }
      }
      const sha256 = createHash('sha256').update(buf).digest('hex')
      files.push({ format, url: file.url, size_bytes: buf.length, sha256 })
      console.log(`ok   ${item.id}.${format}  ${(buf.length / 1048576).toFixed(1)} MB  ${sha256.slice(0, 12)}…`)
    } catch (e) {
      failures.push(`${item.id}.${file.format}: ${e instanceof Error ? e.message : e}`)
      console.log(`FAIL ${item.id}.${file.format}: ${e instanceof Error ? e.message : e}`)
    }
  }
  const { license_evidence: _evidence, license: _license, files: _files, ...rest } = item
  built.push({ ...rest, license, files })
}

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s); library.json left untouched:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

if (curation.area && !library.areas.some((a) => a.slug === curation.area.slug)) {
  library.areas.unshift(curation.area)
}
for (const entry of built) {
  const at = library.items.findIndex((i) => i.id === entry.id)
  if (at >= 0) library.items[at] = entry
  else library.items.push(entry)
}
library.spec_version = new Date().toISOString().slice(0, 10)

if (dryRun) {
  console.log(`\n--dry-run: ${built.length} item(s) verified, nothing written`)
} else {
  writeFileSync(LIBRARY, JSON.stringify(library, null, 2) + '\n')
  console.log(`\n${built.length} item(s) written to collections/library.json`)
}
