/**
 * Structure kept when a PDF or EPUB is indexed, so an answer can say *where* a passage is.
 *
 * A PDF becomes windows of consecutive pages: short pages are merged until a window reaches the chunk
 * budget, long pages stay alone (the chunker then splits them, every piece keeping that page). An EPUB
 * becomes one segment per spine document, labelled with its heading. Pure functions, no I/O, so they
 * are unit-tested directly.
 */

export type DocumentPage = { num: number; text: string }
export type DocumentChapter = { href: string; title: string | null; text: string }

export type DocumentSegment = {
  text: string
  meta: { page_start?: number; page_end?: number; chapter?: string; chapter_href?: string }
}

/**
 * Group pages into windows of at most `targetChars` characters (a single page larger than that is a
 * window of its own). Blank pages are skipped but never break the numbering: a window's range is the
 * first and last page that contributed text.
 */
export function pdfPageWindows(pages: DocumentPage[], targetChars: number): DocumentSegment[] {
  const windows: DocumentSegment[] = []
  let parts: string[] = []
  let size = 0
  let start = 0
  let end = 0

  const flush = () => {
    if (parts.length === 0) return
    windows.push({ text: parts.join('\n\n'), meta: { page_start: start, page_end: end } })
    parts = []
    size = 0
  }

  for (const page of [...pages].sort((a, b) => a.num - b.num)) {
    const text = page.text.trim()
    if (!text) continue
    if (parts.length > 0 && size + text.length > targetChars) flush()
    if (parts.length === 0) start = page.num
    parts.push(text)
    size += text.length
    end = page.num
  }
  flush()
  return windows
}

export function epubChapterSegments(chapters: DocumentChapter[]): DocumentSegment[] {
  return chapters
    .filter((chapter) => chapter.text.trim().length > 0)
    .map((chapter) => ({
      text: chapter.text,
      meta: {
        chapter_href: chapter.href,
        ...(chapter.title ? { chapter: chapter.title } : {}),
      },
    }))
}

/** "p. 12" or "p. 12–13" for a stored range; null when the point has no page information. */
export function formatPageRange(start?: unknown, end?: unknown): string | null {
  const a = typeof start === 'number' && start > 0 ? start : null
  const b = typeof end === 'number' && end > 0 ? end : null
  if (a === null) return null
  return b !== null && b !== a ? `p. ${a}–${b}` : `p. ${a}`
}

/** Where a retrieved chunk is inside its document: a page range or a chapter, for labels and citations. */
export function locationLabel(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null
  const pages = formatPageRange(metadata.page_start, metadata.page_end)
  if (pages) return pages
  return typeof metadata.chapter === 'string' && metadata.chapter ? metadata.chapter : null
}
