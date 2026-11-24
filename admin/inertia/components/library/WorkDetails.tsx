import { Link } from '@inertiajs/react'
import {
  IconBook2,
  IconDownload,
  IconExternalLink,
  IconLoader2,
  IconRefresh,
  IconShieldCheck,
  IconTrash,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Badge from '~/components/nd/Badge'
import StatusDot from '~/components/nd/StatusDot'
import StyledButton from '~/components/StyledButton'
import { fileSize, isInstalled, LEVEL_ORDER, languageLabel } from '~/lib/library_filters'
import { formatBytes } from '~/lib/util'

/** Secondary small button look for links (a link must not wrap a <button>). */
const LINK_BUTTON =
  'inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-elevated px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors duration-[140ms] hover:border-text-secondary'
import type {
  LibraryArea,
  LibraryFileWithStatus,
  LibraryItemWithStatus,
} from '../../../types/library'
import { LEVEL_LABEL } from './LevelDots'

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="nd-eyebrow !text-[10px]">{label}</dt>
      <dd className="mt-1 text-sm text-text-primary">{children}</dd>
    </div>
  )
}

function FileRow({
  item,
  file,
  kiwixUrl,
  busy,
  onDownload,
  onRemove,
}: {
  item: LibraryItemWithStatus
  file: LibraryFileWithStatus
  kiwixUrl: string | null
  busy: boolean
  onDownload: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const size = fileSize(file)
  const isDoc = file.format !== 'zim'
  const installed = isInstalled(file)
  const pinned = isDoc && 'sha256' in file && !!file.sha256

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <Badge tone={installed ? 'solid' : 'neutral'}>{file.format}</Badge>
        <span className="nd-mono text-xs text-text-secondary">{size ? formatBytes(size, 1) : '—'}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-text-muted">
          <StatusDot
            tone={
              file.status === 'downloading'
                ? 'live'
                : file.status === 'update_available'
                  ? 'warn'
                  : installed
                    ? 'ok'
                    : 'idle'
            }
          />
          {file.status === 'downloading'
            ? t('Downloading...')
            : file.status === 'update_available'
              ? t('Update available')
              : installed
                ? t('Downloaded')
                : t('Not downloaded')}
        </span>
      </div>
      {isDoc && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
          <IconShieldCheck size={13} />
          {pinned
            ? t('Checked against the publisher SHA-256 after download')
            : t('Continuously rebuilt by the publisher: the format is checked instead of a fixed hash')}
        </p>
      )}
      {!isDoc && (
        <p className="mt-2 text-xs text-text-muted">
          {t('Opens in the Kiwix reader. ZIM files are managed in the Content Manager.')}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {(file.status === 'available' || file.status === 'update_available') && (
          <StyledButton size="sm" variant="primary" onClick={onDownload} loading={busy} disabled={busy}>
            <span className="inline-flex items-center gap-1.5">
              {file.status === 'update_available' ? <IconRefresh size={14} /> : <IconDownload size={14} />}
              {file.status === 'update_available' ? t('Update') : t('Download')}
            </span>
          </StyledButton>
        )}
        {file.status === 'downloading' && (
          <Link href="/downloads" className={LINK_BUTTON}>
            <IconLoader2 size={14} className="animate-spin" /> {t('View downloads')}
          </Link>
        )}
        {installed && isDoc && file.filename && (
          <Link href={`/library/read/${file.filename}`} className={LINK_BUTTON}>
            <IconBook2 size={14} /> {t('Read now')}
          </Link>
        )}
        {installed && !isDoc && kiwixUrl && (
          <a href={kiwixUrl} target="_blank" rel="noreferrer" className={LINK_BUTTON}>
            <IconExternalLink size={14} /> {t('Open in Kiwix')}
          </a>
        )}
        {installed && isDoc && !confirming && (
          <StyledButton
            size="sm"
            variant="ghost"
            onClick={() => setConfirming(true)}
            disabled={busy}
            aria-label={t('Remove {{format}} of {{title}}', {
              format: file.format.toUpperCase(),
              title: item.title,
            })}
          >
            <span className="inline-flex items-center gap-1.5">
              <IconTrash size={14} /> {t('Remove')}
            </span>
          </StyledButton>
        )}
        {confirming && (
          <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-desert-red-light bg-desert-red-lighter py-1 pl-3 pr-1 text-xs text-desert-red-dark">
            {t('Remove the downloaded {{format}}?', { format: file.format.toUpperCase() })}
            <StyledButton
              size="sm"
              variant="danger"
              onClick={() => {
                setConfirming(false)
                onRemove()
              }}
            >
              {t('Remove')}
            </StyledButton>
            <StyledButton size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              {t('Cancel')}
            </StyledButton>
          </span>
        )}
      </div>
    </li>
  )
}

/** Everything about one work: what it is, who made it, its files, and where it comes from. */
export default function WorkDetails({
  item,
  areas,
  kiwixUrl,
  busyKey,
  onDownload,
  onRemove,
  onSubject,
}: {
  item: LibraryItemWithStatus
  areas: Map<string, LibraryArea>
  kiwixUrl: string | null
  busyKey: string | null
  onDownload: (file: LibraryFileWithStatus) => void
  onRemove: (file: LibraryFileWithStatus) => void
  onSubject: (subject: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-7">
      <p className="text-sm leading-relaxed text-text-secondary">{item.description}</p>

      {item.notes && (
        <p className="rounded-2xl border border-desert-orange-light bg-desert-orange-lighter px-4 py-3 text-sm text-desert-orange-dark">
          {item.notes}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Meta label={t('Authors')}>{item.authors.join(', ')}</Meta>
        <Meta label={t('Publisher')}>{item.publisher}</Meta>
        <Meta label={t('Edition')}>{item.edition}</Meta>
        <Meta label={t('Year')}>{item.year}</Meta>
        <Meta label={t('Language')}>{t(languageLabel(item.language))}</Meta>
        <Meta label={t('Level')}>
          {LEVEL_ORDER.filter((l) => item.levels.includes(l))
            .map((l) => t(LEVEL_LABEL[l]))
            .join(', ')}
        </Meta>
        <div className="col-span-2">
          <Meta label={t('Areas')}>
            {item.areas.map((a) => areas.get(a)?.name ?? a).join(' · ')}
          </Meta>
        </div>
      </dl>

      <div>
        <p className="nd-eyebrow mb-2.5 !text-[10px]">{t('Subjects')}</p>
        <div className="flex flex-wrap gap-1.5">
          {item.subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSubject(s)}
              className="rounded-full border border-border-default px-3 py-1 text-xs text-text-secondary hover:border-text-muted hover:text-text-primary cursor-pointer"
              title={t('Show works about {{subject}}', { subject: s })}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="nd-eyebrow mb-3 !text-[10px]">{t('Files')}</p>
        <ul className="nd-card divide-y divide-border-subtle px-4 py-4">
          {item.files.map((file) => (
            <FileRow
              key={file.format}
              item={item}
              file={file}
              kiwixUrl={kiwixUrl}
              busy={busyKey === `${item.id}:${file.format}`}
              onDownload={() => onDownload(file)}
              onRemove={() => onRemove(file)}
            />
          ))}
        </ul>
      </div>

      <div>
        <p className="nd-eyebrow mb-3 !text-[10px]">{t('Origin and license')}</p>
        <div className="space-y-2 text-sm">
          <p>
            <a
              href={item.license.url}
              target="_blank"
              rel="noreferrer"
              className="text-text-primary underline decoration-border-default underline-offset-4 hover:decoration-text-primary"
            >
              {item.license.name}
            </a>
          </p>
          {item.license.attribution && (
            <p className="text-text-secondary">{item.license.attribution}</p>
          )}
          <p className="text-text-muted">
            {t('Downloaded from the official source and kept unmodified.')}{' '}
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-text-secondary underline decoration-border-default underline-offset-4 hover:text-text-primary"
            >
              {t('Official source')} <IconExternalLink size={12} />
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
