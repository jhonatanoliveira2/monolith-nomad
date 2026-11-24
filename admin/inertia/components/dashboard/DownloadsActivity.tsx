import { Link } from '@inertiajs/react'
import { useQuery } from '@tanstack/react-query'
import { IconArrowRight } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import StatusDot from '~/components/nd/StatusDot'
import api from '~/lib/api'
import { extractFileName } from '~/lib/util'

/**
 * Downloads in progress, summarised on the dashboard: shown only while something is running or failed,
 * and always pointing to the Downloads screen for the controls.
 */
export default function DownloadsActivity() {
  const { t } = useTranslation()
  const { data: jobs } = useQuery({
    queryKey: ['download-jobs'],
    queryFn: () => api.listDownloadJobs(),
    refetchInterval: (q) => (q.state.data && q.state.data.length > 0 ? 3000 : 15000),
  })
  if (!jobs || jobs.length === 0) return null

  const failed = jobs.filter((j) => j.status === 'failed')
  const running = jobs.filter((j) => j.status !== 'failed')
  const avg = running.length
    ? running.reduce((sum, j) => sum + (Number(j.progress) || 0), 0) / running.length
    : 0

  return (
    <Link
      href="/downloads"
      className="nd-card nd-card-interactive group flex flex-col gap-4 p-5 sm:flex-row sm:items-center animate-nd-rise"
    >
      <div className="flex items-center gap-3 sm:w-64 shrink-0">
        <StatusDot tone={failed.length > 0 ? 'error' : 'live'} />
        <div>
          <p className="text-sm font-medium text-text-primary">
            {running.length === 1
              ? t('1 download in progress')
              : t('{{count}} downloads in progress', { count: running.length })}
          </p>
          {failed.length > 0 && (
            <p className="text-xs text-desert-red-dark">
              {failed.length === 1
                ? t('1 failed download')
                : t('{{count}} failed downloads', { count: failed.length })}
            </p>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {running.length > 0 && (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-xs text-text-secondary">
                {running
                  .slice(0, 2)
                  .map((j) => j.title || extractFileName(j.filepath) || j.url)
                  .join(' · ')}
                {running.length > 2 && ` +${running.length - 2}`}
              </p>
              <span className="nd-mono text-xs text-text-primary">{Math.round(avg)}%</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-led-off">
              <div
                className="h-full rounded-full bg-highlight transition-[width] duration-[480ms]"
                style={{ width: `${avg}%` }}
              />
            </div>
          </>
        )}
      </div>
      <span className="inline-flex items-center gap-1 text-sm text-text-secondary group-hover:text-text-primary shrink-0">
        {t('View downloads')}
        <IconArrowRight size={14} />
      </span>
    </Link>
  )
}
