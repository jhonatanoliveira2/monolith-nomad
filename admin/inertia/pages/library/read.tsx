import { Head, Link } from '@inertiajs/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconArrowLeft,
  IconDownload,
  IconInfoCircle,
  IconList,
  IconMoon,
  IconSearch,
  IconSparkles,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import AppShell from '~/layouts/AppShell'
import Badge from '~/components/nd/Badge'
import IconButton from '~/components/nd/IconButton'
import PdfReader from '~/components/reader/PdfReader'
import EpubReader from '~/components/reader/EpubReader'
import type { ReaderApi, ReaderPanel } from '~/components/reader/types'
import ReaderAssistantPanel from '~/components/reader/ReaderAssistantPanel'
import { useThemeContext } from '~/providers/ThemeProvider'
import { pushRecent, RECENT_KEY, type RecentDocument } from '~/lib/library_filters'
import type { LibraryLicense } from '../../../types/library'

type Props = {
  filename: string
  format: 'pdf' | 'epub' | null
  title: string
  authors: string[]
  license: LibraryLicense | null
  sourceUrl: string | null
}

/**
 * Offline reader for an installed PDF or EPUB: one toolbar (back, title, contents, search, details)
 * over the format's own viewer. The global navigation shrinks to the icon rail so the page gets the
 * width.
 */
export default function LibraryReader(props: Props) {
  const { t } = useTranslation()
  const { theme } = useThemeContext()
  const url = `/api/library/files/${encodeURIComponent(props.filename)}`
  const [panel, setPanel] = useState<ReaderPanel>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches
      ? 'contents'
      : null
  )
  const [darkPages, setDarkPages] = useState(false)
  const readerApi = useRef<ReaderApi | null>(null)
  // A cited page or chapter from an answer (?page=12 / ?href=chapter.xhtml) opens directly
  const initial = useMemo(() => {
    if (typeof window === 'undefined') return { page: undefined, href: undefined }
    const q = new URLSearchParams(window.location.search)
    const page = Number(q.get('page'))
    return {
      page: Number.isInteger(page) && page > 0 ? page : undefined,
      href: q.get('href') || undefined,
    }
  }, [])

  // "Continue reading" on the library page
  useEffect(() => {
    if (props.format !== 'pdf' && props.format !== 'epub') return
    try {
      const list: RecentDocument[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
      const next = pushRecent(Array.isArray(list) ? list : [], {
        filename: props.filename,
        title: props.title,
        format: props.format,
        at: Date.now(),
      })
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {}
  }, [props.filename, props.format, props.title])

  const toggle = (p: Exclude<ReaderPanel, null>) => setPanel((cur) => (cur === p ? null : p))

  const info = (
    <div className="space-y-5">
      <div>
        <p className="nd-eyebrow mb-2">{t('About this work')}</p>
        <p className="font-medium text-text-primary">{props.title}</p>
        {props.authors.length > 0 && (
          <p className="mt-1 text-sm text-text-secondary">{props.authors.join(', ')}</p>
        )}
      </div>
      {props.license && (
        <div>
          <p className="nd-eyebrow mb-2">{t('License')}</p>
          <a
            href={props.license.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-text-primary underline decoration-border-default underline-offset-4 hover:decoration-text-primary"
          >
            {props.license.name}
          </a>
          {props.license.attribution && (
            <p className="mt-1 text-sm text-text-muted">{props.license.attribution}</p>
          )}
        </div>
      )}
      {props.sourceUrl && (
        <div>
          <p className="nd-eyebrow mb-2">{t('Origin')}</p>
          <a
            href={props.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-text-secondary underline decoration-border-default underline-offset-4 hover:text-text-primary"
          >
            {t('Official source')}
          </a>
        </div>
      )}
      <div>
        <p className="nd-eyebrow mb-2">{t('Shortcuts')}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm text-text-secondary">
          <dt>
            <kbd className="nd-kbd">←</kbd> <kbd className="nd-kbd">→</kbd>
          </dt>
          <dd>{t('Previous / next page')}</dd>
          <dt>
            <kbd className="nd-kbd">Ctrl F</kbd>
          </dt>
          <dd>{t('Search in this document')}</dd>
        </dl>
      </div>
    </div>
  )

  return (
    <AppShell variant="immersive">
      <Head title={props.title} />
      <div className="flex h-[100dvh] flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-2 py-2 sm:px-3 nd-glass">
          <Link
            href="/library"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
          >
            <IconArrowLeft size={16} />
            <span className="hidden sm:inline">{t('Library')}</span>
          </Link>
          <div className="min-w-0 flex-1 px-1">
            <h1 className="truncate text-sm font-medium text-text-primary sm:text-base">
              {props.title}
            </h1>
            <p className="truncate text-xs text-text-muted">{props.authors.join(', ')}</p>
          </div>
          {props.format && <Badge className="hidden sm:inline-flex">{props.format}</Badge>}
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton
              label={t('Contents')}
              active={panel === 'contents'}
              aria-pressed={panel === 'contents'}
              onClick={() => toggle('contents')}
            >
              <IconList size={18} />
            </IconButton>
            <IconButton
              label={t('Local assistant')}
              active={panel === 'assistant'}
              aria-pressed={panel === 'assistant'}
              onClick={() => toggle('assistant')}
            >
              <IconSparkles size={18} />
            </IconButton>
            <IconButton
              label={t('Search in this document')}
              active={panel === 'search'}
              aria-pressed={panel === 'search'}
              onClick={() => toggle('search')}
            >
              <IconSearch size={18} />
            </IconButton>
            {props.format === 'pdf' && (
              <IconButton
                label={t('Dark pages')}
                active={darkPages}
                aria-pressed={darkPages}
                onClick={() => setDarkPages((v) => !v)}
              >
                <IconMoon size={18} />
              </IconButton>
            )}
            <IconButton
              label={props.format === 'epub' ? t('Reading settings and details') : t('Details')}
              active={panel === 'info'}
              aria-pressed={panel === 'info'}
              onClick={() => toggle('info')}
            >
              <IconInfoCircle size={18} />
            </IconButton>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-10 items-center justify-center rounded-full text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
              title={t('Open file')}
              aria-label={t('Open file')}
            >
              <IconDownload size={18} />
            </a>
          </div>
        </header>

        {props.format === 'pdf' ? (
          <PdfReader
            key={props.filename}
            url={url}
            filename={props.filename}
            panel={panel}
            setPanel={setPanel}
            info={info}
            darkPages={darkPages}
            apiRef={readerApi}
            initialPage={initial.page}
            assistant={<ReaderAssistantPanel filename={props.filename} apiRef={readerApi} />}
          />
        ) : props.format === 'epub' ? (
          <EpubReader
            key={props.filename}
            url={url}
            filename={props.filename}
            panel={panel}
            setPanel={setPanel}
            info={info}
            appTheme={theme}
            apiRef={readerApi}
            initialHref={initial.href}
            assistant={<ReaderAssistantPanel filename={props.filename} apiRef={readerApi} />}
          />
        ) : (
          <p className="p-6 text-text-secondary">{t('Unsupported file format.')}</p>
        )}
      </div>
    </AppShell>
  )
}
