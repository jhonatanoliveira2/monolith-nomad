import { open } from 'node:fs/promises'

export type DocumentFormat = 'pdf' | 'epub'

/** A library download whose bytes are not the PDF/EPUB the catalog promised. */
export class InvalidDocumentFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidDocumentFormatError'
  }
}

/**
 * Identify a PDF or EPUB from its first bytes, or null for anything else.
 *
 * Library files are checked against a pinned SHA-256 when the catalog has one, but some publishers
 * rebuild their file continuously (the Python documentation) and a moved file is often answered by a
 * CMS error page with HTTP 200. This catches both: a PDF must start with `%PDF-`, and an EPUB is a ZIP
 * whose first entry is the uncompressed `mimetype` file holding `application/epub+zip`, as the EPUB
 * Open Container Format requires.
 */
export async function detectDocumentFormat(filepath: string): Promise<DocumentFormat | null> {
  let head: Buffer
  try {
    const fh = await open(filepath, 'r')
    try {
      const buf = Buffer.alloc(64)
      const { bytesRead } = await fh.read(buf, 0, 64, 0)
      head = buf.subarray(0, bytesRead)
    } finally {
      await fh.close()
    }
  } catch {
    return null
  }
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf'
  if (head.length >= 58 && head.readUInt32LE(0) === 0x04034b50) {
    const nameLength = head.readUInt16LE(26)
    const name = head.subarray(30, 30 + nameLength).toString('latin1')
    const extraLength = head.readUInt16LE(28)
    const bodyStart = 30 + nameLength + extraLength
    const body = head.subarray(bodyStart, bodyStart + 20).toString('latin1')
    if (name === 'mimetype' && body === 'application/epub+zip') return 'epub'
  }
  return null
}
