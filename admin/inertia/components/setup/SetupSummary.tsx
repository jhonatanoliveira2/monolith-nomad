import { IconAlertTriangle, IconLoader2 } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import classNames from '~/lib/class_names'
import { formatBytes } from '~/lib/util'

export type SummaryLine = {
  label: string
  bytes: number | null
  pending?: boolean
  detail?: string
}

/**
 * Always-visible totals: what each part adds, the download total, the free space and what is left
 * after installing. Sizes come from the manifests and from the measured map extract.
 */
export default function SetupSummary({
  lines,
  totalBytes,
  freeBytes,
  diskBytes,
  measuring,
  children,
}: {
  lines: SummaryLine[]
  totalBytes: number
  freeBytes: number | null
  diskBytes: number | null
  measuring: boolean
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const after = freeBytes !== null ? freeBytes - totalBytes : null
  const tooBig = after !== null && after < 0
  const tight = !tooBig && after !== null && diskBytes ? after < diskBytes * 0.1 : false
  const usedPct =
    diskBytes && freeBytes !== null ? ((diskBytes - freeBytes) / diskBytes) * 100 : null
  const addPct = diskBytes ? (totalBytes / diskBytes) * 100 : 0

  return (
    <aside className="nd-card p-5" aria-label={t('Selection summary')}>
      <p className="nd-eyebrow">{t('Summary')}</p>
      <dl className="mt-4 space-y-2.5">
        {lines.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="min-w-0 text-text-secondary">
              {l.label}
              {l.detail && (
                <span className="block truncate text-xs text-text-muted">{l.detail}</span>
              )}
            </dt>
            <dd className="nd-mono shrink-0 text-text-primary">
              {l.pending ? (
                <IconLoader2 size={14} className="inline animate-spin text-text-muted" />
              ) : l.bytes === null ? (
                '—'
              ) : (
                formatBytes(l.bytes, 1)
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="my-4 nd-rule" />
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-text-primary">{t('Total download')}</span>
        <span className="nd-display text-2xl text-text-primary" aria-live="polite">
          {formatBytes(totalBytes, 1)}
        </span>
      </div>
      {measuring && (
        <p className="mt-1 text-xs text-text-muted">{t('Measuring the map size...')}</p>
      )}

      {diskBytes !== null && freeBytes !== null && (
        <div className="mt-4">
          <div
            className="relative h-2 overflow-hidden rounded-full bg-led-off"
            role="img"
            aria-label={t('Disk after installing: {{free}} free', {
              free: formatBytes(Math.max(0, after ?? 0), 1),
            })}
          >
            <div
              className="absolute inset-y-0 left-0 bg-text-muted"
              style={{ width: `${usedPct}%` }}
            />
            <div
              className={classNames(
                'absolute inset-y-0',
                tooBig ? 'bg-desert-red' : 'bg-highlight'
              )}
              style={{ left: `${usedPct}%`, width: `${Math.min(addPct, 100 - (usedPct ?? 0))}%` }}
            />
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-text-muted">{t('Free now')}</dt>
              <dd className="nd-mono text-text-primary">{formatBytes(freeBytes, 1)}</dd>
            </div>
            <div className="text-right">
              <dt className="text-text-muted">{t('Free after')}</dt>
              <dd
                className={classNames(
                  'nd-mono',
                  tooBig ? 'text-desert-red-dark' : 'text-text-primary'
                )}
              >
                {after !== null && after >= 0 ? formatBytes(after, 1) : '—'}
              </dd>
            </div>
          </dl>
          {(tooBig || tight) && (
            <p
              role="alert"
              className={classNames(
                'mt-3 flex gap-2 rounded-xl border px-3 py-2 text-xs',
                tooBig
                  ? 'border-desert-red-light bg-desert-red-lighter text-desert-red-dark'
                  : 'border-desert-orange-light bg-desert-orange-lighter text-desert-orange-dark'
              )}
            >
              <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
              {tooBig
                ? t('Not enough free space. Remove items or choose smaller profiles.')
                : t('Less than 10% of the disk will be left free.')}
            </p>
          )}
        </div>
      )}
      {children && <div className="mt-5 space-y-2">{children}</div>}
    </aside>
  )
}
