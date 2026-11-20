import { computeJobHealth, type JobHealthStatus } from '../../app/utils/kb_job_health.js'

export { computeJobHealth, type JobHealthStatus } from '../../app/utils/kb_job_health.js'
import { t } from './i18n'

/**
 * Visual presentation for each health status — pill color, dot color, and the
 * short label rendered alongside the dot (English; translated at render with
 * t()). Kept in one place so backend health
 * decisions (`computeJobHealth`) and frontend rendering stay in sync.
 */
export const JOB_HEALTH_DISPLAY: Record<
  JobHealthStatus,
  { dot: string; label: string; ariaLabel: string }
> = {
  waiting: {
    dot: 'bg-desert-stone',
    label: 'Waiting',
    ariaLabel: 'Job is queued and waiting to start',
  },
  healthy: {
    dot: 'bg-desert-olive',
    label: 'Active',
    ariaLabel: 'Job is embedding at a normal rate',
  },
  slow: {
    dot: 'bg-desert-orange',
    label: 'Slow',
    ariaLabel: 'Job has not made progress for at least 2 minutes',
  },
  stalled: {
    dot: 'bg-desert-red/60',
    label: 'Stalled',
    ariaLabel: 'Job has not made progress for at least 5 minutes',
  },
  failed: {
    dot: 'bg-desert-red ring-2 ring-desert-red/40',
    label: 'Failed',
    ariaLabel: 'Job failed',
  },
}

/**
 * Format a relative timestamp as "Xs ago", "Xm ago", "Xh ago" with sensible
 * thresholds for the KB Processing Queue's "Last activity" line.
 */
export function formatTimeAgo(timestampMs: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestampMs) / 1000))
  if (seconds < 5) return t('just now')
  if (seconds < 60) return t('{{count}}s ago', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('{{count}}m ago', { count: minutes })
  const hours = Math.floor(minutes / 60)
  return t('{{count}}h ago', { count: hours })
}

/**
 * Convenience wrapper that resolves a job's health status without the caller
 * having to remember to pass `now`. Mostly for ergonomic frontend use.
 */
export function computeJobHealthNow(
  input: Omit<Parameters<typeof computeJobHealth>[0], 'now'>
): JobHealthStatus {
  return computeJobHealth({ ...input, now: Date.now() })
}
