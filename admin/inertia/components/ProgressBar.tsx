import { useTranslation } from 'react-i18next'

const ProgressBar = ({ progress, speed }: { progress: number; speed?: string }) => {
  const { t } = useTranslation()
  if (progress >= 100) {
    return (
      <div className="flex items-center gap-2">
        <span className="nd-led text-desert-olive" aria-hidden="true" />
        <span className="text-sm text-desert-olive-dark">{t('Download complete')}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-led-off"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-highlight transition-[width] duration-[480ms] ease-[cubic-bezier(0.2,0,0,1)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      {speed && (
        <div className="mt-1 nd-mono text-xs text-text-muted">
          {t('Est. Speed: {{speed}}', { speed })}
        </div>
      )}
    </div>
  )
}

export default ProgressBar
