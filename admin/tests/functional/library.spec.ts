import { test } from '@japa/runner'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import InstalledResource from '#models/installed_resource'
import { LibraryService } from '#services/library_service'

/**
 * End-to-end checks of the library HTTP surface against the booted app (MySQL included): catalog
 * listing (bundled manifest fallback when GitHub is unreachable or not yet published), offline file
 * serving, the reader page, and access control on the file route.
 */
const BASE = `http://${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? '3333'}`
const FILE = 'pro-git-pdf_2026-08.pdf'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')

test.group('Library', (group) => {
  const root = LibraryService.libraryRoot()

  // The listing checks the download queue in Redis. Close the queue and the shared ioredis connection
  // afterwards, or the open socket keeps the test process alive until the runner times out.
  group.teardown(async () => {
    const { QueueService } = await import('#services/queue_service')
    const { default: queueConfig } = await import('#config/queue')
    await QueueService.getInstance().close()
    await (queueConfig.connection as { quit?: () => Promise<unknown> }).quit?.()
  })

  group.each.setup(async () => {
    await mkdir(root, { recursive: true })
    await writeFile(join(root, FILE), PDF)
    // Also exercises migration 1786000000005: a 'document' row would be rejected by the old enum.
    await InstalledResource.updateOrCreate(
      { resource_id: 'pro-git-pdf', resource_type: 'document' },
      {
        version: '2026-08',
        collection_ref: 'library',
        url: 'https://github.com/progit/progit2-pt-br/releases/download/2.1.50/progit.pdf',
        file_path: join(root, FILE),
        file_size_bytes: PDF.length,
        installed_at: DateTime.now(),
      }
    )
    return async () => {
      await InstalledResource.query().where('resource_type', 'document').delete()
      await rm(join(root, FILE), { force: true })
    }
  })

  test('lists the catalog with areas, levels and per-file status', async ({ assert }) => {
    const res = await fetch(`${BASE}/api/library`)
    assert.equal(res.status, 200)
    const body = (await res.json()) as any
    assert.isAbove(body.items.length, 30)
    assert.isAbove(body.areas.length, 5)
    const proGit = body.items.find((i: any) => i.id === 'pro-git')
    const pdf = proGit.files.find((f: any) => f.format === 'pdf')
    assert.equal(pdf.status, 'installed')
    assert.equal(pdf.filename, FILE)
    const epub = proGit.files.find((f: any) => f.format === 'epub')
    assert.equal(epub.status, 'available')
    assert.match(epub.sha256, /^[0-9a-f]{64}$/)
  })

  test('serves an installed PDF inline for offline reading', async ({ assert }) => {
    const res = await fetch(`${BASE}/api/library/files/${FILE}`)
    assert.equal(res.status, 200)
    assert.include(res.headers.get('content-type') ?? '', 'application/pdf')
    assert.include(res.headers.get('content-disposition') ?? '', 'inline')
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(
      Buffer.from(await res.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      '%PDF-'
    )
  })

  test('opens the reader page for an installed file and redirects otherwise', async ({
    assert,
  }) => {
    const ok = await fetch(`${BASE}/library/read/${FILE}`, { redirect: 'manual' })
    assert.equal(ok.status, 200)
    assert.include(await ok.text(), 'library/read')
    const missing = await fetch(`${BASE}/library/read/pro-git-epub_2026-08.epub`, {
      redirect: 'manual',
    })
    assert.equal(missing.status, 302)
  })

  test('never serves a file that is not an installed library document', async ({ assert }) => {
    // A valid-looking name with no install row (the file is even created on disk).
    await writeFile(join(root, 'pro-git-epub_2026-08.epub'), 'not installed')
    try {
      const notInstalled = await fetch(`${BASE}/api/library/files/pro-git-epub_2026-08.epub`)
      assert.equal(notInstalled.status, 404)
    } finally {
      await rm(join(root, 'pro-git-epub_2026-08.epub'), { force: true })
    }
    for (const evil of [
      '..%2F..%2F.env',
      '%2Fetc%2Fpasswd',
      'kiwix-library.xml',
      '..%2Fzim%2Fx.zim',
    ]) {
      const res = await fetch(`${BASE}/api/library/files/${evil}`)
      assert.notEqual(res.status, 200, evil)
    }
  })

  test('rejects unknown works and formats when queueing a download', async ({ assert }) => {
    const unknown = await fetch(`${BASE}/api/library/download`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'does-not-exist', format: 'pdf' }),
    })
    assert.equal(unknown.status, 404)
    const badFormat = await fetch(`${BASE}/api/library/download`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'pro-git', format: 'exe' }),
    })
    assert.equal(badFormat.status, 422)
    const alreadyThere = await fetch(`${BASE}/api/library/download`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'pro-git', format: 'pdf' }),
    })
    assert.equal(alreadyThere.status, 200)
    assert.deepEqual(await alreadyThere.json(), { queued: false, message: 'Already installed' })
  })

  test('removing a document deletes the file and its install row', async ({ assert }) => {
    const res = await fetch(`${BASE}/api/library/files`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'pro-git', format: 'pdf' }),
    })
    assert.equal(res.status, 200)
    const row = await InstalledResource.query()
      .where('resource_type', 'document')
      .where('resource_id', 'pro-git-pdf')
      .first()
    assert.isNull(row)
    const after = await fetch(`${BASE}/api/library/files/${FILE}`)
    assert.equal(after.status, 404)
  })
})
