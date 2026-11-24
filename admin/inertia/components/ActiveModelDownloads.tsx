import { useCallback, useRef, useState } from 'react'
import useOllamaModelDownloads from '~/hooks/use_ollama_model_downloads'
import StyledSectionHeader from './StyledSectionHeader'
import StyledModal from './StyledModal'
import { IconAlertTriangle, IconLoader2, IconX } from '@tabler/icons-react'
import api from '~/lib/api'
import { useModals } from '~/context/modal_context'
import { formatBytes } from '~/lib/util'
import { formatSpeed } from '../../app/utils/misc'
import { useTranslation } from 'react-i18next'

interface ActiveModelDownloadsProps {
  withHeader?: boolean
}

const ActiveModelDownloads = ({ withHeader = false }: ActiveModelDownloadsProps) => {
  const { t } = useTranslation()
  const { downloads, removeDownload } = useOllamaModelDownloads()
  const { openModal, closeAllModals } = useModals()
  const [cancellingModels, setCancellingModels] = useState<Set<string>>(new Set())

  // Track previous downloadedBytes for speed calculation — mirrors the approach in
  // ActiveDownloads.tsx so content + model downloads feel identical.
  const prevBytesRef = useRef<Map<string, { bytes: number; time: number }>>(new Map())
  const speedRef = useRef<Map<string, number[]>>(new Map())

  const getSpeed = useCallback((model: string, currentBytes?: number): number => {
    if (!currentBytes || currentBytes <= 0) return 0

    const prev = prevBytesRef.current.get(model)
    const now = Date.now()

    if (prev && prev.bytes > 0 && currentBytes > prev.bytes) {
      const deltaBytes = currentBytes - prev.bytes
      const deltaSec = (now - prev.time) / 1000
      if (deltaSec > 0) {
        const instantSpeed = deltaBytes / deltaSec

        // Simple moving average (last 5 samples)
        const samples = speedRef.current.get(model) || []
        samples.push(instantSpeed)
        if (samples.length > 5) samples.shift()
        speedRef.current.set(model, samples)

        const avg = samples.reduce((a, b) => a + b, 0) / samples.length
        prevBytesRef.current.set(model, { bytes: currentBytes, time: now })
        return avg
      }
    }

    // Only set initial observation; never advance timestamp when bytes unchanged
    if (!prev) {
      prevBytesRef.current.set(model, { bytes: currentBytes, time: now })
    }
    return speedRef.current.get(model)?.at(-1) || 0
  }, [])

  const runCancel = async (download: { model: string; jobId?: string }) => {
    // Defensive guard: stale broadcasts during a hot upgrade may not include jobId.
    // Without it we have nothing to call the cancel API with.
    if (!download.jobId) return

    setCancellingModels((prev) => new Set(prev).add(download.model))
    try {
      await api.cancelDownloadJob(download.jobId)
      // Optimistically clear the entry — the Transmit cancelled broadcast usually
      // arrives within a second but we don't want to leave the row hanging if it doesn't.
      removeDownload(download.model)
      // Clean up speed tracking refs for this model
      prevBytesRef.current.delete(download.model)
      speedRef.current.delete(download.model)
    } finally {
      setCancellingModels((prev) => {
        const next = new Set(prev)
        next.delete(download.model)
        return next
      })
    }
  }

  const confirmCancel = (download: { model: string; jobId?: string }) => {
    if (!download.jobId) return

    openModal(
      <StyledModal
        title={t('Cancel Download?')}
        onConfirm={() => {
          closeAllModals()
          runCancel(download)
        }}
        onCancel={closeAllModals}
        open={true}
        confirmText={t('Cancel Download')}
        cancelText={t('Keep Downloading')}
      >
        <div className="space-y-3 text-text-primary">
          <p>
            {t('Stop downloading')}{' '}
            <span className="font-mono font-semibold">{download.model}</span>?
          </p>
          <p className="text-sm text-text-muted">
            {t(
              'Any data already downloaded will remain on disk. If you re-download this model later, it will resume from where it left off rather than starting over.'
            )}
          </p>
        </div>
      </StyledModal>,
      'confirm-cancel-model-download-modal'
    )
  }

  return (
    <>
      {withHeader && (
        <StyledSectionHeader title={t('Active Model Downloads')} className="mt-12 mb-4" />
      )}
      <div className="space-y-3">
        {downloads && downloads.length > 0 ? (
          downloads.map((download) => {
            const isCancelling = cancellingModels.has(download.model)
            const canCancel = !!download.jobId && !download.error
            const speed = getSpeed(download.model, download.downloadedBytes)
            const hasBytes = !!(download.downloadedBytes && download.totalBytes)

            return (
              <div
                key={download.model}
                className={`nd-card p-5 animate-nd-fade ${download.error ? '!border-desert-red-light' : ''}`}
              >
                {download.error ? (
                  <div className="flex items-center gap-2">
                    <IconAlertTriangle className="w-5 h-5 text-desert-red flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {download.model}
                      </p>
                      <p className="text-xs text-desert-red-dark mt-0.5">{download.error}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Title + Cancel button row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary truncate">{download.model}</p>
                        <span className="nd-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-border-default text-text-secondary">
                          ollama
                        </span>
                      </div>
                      {canCancel &&
                        (isCancelling ? (
                          <IconLoader2 className="w-4 h-4 text-text-muted animate-spin flex-shrink-0" />
                        ) : (
                          <button
                            onClick={() => confirmCancel(download)}
                            className="flex-shrink-0 p-1.5 rounded-full hover:bg-desert-red-lighter transition-colors"
                            title={t('Cancel download')}
                            aria-label={t('Cancel download')}
                          >
                            <IconX className="w-4 h-4 text-text-muted hover:text-desert-red" />
                          </button>
                        ))}
                    </div>

                    {/* Size info */}
                    <div className="flex justify-between items-baseline text-sm text-text-muted font-mono">
                      <span>
                        {hasBytes
                          ? `${formatBytes(download.downloadedBytes!, 1)} / ${formatBytes(download.totalBytes!, 1)}`
                          : `${download.percent.toFixed(1)}% / 100%`}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="relative flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-led-off overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out bg-highlight"
                          style={{ width: `${download.percent}%` }}
                        />
                      </div>
                      <div className="nd-mono text-xs text-text-primary w-10 text-right shrink-0">
                        {Math.round(download.percent)}%
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div className="flex items-center gap-2">
                      <div className="nd-led text-highlight animate-nd-blink" />
                      <span className="text-xs text-text-muted">
                        {t('Downloading...')}
                        {speed > 0 ? ` ${formatSpeed(speed)}` : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <p className="nd-card nd-dot-field px-5 py-6 text-sm text-text-muted">
            {t('No active model downloads')}
          </p>
        )}
      </div>
    </>
  )
}

export default ActiveModelDownloads
