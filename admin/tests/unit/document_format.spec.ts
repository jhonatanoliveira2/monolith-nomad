import * as assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'

import { detectDocumentFormat } from '../../app/utils/document_format.js'

const dirs: string[] = []
after(async () => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))))

async function file(bytes: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'docfmt-'))
  dirs.push(dir)
  const p = path.join(dir, 'f')
  await writeFile(p, bytes)
  return p
}

/** First bytes of a real EPUB: a stored "mimetype" entry is the first thing in the ZIP (EPUB OCF). */
function epubHeader(): Buffer {
  const name = Buffer.from('mimetype')
  const body = Buffer.from('application/epub+zip')
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(name.length, 26)
  return Buffer.concat([header, name, body, Buffer.alloc(32)])
}

test('recognises a PDF by its %PDF- signature', async () => {
  assert.equal(await detectDocumentFormat(await file(Buffer.from('%PDF-1.7\n%âãÏÓ\n'))), 'pdf')
})

test('recognises an EPUB by the mimetype entry the OCF spec puts first', async () => {
  assert.equal(await detectDocumentFormat(await file(epubHeader())), 'epub')
})

test('an HTML error page served with status 200 is not a document', async () => {
  // The failure this guards: a moved file answered by a CMS "not found" page with HTTP 200.
  const html = Buffer.from('<!DOCTYPE html><html><body>Página não encontrada</body></html>')
  assert.equal(await detectDocumentFormat(await file(html)), null)
})

test('a plain ZIP that is not an EPUB is rejected', async () => {
  const zip = Buffer.alloc(64)
  zip.writeUInt32LE(0x04034b50, 0)
  zip.writeUInt16LE(9, 26)
  Buffer.from('notes.txtwhatever').copy(zip, 30)
  assert.equal(await detectDocumentFormat(await file(zip)), null)
})

test('empty and missing files are not documents', async () => {
  assert.equal(await detectDocumentFormat(await file(Buffer.alloc(0))), null)
  assert.equal(await detectDocumentFormat('/nonexistent/file.pdf'), null)
})
