import {
  IconArrowsHorizontal,
  IconChevronLeft,
  IconChevronRight,
  IconMinus,
  IconPlus,
} from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import IconButton from '~/components/nd/IconButton'
import { fold } from '~/lib/library_filters'
import ReaderSearchPanel, { type SearchHit } from './ReaderSearchPanel'
import ReaderToc, { type TocNode } from './ReaderToc'
import type { ReaderPanel } from './types'
import { isControlKeyTarget, readStorage, writeStorage } from './reader_utils'

// pdf.js, legacy build: transpiled for older browsers (e.g. Firefox ESR on Ubuntu LTS)
type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
type PDFDocumentProxy = import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy
type RenderTask = import('pdfjs-dist/legacy/build/pdf.mjs').RenderTask

const PAGE_KEY = (filename: string) => `nomad:library:pdf-page:${filename}`
const ZOOM_KEY = 'nomad:library:pdf-zoom'
const PAGE_GAP = 16
const MIN_ZOOM = 0.4
const MAX_ZOOM = 3

let pdfjsPromise: Promise<PdfJs> | null = null
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= (async () => {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  })()
  return pdfjsPromise
}

type OutlineItem = { title: string; dest: unknown; items: OutlineItem[] }
type PageTask = { scale: number; task?: RenderTask }

/**
 * Integrated PDF reader (pdf.js): pages drawn lazily as they approach the viewport and released when
 * far away, a text layer for selection and search hits, the document outline, page navigation, zoom
 * and the last page remembered. Everything runs in the browser from the local file: no network.
 */
