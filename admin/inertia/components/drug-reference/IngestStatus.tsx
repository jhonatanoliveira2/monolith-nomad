import { useEffect, useRef, useState } from 'react'
import type {
  DrugIngestStatus,
  DrugDownloadStatus,
  DrugIngestPhaseStatus,
} from '../../../types/drug_reference'
import { useTranslation } from 'react-i18next'
import { t } from '~/lib/i18n'
import { formatNumber } from '~/lib/format'

interface Props {
  status: DrugIngestStatus
  /** Called to refresh status — typically polls /api/drug-reference/status */
  onRefresh?: () => void
  /** Poll interval in ms while running. Default 3000. */
  pollIntervalMs?: number
}

/** Format a millisecond duration as "1h 04m", "6m 12s", or "12s". */
function fmtDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const sec = totalSec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

/** Format a byte count as "128 MB" / "1.7 GB". */
function fmtBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return ''
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${formatNumber(mb / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`
  return `${formatNumber(Math.round(mb))} MB`
}

/** One phase block: headline, explainer, progress bar, optional timing row. */
function PhaseBlock({
  title,
  state,
  pct,
  explainer,
  accentRunning,
  counterLeft,
  timing,
  failedReason,
}: {
  title: string
  state: 'idle' | 'running' | 'completed' | 'failed'
  pct: number
  explainer: string
  accentRunning: string
  counterLeft?: React.ReactNode
  timing?: React.ReactNode
  failedReason?: string
}) {
  const running = state === 'running'
  const completed = state === 'completed'
  const failed = state === 'failed'
  const accent = failed
    ? 'text-desert-red-dark'
    : completed
      ? 'text-desert-olive-dark'
      : running
        ? accentRunning
        : 'text-text-secondary'
  const barColor = failed
    ? 'bg-desert-red'
    : completed
      ? 'bg-desert-olive'
      : running
        ? accentRunning.replace('text-', 'bg-')
        : 'bg-surface-elevated'

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-sm font-semibold ${accent}`}>
          {title}
          {running ? ' …' : ''}
        </span>
        {(running || completed) && (
          <span className={`text-xs font-semibold ${accent} tabular-nums shrink-0`}>{pct}%</span>
        )}
      </div>

      <p className="text-xs text-text-secondary">{explainer}</p>

      {counterLeft && (
        <div className="text-xs text-text-secondary tabular-nums">{counterLeft}</div>
      )}

      {(running || completed || failed) && (
        <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${failed ? 100 : pct}%` }}
          />
        </div>
      )}

      {timing}

      {failed && failedReason && (
        <p className="text-xs text-desert-red-dark font-mono break-words bg-desert-red-lighter rounded px-2 py-1">
          {failedReason}
        </p>
      )}
    </div>
  )
}

/** Download-phase explainer copy. */
function downloadExplainer(d: DrugDownloadStatus): string {
  if (d.state === 'failed') {
    return t(
      'The download failed — it retries automatically; if it stays failed, press "{{button}}" to restart. Finished parts are kept and resume where they left off.',
      { button: t('Download FDA data') }
    )
  }
  if (d.state === 'completed') {
    return t('All parts are on disk. Indexing them into search next.')
  }
  if (d.state === 'running') {
    return d.totalParts > 0
      ? t('Pulling part {{part}} of {{total}} — ~{{size}} total across all parts.', {
          part: d.partsDone + 1,
          total: d.totalParts,
          size: `${formatNumber(1.7)} GB`,
        })
      : t('Reading the openFDA download manifest…')
  }
  return t('Not started.')
}

/** Ingest-phase explainer copy. */
function ingestExplainer(i: DrugIngestPhaseStatus, rowCount: number): string {
  if (i.state === 'failed') {
    return t(
      'Indexing failed — press "{{button}}" to retry from the downloaded files (no re-download). Already-indexed labels are kept (the refresh is idempotent).',
      { button: t('Ingest into search') }
    )
  }
  if (i.state === 'completed') {
    return t('{{n}} labels are now searchable offline.', { n: formatNumber(rowCount) })
  }
  if (i.state === 'running') {
    return i.totalParts > 0
      ? t('Writing part {{part}} of {{total}} into the offline database.', { part: i.partsDone + 1, total: i.totalParts })
      : t('Writing labels into the offline database.')
  }
  return t('Waiting for downloaded data.')
}

/**
 * Two-phase status panel for the Drug Reference download + ingest.
 *
 * Renders a download block (parts/bytes progress) and an ingest block (records
 * "X of ~Nk labels" counter). Each block scopes its own failed/stalled copy.
 * The top-level status.phase drives elapsed/ETA placement on the active phase.
 * Auto-polls /status while either phase is running and ticks the clock between
 * polls.
 */
export default function IngestStatus({ status, onRefresh, pollIntervalMs = 3000 }: Props) {
  const { t } = useTranslation()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())

  const busy = status.phase === 'downloading' || status.phase === 'ingesting'

  // Poll status while a phase is running.
  useEffect(() => {
    if (busy && onRefresh) {
      pollRef.current = setInterval(onRefresh, pollIntervalMs)
    } else if (pollRef.current) {
      clearInterval(pollRef.current)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [busy, onRefresh, pollIntervalMs])

  // Tick a local clock every second while busy so elapsed/ETA advance smoothly.
  useEffect(() => {
    if (!busy) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [busy])

  const { download, ingest } = status

  // ── Download bar ─────────────────────────────────────────────────────────
  const dlPct =
    download.state === 'completed'
      ? 100
      : download.totalParts > 0
        ? Math.min(100, Math.round((download.partsDone / download.totalParts) * 100))
        : 0
  const dlBytes = download.bytesDownloaded ? fmtBytes(download.bytesDownloaded) : ''

  // ── Ingest bar (records-based) ───────────────────────────────────────────
  const expected = ingest.expectedTotal > 0 ? ingest.expectedTotal : 0
  const ingPct =
    ingest.state === 'completed'
      ? 100
      : expected > 0
        ? Math.min(100, Math.round((ingest.records / expected) * 100))
        : ingest.totalParts > 0
          ? Math.min(100, Math.round((ingest.partsDone / ingest.totalParts) * 100))
          : 0

  // ── Timing (on the active phase only) ────────────────────────────────────
  const elapsedMs = status.startedAtMs ? Math.max(0, now - status.startedAtMs) : null
  const etaMs =
    status.phase === 'ingesting' && elapsedMs !== null && expected > 0 && ingest.records > 2000
      ? (elapsedMs * (expected - ingest.records)) / ingest.records
      : null

  const downloadTiming =
    status.phase === 'downloading' && elapsedMs !== null ? (
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-text-secondary tabular-nums">
        <span>{t('Elapsed {{duration}}', { duration: fmtDuration(elapsedMs) })}</span>
        {dlBytes && <span>{t('{{size}} this part', { size: dlBytes })}</span>}
      </div>
    ) : null

  const ingestTiming =
    status.phase === 'ingesting' && elapsedMs !== null ? (
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-text-secondary tabular-nums">
        <span>{t('Elapsed {{duration}}', { duration: fmtDuration(elapsedMs) })}</span>
        {etaMs !== null && (
          <span>
            {t('~{{duration}} left', { duration: fmtDuration(etaMs) })}{' '}
            <span className="text-text-muted">{t('(estimate)')}</span>
          </span>
        )}
      </div>
    ) : null

  return (
    <div className="text-left space-y-4">
      {/* Download phase */}
      <PhaseBlock
        title={t('Download FDA data')}
        state={download.state}
        pct={dlPct}
        explainer={downloadExplainer(download)}
        accentRunning="text-text-primary"
        timing={downloadTiming}
        failedReason={download.failedReason}
      />

      {/* Ingest phase */}
      <PhaseBlock
        title={t('Ingest into search')}
        state={ingest.state}
        pct={ingPct}
        explainer={ingestExplainer(ingest, status.rowCount)}
        accentRunning="text-text-primary"
        counterLeft={
          ingest.state === 'running' || ingest.state === 'completed' ? (
            <span>
              <span className="text-sm font-semibold text-text-primary">
                {formatNumber(ingest.records)}
              </span>
              {expected > 0 && (
                <span className="text-text-muted">
                  {' '}
                  {t('of ~{{n}} labels', { n: formatNumber(expected) })}
                </span>
              )}
            </span>
          ) : undefined
        }
        timing={ingestTiming}
        failedReason={ingest.failedReason}
      />

      {/* Reassurance while busy */}
      {busy && (
        <p className="text-xs text-text-muted">
          {t(
            'Runs in the background — you can leave this page and it keeps going. Search turns on automatically when ingest finishes.'
          )}
        </p>
      )}

      {/* Ready footer */}
      {status.phase === 'ready' && status.lastUpdated && (
        <p className="text-xs text-text-secondary">
          {t('FDA data version {{version}}.', { version: status.lastUpdated })}
        </p>
      )}
    </div>
  )
}
