import { IconChevronLeft, IconChevronRight, IconMinus, IconPlus } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import IconButton from '~/components/nd/IconButton'
import SegmentedControl from '~/components/nd/SegmentedControl'
import ReaderSearchPanel, { type SearchHit } from './ReaderSearchPanel'
import ReaderToc, { type TocNode } from './ReaderToc'
import type { ReaderApi, ReaderPanel } from './types'
import { isControlKeyTarget, readStorage, writeStorage } from './reader_utils'

const POSITION_KEY = (filename: string) => `nomad:library:position:${filename}`
const FONT_KEY = 'nomad:library:font-size'
const THEME_KEY = 'nomad:library:epub-theme'
const FAMILY_KEY = 'nomad:library:epub-font'

export type EpubTheme = 'light' | 'sepia' | 'dark'
type Family = 'serif' | 'sans'

const THEMES: Record<EpubTheme, { bg: string; fg: string; link: string }> = {
  light: { bg: '#ffffff', fg: '#1a1a1a', link: '#0e0e0e' },
  sepia: { bg: '#f4ecd8', fg: '#3b2f1e', link: '#5b4220' },
  dark: { bg: '#0a0a0a', fg: '#e6e6e6', link: '#f2f2f2' },
}

type EpubToc = { id?: string; label: string; href: string; subitems?: EpubToc[] }

/**
 * EPUB reader on epub.js. The book renders in a sandboxed iframe with scripts disabled. Contents,
 * in-book search, reading themes, typeface and size, a progress slider and the last position.
 */
