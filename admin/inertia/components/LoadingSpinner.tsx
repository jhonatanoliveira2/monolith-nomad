import { useTranslation } from 'react-i18next'
import classNames from '~/lib/class_names'

interface LoadingSpinnerProps {
  text?: string
  fullscreen?: boolean
  iconOnly?: boolean
  light?: boolean
  className?: string
}

/** Three LEDs breathing in sequence: the loading state everywhere in the app. */
function DotLoader({ light, large }: { light?: boolean; large?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={classNames(
            'rounded-full animate-nd-dots',
            large ? 'size-2.5' : 'size-2',
            light ? 'bg-white' : 'bg-led'
          )}
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  )
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text,
  fullscreen = false,
  iconOnly = false,
  light = false,
  className,
}) => {
  const { t } = useTranslation()
  const label = text || t('Loading...')

  if (!fullscreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={classNames('flex flex-col items-center justify-center gap-3 py-2', className)}
      >
        <DotLoader light={light} />
        {iconOnly ? (
          <span className="sr-only">{label}</span>
        ) : (
          <div className={classNames('nd-eyebrow', light ? '!text-white' : '')}>{label}</div>
        )}
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={classNames(
        'fixed inset-0 z-[100] flex items-center justify-center bg-scrim backdrop-blur-sm animate-nd-fade',
        className
      )}
    >
      <div className="flex flex-col items-center justify-center gap-4 rounded-[var(--radius-panel)] border border-border-default bg-surface-primary px-10 py-8">
        <DotLoader large />
        {iconOnly ? (
          <span className="sr-only">{label}</span>
        ) : (
          <div className="nd-eyebrow !text-text-secondary">{label}</div>
        )}
      </div>
    </div>
  )
}

export default LoadingSpinner
