import { Head, Link } from '@inertiajs/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconList,
  IconMinus,
  IconPlus,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import AppLayout from '~/layouts/AppLayout'
import StyledButton from '~/components/StyledButton'
import { useTheme } from '~/hooks/use_theme'
import type { LibraryLicense } from '../../../types/library'

type Props = {
  filename: string
  format: 'pdf' | 'epub' | null
  title: string
  authors: string[]
  license: LibraryLicense | null
  sourceUrl: string | null
}

type TocEntry = { label: string; href: string; subitems?: TocEntry[] }

const POSITION_KEY = (filename: string) => `nomad:library:position:${filename}`
const FONT_KEY = 'nomad:library:font-size'

/** EPUB reader on epub.js. The book renders in a sandboxed iframe with scripts disabled. */
function EpubReader({ url, filename }: { url: string; filename: string }) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const viewer = useRef<HTMLDivElement>(null)
  const rendition = useRef<any>(null)
  const [toc, setToc] = useState<TocEntry[]>([])
  const [showToc, setShowToc] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = Number(localStorage.getItem(FONT_KEY))
    return saved >= 70 && saved <= 200 ? saved : 100
  })

  useEffect(() => {
    let book: any
    let cancelled = false
    ;(async () => {
      try {
        const { default: ePub } = await import('epubjs')
        if (cancelled || !viewer.current) return
        book = ePub(url, { openAs: 'epub' })
        const r = book.renderTo(viewer.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'auto',
          allowScriptedContent: false,
        })
        rendition.current = r
        r.themes.register('dark', { body: { background: '#0a0a0a !important', color: '#e6e6e6 !important' }, a: { color: '#9fd0a8 !important' } })
        r.themes.register('light', { body: { background: '#ffffff !important', color: '#1a1a1a !important' } })
        r.themes.select(theme === 'dark' ? 'dark' : 'light')
        r.themes.fontSize(`${fontSize}%`)
        await r.display(localStorage.getItem(POSITION_KEY(filename)) || undefined)
        const nav = await book.loaded.navigation
        if (!cancelled) setToc(nav.toc ?? [])
        await book.ready
        await book.locations.generate(1600)
        r.on('relocated', (location: any) => {
          try {
            localStorage.setItem(POSITION_KEY(filename), location.start.cfi)
          } catch {}
          const pct = book.locations.percentageFromCfi(location.start.cfi)
          if (typeof pct === 'number') setProgress(Math.round(pct * 100))
        })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
      try {
        book?.destroy()
      } catch {}
      rendition.current = null
    }
    // The book is opened once per file; theme and font changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, filename])

  useEffect(() => {
    rendition.current?.themes.select(theme === 'dark' ? 'dark' : 'light')
  }, [theme])

  useEffect(() => {
    rendition.current?.themes.fontSize(`${fontSize}%`)
    try {
      localStorage.setItem(FONT_KEY, String(fontSize))
    } catch {}
  }, [fontSize])

  const prev = useCallback(() => rendition.current?.prev(), [])
  const next = useCallback(() => rendition.current?.next(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next])

  const renderToc = (entries: TocEntry[], depth = 0) =>
    entries.map((entry) => (
      <li key={entry.href}>
        <button
          type="button"
          onClick={() => {
            rendition.current?.display(entry.href)
            setShowToc(false)
          }}
          className="text-left w-full py-1 text-sm text-text-primary hover:underline"
          style={{ paddingLeft: depth * 12 }}
        >
          {entry.label.trim()}
        </button>
        {entry.subitems && entry.subitems.length > 0 && <ul>{renderToc(entry.subitems, depth + 1)}</ul>}
      </li>
    ))

  if (error) {
    return <p className="text-desert-red p-4">{t('Could not open this EPUB: {{error}}', { error })}</p>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <StyledButton size="sm" variant="secondary" onClick={() => setShowToc((v) => !v)} aria-expanded={showToc}>
          <span className="inline-flex items-center gap-1">
            <IconList size={14} /> {t('Contents')}
          </span>
        </StyledButton>
        <StyledButton size="sm" variant="ghost" onClick={() => setFontSize((s) => Math.max(70, s - 10))} aria-label={t('Smaller text')}>
          <IconMinus size={14} />
        </StyledButton>
        <span className="text-xs text-text-muted w-10 text-center">{fontSize}%</span>
        <StyledButton size="sm" variant="ghost" onClick={() => setFontSize((s) => Math.min(200, s + 10))} aria-label={t('Larger text')}>
          <IconPlus size={14} />
        </StyledButton>
        {progress !== null && <span className="text-xs text-text-muted ml-auto">{progress}%</span>}
      </div>
      <div className="relative flex-1 min-h-0 flex gap-3">
        {showToc && (
          <nav aria-label={t('Contents')} className="w-72 shrink-0 overflow-y-auto border border-desert-stone-light rounded-md p-3 bg-desert-white">
            <ul>{renderToc(toc)}</ul>
          </nav>
        )}
        <button type="button" onClick={prev} aria-label={t('Previous page')} className="shrink-0 px-1 text-text-secondary hover:text-text-primary">
          <IconChevronLeft size={28} />
        </button>
        <div ref={viewer} className="flex-1 min-w-0 h-full rounded-md border border-desert-stone-light bg-desert-white" />
        <button type="button" onClick={next} aria-label={t('Next page')} className="shrink-0 px-1 text-text-secondary hover:text-text-primary">
          <IconChevronRight size={28} />
        </button>
      </div>
    </div>
  )
}

export default function LibraryReader(props: Props) {
  const { t } = useTranslation()
  const url = `/api/library/files/${encodeURIComponent(props.filename)}`
  return (
    <AppLayout>
      <Head title={props.title} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col" style={{ height: 'calc(100vh - 5rem)' }}>
        <div className="flex flex-wrap items-center gap-3 pb-3">
          <Link href="/library" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:underline">
            <IconArrowLeft size={16} /> {t('Library')}
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-text-primary truncate">{props.title}</h1>
            <p className="text-xs text-text-muted truncate">
              {props.authors.join(', ')}
              {props.license && (
                <>
                  {' · '}
                  <a href={props.license.url} target="_blank" rel="noreferrer" className="underline">
                    {props.license.name}
                  </a>
                </>
              )}
              {props.sourceUrl && (
                <>
                  {' · '}
                  <a href={props.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                    {t('Official source')}
                  </a>
                </>
              )}
            </p>
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:underline">
            <IconExternalLink size={16} /> {t('Open file')}
          </a>
        </div>
        <div className="flex-1 min-h-0">
          {props.format === 'pdf' ? (
            // The browser's built-in PDF viewer (pdf.js in Firefox, PDFium in Chromium) works offline.
            <iframe src={url} title={props.title} className="w-full h-full rounded-md border border-desert-stone-light bg-white" />
          ) : props.format === 'epub' ? (
            <EpubReader url={url} filename={props.filename} />
          ) : (
            <p className="text-text-secondary">{t('Unsupported file format.')}</p>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