export default function EpubReader({
  url,
  filename,
  panel,
  setPanel,
  info,
  appTheme,
  assistant,
  apiRef,
  initialHref,
}: {
  url: string
  filename: string
  panel: ReaderPanel
  setPanel: (p: ReaderPanel) => void
  info: React.ReactNode
  appTheme: 'light' | 'dark'
  /** The assistant panel's content, shown when `panel === 'assistant'`. */
  assistant?: React.ReactNode
  /** Filled with this reader's ReaderApi for the assistant panel. */
  apiRef?: React.MutableRefObject<ReaderApi | null>
  /** Chapter to open (a cited chapter from an answer), instead of the last position. */
  initialHref?: string
}) {
  const { t } = useTranslation()
  const viewer = useRef<HTMLDivElement>(null)
  const bookRef = useRef<any>(null)
  const rendition = useRef<any>(null)
  const lastHit = useRef<string | null>(null)
  const lastSelection = useRef('')
  const searchToken = useRef(0)

  const [toc, setToc] = useState<TocNode[]>([])
  const [flatToc, setFlatToc] = useState<EpubToc[]>([])
  const [chapter, setChapter] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [locationsReady, setLocationsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = Number(readStorage(FONT_KEY))
    return saved >= 70 && saved <= 200 ? saved : 100
  })
  const [theme, setTheme] = useState<EpubTheme>(() => {
    const saved = readStorage(THEME_KEY)
    return saved === 'light' || saved === 'sepia' || saved === 'dark' ? saved : appTheme
  })
  const [family, setFamily] = useState<Family>(() =>
    readStorage(FAMILY_KEY) === 'sans' ? 'sans' : 'serif'
  )
  const [search, setSearch] = useState<{ query: string; hits: SearchHit[]; done: boolean }>({
    query: '',
    hits: [],
    done: true,
  })

  useEffect(() => {
    let book: any
    let cancelled = false
    ;(async () => {
      try {
        const { default: ePub } = await import('epubjs')
        if (cancelled || !viewer.current) return
        book = ePub(url, { openAs: 'epub' })
        bookRef.current = book
        const r = book.renderTo(viewer.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'auto',
          allowScriptedContent: false,
        })
        rendition.current = r
        for (const [name, c] of Object.entries(THEMES)) {
          // Books ship their own colours on p/span/div: the reading theme must win on every element
          // (links keep theirs by specificity), and no element may paint a white block in dark mode.
          r.themes.register(name, {
            'html, body': { 'background': `${c.bg} !important`, 'color': `${c.fg} !important` },
            'body *': {
              'color': `${c.fg} !important`,
              'background-color': 'transparent !important',
              'border-color': `${c.fg}33 !important`,
            },
            'a, a *': { color: `${c.link} !important`, 'text-decoration-color': `${c.fg}66 !important` },
            '::selection': { background: 'rgba(215, 25, 33, 0.25)' },
          })
        }
        r.themes.select(theme)
        r.themes.fontSize(`${fontSize}%`)
        r.themes.font(family === 'serif' ? 'Georgia, "Times New Roman", serif' : '"Space Grotesk", system-ui, sans-serif')
        // ←/→ also work while the focus is inside the book's iframe (epub.js forwards its DOM events)
        r.on('keydown', (e: KeyboardEvent) => {
          if (e.key === 'ArrowLeft') r.prev()
          else if (e.key === 'ArrowRight') r.next()
        })
        r.on('relocated', (location: any) => {
          writeStorage(POSITION_KEY(filename), location.start.cfi)
          const pct = book.locations?.length?.() ? book.locations.percentageFromCfi(location.start.cfi) : null
          if (typeof pct === 'number') setProgress(Math.round(pct * 1000) / 10)
          const href = String(location.start.href ?? '').split('#')[0]
          setChapter(href)
        })
        // The text the user selects inside the book's iframe, kept for the assistant panel
        r.on('selected', (_cfi: string, contents: any) => {
          const text = contents?.window?.getSelection?.()?.toString().trim()
          if (text) lastSelection.current = text
        })
        await r.display(initialHref || readStorage(POSITION_KEY(filename)) || undefined)
        const nav = await book.loaded.navigation
        if (cancelled) return
        const entries: EpubToc[] = nav.toc ?? []
        const flat: EpubToc[] = []
        const toNodes = (list: EpubToc[], prefix = ''): TocNode[] =>
          list.map((e, i) => {
            flat.push(e)
            return {
              id: `${prefix}${i}`,
              label: e.label,
              target: e.href,
              children: toNodes(e.subitems ?? [], `${prefix}${i}.`),
            }
          })
        setToc(toNodes(entries))
        setFlatToc(flat)
        await book.ready
        await book.locations.generate(1600)
        if (cancelled) return
        setLocationsReady(true)
        const cfi = r.currentLocation()?.start?.cfi
        if (cfi) setProgress(Math.round(book.locations.percentageFromCfi(cfi) * 1000) / 10)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
      searchToken.current++
      try {
        book?.destroy()
      } catch {}
      rendition.current = null
      bookRef.current = null
    }
    // The book is opened once per file; theme, font and size are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, filename])

  useEffect(() => {
    rendition.current?.themes.select(theme)
    writeStorage(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    rendition.current?.themes.font(
      family === 'serif' ? 'Georgia, "Times New Roman", serif' : '"Space Grotesk", system-ui, sans-serif'
    )
    writeStorage(FAMILY_KEY, family)
  }, [family])

  useEffect(() => {
    rendition.current?.themes.fontSize(`${fontSize}%`)
    writeStorage(FONT_KEY, String(fontSize))
  }, [fontSize])

  const prev = useCallback(() => rendition.current?.prev(), [])
  const next = useCallback(() => rendition.current?.next(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setPanel('search')
      } else if (isControlKeyTarget(e)) return
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, setPanel])

  const chapterLabel =
    (chapter &&
      flatToc.find((e) => e.href.split('#')[0].endsWith(chapter) || chapter.endsWith(e.href.split('#')[0]))
        ?.label.trim()) ||
    ''

  // The assistant reads the chapter on screen from the rendered section (no network)
  const chapterRef = useRef({ href: '', label: '' })
  chapterRef.current = { href: chapter, label: chapterLabel }
  useEffect(() => {
    if (!apiRef) return
    const location = () => ({
      label: chapterRef.current.label || t('Current section'),
      href: chapterRef.current.href || undefined,
    })
    apiRef.current = {
      location,
      selection: () => lastSelection.current,
      currentText: async () => {
        const contents: any[] = rendition.current?.getContents?.() ?? []
        const text = contents
          .map((c) => c?.document?.body?.innerText ?? c?.document?.body?.textContent ?? '')
          .join('\n\n')
          .trim()
        return { ...location(), text }
      },
      goTo: (target) => {
        if (target.href) rendition.current?.display(target.href)
      },
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef, t])

  const runSearch = useCallback(
    async (raw: string) => {
      const token = ++searchToken.current
      const q = raw.trim()
      const book = bookRef.current
      if (!q || !book) {
        setSearch({ query: raw, hits: [], done: true })
        return
      }
      setSearch({ query: raw, hits: [], done: false })
      const hits: SearchHit[] = []
      const items: any[] = book.spine?.spineItems ?? []
      for (const item of items) {
        if (token !== searchToken.current) return
        try {
          await item.load(book.load.bind(book))
          if (token !== searchToken.current) return
          const found: { cfi: string; excerpt: string }[] = item.find(q) ?? []
          const label = flatToc.find((e) => e.href.split('#')[0] === item.href)?.label.trim() ?? ''
          for (const f of found.slice(0, 30)) {
            const at = f.excerpt.toLowerCase().indexOf(q.toLowerCase())
            hits.push({
              id: f.cfi,
              label: label || t('Section {{n}}', { n: item.index + 1 }),
              before: at >= 0 ? f.excerpt.slice(0, at) : f.excerpt,
              match: at >= 0 ? f.excerpt.slice(at, at + q.length) : '',
              after: at >= 0 ? f.excerpt.slice(at + q.length) : '',
              target: f.cfi,
            })
          }
        } catch (e) {
          console.warn('[reader] search in section', item?.href, e)
        } finally {
          try {
            item.unload?.()
          } catch {}
        }
        if (hits.length >= 500) break
      }
      if (token === searchToken.current) setSearch({ query: raw, hits, done: true })
    },
    [flatToc, t]
  )

  const openHit = (hit: SearchHit) => {
    const r = rendition.current
    if (!r) return
    if (lastHit.current) r.annotations.remove(lastHit.current, 'highlight')
    lastHit.current = hit.target as string
    r.display(hit.target as string).then(() => {
      r.annotations.highlight(hit.target, {}, undefined, 'nd-epub-hit', {
        'fill': '#d71921',
        'fill-opacity': '0.3',
      })
    })
    if (window.matchMedia('(max-width: 1023px)').matches) setPanel(null)
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="nd-card max-w-md p-6 text-center">
          <p className="font-medium text-text-primary">
            {t('Could not open this EPUB: {{error}}', { error })}
          </p>
        </div>
      </div>
    )
  }

  const c = THEMES[theme]

  return (
    <div className="relative flex min-h-0 flex-1">
      {panel && (
        <aside
          className={`absolute inset-y-0 left-0 z-30 flex ${panel === 'assistant' ? 'w-[min(28rem,94vw)]' : 'w-[min(22rem,90vw)]'} flex-col border-r border-border-subtle bg-surface-primary shadow-2xl lg:static lg:z-auto lg:shadow-none`}
        >
          {panel === 'contents' && (
            <ReaderToc
              nodes={toc}
              empty={t('This book has no table of contents.')}
              onSelect={(node) => {
                rendition.current?.display(node.target as string)
                if (window.matchMedia('(max-width: 1023px)').matches) setPanel(null)
              }}
            />
          )}
          {panel === 'search' && (
            <ReaderSearchPanel
              initialQuery={search.query}
              hits={search.hits}
              done={search.done}
              onSearch={runSearch}
              onSelect={openHit}
            />
          )}
          {panel === 'assistant' && assistant}
          {panel === 'info' && (
            <div className="space-y-6 overflow-y-auto p-5">
              <div>
                <p className="nd-eyebrow mb-2.5">{t('Reading')}</p>
                <SegmentedControl
                  label={t('Page colour')}
                  size="sm"
                  options={[
                    { value: 'light', label: t('Light') },
                    { value: 'sepia', label: t('Sepia') },
                    { value: 'dark', label: t('Dark') },
                  ]}
                  value={theme}
                  onChange={setTheme}
                />
                <div className="mt-3">
                  <SegmentedControl
                    label={t('Typeface')}
                    size="sm"
                    options={[
                      { value: 'serif', label: t('Serif') },
                      { value: 'sans', label: t('Sans') },
                    ]}
                    value={family}
                    onChange={setFamily}
                  />
                </div>
              </div>
              {info}
            </div>
          )}
        </aside>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 items-stretch" style={{ background: c.bg }}>
          <button
            type="button"
            onClick={prev}
            aria-label={t('Previous page')}
            className="group hidden w-14 shrink-0 items-center justify-center sm:flex cursor-pointer"
            style={{ color: c.fg }}
          >
            <IconChevronLeft size={26} className="opacity-30 transition-opacity group-hover:opacity-80" />
          </button>
          <div ref={viewer} role="region" className="min-w-0 flex-1 py-6" aria-label={t('Book content')} />
          <button
            type="button"
            onClick={next}
            aria-label={t('Next page')}
            className="group hidden w-14 shrink-0 items-center justify-center sm:flex cursor-pointer"
            style={{ color: c.fg }}
          >
            <IconChevronRight size={26} className="opacity-30 transition-opacity group-hover:opacity-80" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2 nd-glass">
          <div className="flex items-center gap-1 sm:hidden">
            <IconButton size="sm" label={t('Previous page')} onClick={prev}>
              <IconChevronLeft size={16} />
            </IconButton>
            <IconButton size="sm" label={t('Next page')} onClick={next}>
              <IconChevronRight size={16} />
            </IconButton>
          </div>
          <p className="hidden min-w-0 max-w-[30%] truncate text-xs text-text-secondary sm:block" title={chapterLabel}>
            {chapterLabel}
          </p>
          <label className="flex min-w-0 flex-1 items-center gap-3">
            <span className="sr-only">{t('Reading progress')}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progress ?? 0}
              disabled={!locationsReady}
              onChange={(e) => {
                const v = Number(e.target.value)
                setProgress(v)
                const cfi = bookRef.current?.locations.cfiFromPercentage(v / 100)
                if (cfi) rendition.current?.display(cfi)
              }}
              className="min-w-0 flex-1 accent-[var(--color-highlight)] disabled:opacity-40"
            />
            <span className="nd-mono w-12 text-right text-xs text-text-secondary">
              {progress !== null ? `${Math.round(progress)}%` : '—'}
            </span>
          </label>
          <div className="flex items-center gap-1">
            <IconButton
              size="sm"
              label={t('Smaller text')}
              onClick={() => setFontSize((s) => Math.max(70, s - 10))}
            >
              <IconMinus size={16} />
            </IconButton>
            <span className="nd-mono w-10 text-center text-xs text-text-secondary">{fontSize}%</span>
            <IconButton
              size="sm"
              label={t('Larger text')}
              onClick={() => setFontSize((s) => Math.min(200, s + 10))}
            >
              <IconPlus size={16} />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  )
}
