import { Link } from '@inertiajs/react'
import { IconBook2, IconDownload, IconExternalLink, IconLoader2 } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import Badge from '~/components/nd/Badge'
import StatusDot from '~/components/nd/StatusDot'
import { contentLanguageInfo } from '~/lib/content_language'
import { isInstalled, itemAvailability } from '~/lib/library_filters'
import type {
  LibraryArea,
  LibraryFileWithStatus,
  LibraryItemWithStatus,
} from '../../../types/library'
import LevelDots from './LevelDots'

/**
 * One work in the catalogue. The card opens the details sheet; the single quick action is the next
 * step for that work (read, open in Kiwix, or download its first file), so the grid stays scannable.
 */
export default function WorkCard({
  item,
  areas,
  kiwixUrl,
  busy,
  onOpen,
  onDownload,
}: {
  item: LibraryItemWithStatus
  areas: Map<string, LibraryArea>
  kiwixUrl: string | null
  busy: boolean
  onOpen: () => void
  onDownload: (file: LibraryFileWithStatus) => void
}) {
  const { t } = useTranslation()
  const availability = itemAvailability(item)
  const readable = item.files.find((f) => isInstalled(f) && f.format !== 'zim' && f.filename)
  const zimInstalled = item.files.find((f) => isInstalled(f) && f.format === 'zim')
  const downloadable = item.files.find((f) => f.status === 'available')
  const lang = contentLanguageInfo(item.language)

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <article
      className="nd-card nd-card-interactive group relative flex flex-col p-5 animate-nd-fade cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="nd-eyebrow truncate">{areas.get(item.areas[0])?.name ?? item.areas[0]}</p>
        <span className="inline-flex shrink-0 items-center gap-1.5 nd-mono text-[10px] uppercase tracking-wider text-text-muted">
          <StatusDot
            tone={availability === 'offline' ? 'ok' : availability === 'downloading' ? 'live' : 'idle'}
          />
          {availability === 'offline'
            ? t('On your shelf')
            : availability === 'downloading'
              ? t('Downloading')
              : t('Available')}
        </span>
      </div>

      <h3 className="mt-3 text-base font-medium leading-snug text-text-primary">
        {/* the title is the accessible trigger for the details sheet */}
        <button
          type="button"
          onClick={(e) => {
            stop(e)
            onOpen()
          }}
          className="text-left after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:after:rounded-[var(--radius-card)] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-accent cursor-pointer"
        >
          <span className="line-clamp-2">{item.title}</span>
        </button>
      </h3>
      <p className="mt-1 text-xs text-text-muted truncate">
        {item.authors.join(', ')} · {item.year}
      </p>
      <p className="mt-3 text-sm text-text-secondary line-clamp-2">{item.description}</p>

      <div className="mt-auto flex items-center gap-2 pt-5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {item.files.map((f) => (
            <Badge key={f.format} tone={isInstalled(f) ? 'solid' : 'neutral'}>
              {f.format}
            </Badge>
          ))}
          {lang && lang.kind !== 'portuguese' && <Badge title={t(lang.label)}>{lang.short}</Badge>}
          <LevelDots levels={item.levels} className="ml-1" />
        </div>
        <div className="relative z-10 shrink-0" onClick={stop}>
          {readable ? (
            <Link
              href={`/library/read/${readable.filename}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast hover:opacity-90"
            >
              <IconBook2 size={14} /> {t('Read now')}
            </Link>
          ) : zimInstalled && kiwixUrl ? (
            <a
              href={kiwixUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border-default px-3 py-1.5 text-xs font-medium text-text-primary hover:border-text-muted"
            >
              <IconExternalLink size={14} /> {t('Open')}
            </a>
          ) : availability === 'downloading' ? (
            <span className="inline-flex items-center gap-1.5 px-1 text-xs text-text-muted">
              <IconLoader2 size={14} className="animate-spin" />
            </span>
          ) : downloadable ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDownload(downloadable)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-default px-3 py-1.5 text-xs font-medium text-text-primary hover:border-text-muted disabled:opacity-50 cursor-pointer"
              aria-label={t('Download {{format}} of {{title}}', {
                format: downloadable.format.toUpperCase(),
                title: item.title,
              })}
            >
              {busy ? <IconLoader2 size={14} className="animate-spin" /> : <IconDownload size={14} />}
              {downloadable.format.toUpperCase()}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