export default function PdfReader({
  url,
  filename,
  panel,
  setPanel,
  info,
  darkPages,
}: {
  url: string
  filename: string
  panel: ReaderPanel
  setPanel: (p: ReaderPanel) => void
  info: React.ReactNode
  darkPages: boolean
}) {
  const { t } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const pdfjsRef = useRef<PdfJs | null>(null)
  const pageEls = useRef<(HTMLDivElement | null)[]>([])
  const tasks = useRef(new Map<number, PageTask>())
  const visible = useRef(new Set<number>())
  const highlight = useRef<{ query: string; currentPage: number | null }>({
    query: '',
    currentPage: null,
  })
  const searchToken = useRef(0)

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [baseSize, setBaseSize] = useState<{ w: number; h: number } | null>(null)
  // Pages whose size differs from page 1 (landscape inserts, mixed formats), learned as they render
  const [pageSizes, setPageSizes] = useState<Map<number, { w: number; h: number }>>(new Map())
  const pageRef = useRef(1)
  const zoomRef = useRef<number | 'fit'>('fit')
  const [containerWidth, setContainerWidth] = useState(0)
  const [zoom, setZoom] = useState<number | 'fit'>(() => {
    const saved = Number(readStorage(ZOOM_KEY))
    return saved >= MIN_ZOOM && saved <= MAX_ZOOM ? saved : 'fit'
  })
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [outline, setOutline] = useState<TocNode[]>([])
  const [search, setSearch] = useState<{
    query: string
    hits: SearchHit[]
    done: boolean
    scanned: number
  }>({ query: '', hits: [], done: true, scanned: 0 })

  const numPages = doc?.numPages ?? 0
  const fitScale =
    baseSize && containerWidth ? Math.max(0.2, (containerWidth - 48) / baseSize.w) : 1
  const scale = zoom === 'fit' ? Math.min(fitScale, 2) : zoom

  // Open the document
  useEffect(() => {
    let cancelled = false
    let loadingTask: ReturnType<PdfJs['getDocument']> | null = null
    const pageTasks = tasks.current
    ;(async () => {
      try {
        const pdfjs = await loadPdfJs()
        pdfjsRef.current = pdfjs
        loadingTask = pdfjs.getDocument({ url, enableXfa: false })
        const loaded = await loadingTask.promise
        if (cancelled) return
        const first = await loaded.getPage(1)
        const vp = first.getViewport({ scale: 1 })
        setBaseSize({ w: vp.width, h: vp.height })
        setDoc(loaded)
        const raw = (await loaded.getOutline()) as OutlineItem[] | null
        const toNodes = (list: OutlineItem[], prefix = ''): TocNode[] =>
          list.map((o, i) => ({
            id: `${prefix}${i}`,
            label: o.title,
            target: o.dest,
            children: toNodes(o.items ?? [], `${prefix}${i}.`),
          }))
        if (!cancelled) setOutline(raw ? toNodes(raw) : [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    const tokenRef = searchToken
    return () => {
      cancelled = true
      tokenRef.current++
      for (const { task } of pageTasks.values()) task?.cancel()
      pageTasks.clear()
      loadingTask?.destroy()
    }
  }, [url])

  // Available width for "fit width"
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let timer = 0
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setContainerWidth(el.clientWidth), 150)
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => {
      window.clearTimeout(timer)
      ro.disconnect()
    }
  }, [])

  const markHits = useCallback((pageNo: number) => {
    const layer = pageEls.current[pageNo - 1]?.querySelector('.textLayer')
    if (!layer) return
    const q = highlight.current.query
    let first = true
    layer.querySelectorAll('span').forEach((span) => {
      span.classList.remove('nd-hit', 'nd-hit-current')
      if (q && fold(span.textContent ?? '').includes(q)) {
        span.classList.add('nd-hit')
        if (first && highlight.current.currentPage === pageNo) {
          span.classList.add('nd-hit-current')
          first = false
        }
      }
    })
  }, [])

  const renderPage = useCallback(
    async (pageNo: number) => {
      const pdfjs = pdfjsRef.current
      const el = pageEls.current[pageNo - 1]
      if (!doc || !pdfjs || !el) return
      const existing = tasks.current.get(pageNo)
      if (existing && existing.scale === scale) return
      existing?.task?.cancel()
      const entry: PageTask = { scale }
      tasks.current.set(pageNo, entry)
      try {
        const p = await doc.getPage(pageNo)
        if (tasks.current.get(pageNo) !== entry) return
        const viewport = p.getViewport({ scale })
        const own = p.getViewport({ scale: 1 })
        setPageSizes((prev) => {
          const known = prev.get(pageNo)
          if (known && known.w === own.width && known.h === own.height) return prev
          if (!known && baseSize && own.width === baseSize.w && own.height === baseSize.h) return prev
          return new Map(prev).set(pageNo, { w: own.width, h: own.height })
        })
        const canvas = el.querySelector('canvas')!
        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        entry.task = p.render({
          canvas,
          canvasContext: canvas.getContext('2d')!,
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        })
        await entry.task.promise
        const text = await p.getTextContent()
        if (tasks.current.get(pageNo) !== entry) return
        const layer = el.querySelector<HTMLDivElement>('.textLayer')!
        layer.replaceChildren()
        await new pdfjs.TextLayer({ textContentSource: text, container: layer, viewport }).render()
        markHits(pageNo)
      } catch (e) {
        if ((e as { name?: string })?.name !== 'RenderingCancelledException') {
          console.warn(`[reader] page ${pageNo}`, e)
        }
      }
    },
    [doc, scale, markHits, baseSize]
  )

  const releasePage = useCallback((pageNo: number) => {
    tasks.current.get(pageNo)?.task?.cancel()
    tasks.current.delete(pageNo)
    const el = pageEls.current[pageNo - 1]
    const canvas = el?.querySelector('canvas')
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
    el?.querySelector('.textLayer')?.replaceChildren()
  }, [])

  // Pages within ~1.5 screens are drawn, far ones released, so memory stays flat on long books
  useEffect(() => {
    if (!doc || !scroller.current) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page)
          if (e.isIntersecting) {
            visible.current.add(n)
            renderPage(n)
          } else {
            visible.current.delete(n)
            releasePage(n)
          }
        }
      },
      { root: scroller.current, rootMargin: '150% 0px' }
    )
    pageEls.current.forEach((el) => el && io.observe(el))
    // a zoom change keeps the same pages in view: redraw them at the new scale
    visible.current.forEach((n) => renderPage(n))
    return () => io.disconnect()
  }, [doc, renderPage, releasePage, numPages])

  const goTo = useCallback(
    (n: number, smooth = false) => {
      const target = Math.max(1, Math.min(numPages || 1, n))
      const el = pageEls.current[target - 1]
      if (el && scroller.current) {
        scroller.current.scrollTo({
          top: el.offsetTop - PAGE_GAP,
          behavior: smooth ? 'smooth' : 'auto',
        })
      }
      setPage(target)
      setPageInput(String(target))
    },
    [numPages]
  )

  // "Fit width" follows the window and the side panel: keep the page being read in place when the
  // width (and so the scale) changes. The first measured width only records the scale, so it never
  // overrides the restored last page.
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])
  const lastFit = useRef<number | null>(null)
  useEffect(() => {
    if (!doc || !containerWidth || zoomRef.current !== 'fit') return
    if (lastFit.current !== null && lastFit.current !== scale) {
      const keep = pageRef.current
      requestAnimationFrame(() => requestAnimationFrame(() => goTo(keep)))
    }
    lastFit.current = scale
  }, [scale, doc, containerWidth, goTo])

  // Restore the last page once the layout exists
  const restored = useRef(false)
  useEffect(() => {
    if (!doc || !baseSize || restored.current || !containerWidth) return
    restored.current = true
    const saved = Number(readStorage(PAGE_KEY(filename)))
    if (saved > 1) requestAnimationFrame(() => goTo(saved))
  }, [doc, baseSize, containerWidth, filename, goTo])

  // The current page follows the scroll position
  useEffect(() => {
    const el = scroller.current
    if (!el || !numPages) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const probe = el.scrollTop + el.clientHeight * 0.3
        let current = 1
        for (let i = 0; i < numPages; i++) {
          const p = pageEls.current[i]
          if (p && p.offsetTop <= probe) current = i + 1
          else break
        }
        setPage(current)
        setPageInput(String(current))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [numPages])

  useEffect(() => {
    if (!numPages) return
    pageRef.current = page
    const id = window.setTimeout(() => writeStorage(PAGE_KEY(filename), String(page)), 400)
    return () => window.clearTimeout(id)
  }, [page, filename, numPages])

  // Zoom keeps the reading position
  const setZoomKeepingPage = (z: number | 'fit') => {
    const keep = page
    setZoom(z)
    writeStorage(ZOOM_KEY, z === 'fit' ? null : String(z))
    requestAnimationFrame(() => requestAnimationFrame(() => goTo(keep)))
  }
  const step = (dir: 1 | -1) =>
    setZoomKeepingPage(
      Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale + dir * 0.15)) * 100) / 100
    )

  // Keyboard: ←/→ change page, Ctrl/⌘+F opens the in-document search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setPanel('search')
      } else if (isControlKeyTarget(e)) return
      else if (e.key === 'ArrowRight') goTo(page + 1)
      else if (e.key === 'ArrowLeft') goTo(page - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, goTo, setPanel])

  // Full-text search, page by page and cancellable; results stream in every 10 pages
  const runSearch = useCallback(
    async (raw: string) => {
      const token = ++searchToken.current
      const q = fold(raw).trim()
      highlight.current = { query: q, currentPage: null }
      tasks.current.forEach((_, n) => markHits(n))
      if (!q || !doc) {
        setSearch({ query: raw, hits: [], done: true, scanned: 0 })
        return
      }
      setSearch({ query: raw, hits: [], done: false, scanned: 0 })
      const hits: SearchHit[] = []
      try {
      for (let n = 1; n <= doc.numPages; n++) {
        if (token !== searchToken.current) return
        const content = await (await doc.getPage(n)).getTextContent()
        const original = content.items.map((i) => ('str' in i ? i.str : '')).join(' ')
        const text = fold(original)
        let from = 0
        for (let count = 0; count < 20; count++) {
          const at = text.indexOf(q, from)
          if (at === -1) break
          const start = Math.max(0, at - 50)
          hits.push({
            id: `${n}-${at}`,
            label: t('Page {{page}}', { page: n }),
            before: (start > 0 ? '…' : '') + original.slice(start, at),
            match: original.slice(at, at + q.length),
            after: original.slice(at + q.length, at + q.length + 60) + '…',
            target: n,
          })
          from = at + q.length
        }
        const finished = n === doc.numPages || hits.length >= 500
        if (n % 10 === 0 || finished) {
          setSearch({ query: raw, hits: [...hits], done: finished, scanned: n })
          if (finished) return
          await new Promise((r) => setTimeout(r, 0))
        }
      }
      } catch (e) {
        // document closed mid-search, or a damaged page: stop and keep what was found
        console.warn('[reader] search', e)
        if (token === searchToken.current) {
          setSearch((cur) => ({ ...cur, hits: [...hits], done: true }))
        }
      }
    },
    [doc, markHits, t]
  )

  const openHit = (hit: SearchHit) => {
    const n = hit.target as number
    highlight.current.currentPage = n
    goTo(n, true)
    window.setTimeout(() => markHits(n), 350)
    if (window.matchMedia('(max-width: 1023px)').matches) setPanel(null)
  }

  const openTocTarget = async (target: unknown) => {
    if (!doc) return
    try {
      const dest = typeof target === 'string' ? await doc.getDestination(target) : target
      if (!Array.isArray(dest)) return
      const ref = dest[0]
      const index =
        typeof ref === 'number'
          ? ref
          : await doc.getPageIndex(ref as Parameters<PDFDocumentProxy['getPageIndex']>[0])
      goTo(index + 1, true)
      if (window.matchMedia('(max-width: 1023px)').matches) setPanel(null)
    } catch (e) {
      console.warn('[reader] outline target', e)
    }
  }

  const pageStyle = useCallback(
    (pageNo: number): React.CSSProperties | undefined => {
      const size = pageSizes.get(pageNo) ?? baseSize
      return size
        ? ({
            'width': `${Math.floor(size.w * scale)}px`,
            'height': `${Math.floor(size.h * scale)}px`,
            '--total-scale-factor': String(scale),
          } as React.CSSProperties)
        : undefined
    },
    [baseSize, pageSizes, scale]
  )

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="nd-card max-w-md p-6 text-center">
          <p className="font-medium text-text-primary">{t('Could not open this PDF.')}</p>
          <p className="mt-1 text-sm text-text-muted">{error}</p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm underline underline-offset-4"
          >
            {t("Open in the browser's PDF viewer")}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      {panel && (
        <aside className="absolute inset-y-0 left-0 z-30 flex w-[min(22rem,90vw)] flex-col border-r border-border-subtle bg-surface-primary shadow-2xl lg:static lg:z-auto lg:shadow-none">
          {panel === 'contents' && (
            <ReaderToc
              nodes={outline}
              empty={t('This PDF has no table of contents.')}
              onSelect={(node) => openTocTarget(node.target)}
            />
          )}
          {panel === 'search' && (
            <ReaderSearchPanel
              initialQuery={search.query}
              hits={search.hits}
              done={search.done}
              progress={
                numPages
                  ? t('{{done}} of {{total}} pages searched', {
                      done: search.scanned,
                      total: numPages,
                    })
                  : undefined
              }
              onSearch={runSearch}
              onSelect={openHit}
            />
          )}
          {panel === 'info' && <div className="overflow-y-auto p-5">{info}</div>}
        </aside>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          ref={scroller}
          className="min-h-0 flex-1 overflow-auto bg-surface-secondary px-4 py-4 sm:px-6"
          data-reader-dark={darkPages}
          role="region"
          tabIndex={0}
          aria-label={t('Document pages')}
        >
          {!doc || !baseSize ? (
            <div className="mx-auto mt-6 flex max-w-2xl flex-col gap-4" aria-busy="true">
              <div className="nd-skeleton aspect-[1/1.414] w-full" />
            </div>
          ) : (
            <div className="flex flex-col items-center" style={{ gap: PAGE_GAP }}>
              {Array.from({ length: numPages }, (_, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    pageEls.current[i] = el
                  }}
                  data-page={i + 1}
                  className="nd-pdf-page"
                  style={pageStyle(i + 1)}
                  aria-label={t('Page {{page}}', { page: i + 1 })}
                >
                  <canvas aria-hidden="true" />
                  <div className="textLayer" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Page and zoom controls */}
        <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-3 py-2 nd-glass">
          <div className="flex items-center gap-1">
            <IconButton
              size="sm"
              label={t('Previous page')}
              onClick={() => goTo(page - 1)}
              disabled={page <= 1}
            >
              <IconChevronLeft size={16} />
            </IconButton>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                goTo(Number(pageInput) || page)
              }}
              className="flex items-center gap-1.5 nd-mono text-xs text-text-secondary"
            >
              <label className="sr-only" htmlFor="reader-page">
                {t('Page number')}
              </label>
              <input
                id="reader-page"
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
                onBlur={() => setPageInput(String(page))}
                className="nd-field !w-14 !px-2 !py-1 text-center !text-xs"
              />
              <span>/ {numPages || '—'}</span>
            </form>
            <IconButton
              size="sm"
              label={t('Next page')}
              onClick={() => goTo(page + 1)}
              disabled={page >= numPages}
            >
              <IconChevronRight size={16} />
            </IconButton>
          </div>
          <div className="hidden flex-1 px-4 sm:block">
            <div className="h-1 overflow-hidden rounded-full bg-led-off" aria-hidden="true">
              <div
                className="h-full rounded-full bg-highlight transition-[width] duration-[240ms]"
                style={{ width: numPages ? `${(page / numPages) * 100}%` : 0 }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              size="sm"
              label={t('Zoom out')}
              onClick={() => step(-1)}
              disabled={scale <= MIN_ZOOM}
            >
              <IconMinus size={16} />
            </IconButton>
            <span className="nd-mono w-12 text-center text-xs text-text-secondary">
              {Math.round(scale * 100)}%
            </span>
            <IconButton
              size="sm"
              label={t('Zoom in')}
              onClick={() => step(1)}
              disabled={scale >= MAX_ZOOM}
            >
              <IconPlus size={16} />
            </IconButton>
            <IconButton
              size="sm"
              label={t('Fit to width')}
              active={zoom === 'fit'}
              onClick={() => setZoomKeepingPage('fit')}
              className="ml-1"
            >
              <IconArrowsHorizontal size={16} />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  )
}
