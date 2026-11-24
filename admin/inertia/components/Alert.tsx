import classNames from '~/lib/class_names'
import DynamicIcon, { DynamicIconName } from './DynamicIcon'
import StyledButton, { StyledButtonProps } from './StyledButton'
import { useTranslation } from 'react-i18next'

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string
  message?: string
  type: 'warning' | 'error' | 'success' | 'info' | 'info-inverted'
  children?: React.ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  icon?: DynamicIconName
  variant?: 'standard' | 'bordered' | 'solid'
  buttonProps?: StyledButtonProps
}

type Tone = 'warning' | 'error' | 'success' | 'info'

/**
 * Notice block. Semantic colour only where it carries meaning (warning, error, success); information is
 * monochrome. `solid` is the strong form: a filled block for warning/error/success, and a raised
 * neutral panel for information, so the inverted primary button inside stays readable in both themes.
 */
export default function Alert({
  title,
  message,
  type,
  children,
  dismissible = false,
  onDismiss,
  icon,
  variant = 'standard',
  buttonProps,
  ...props
}: AlertProps) {
  const { t } = useTranslation()
  const tone: Tone = type === 'info-inverted' ? 'info' : type
  // Strong alerts are tinted panels with a semantic border, never a full slab of colour
  // (Nothing: accent colour used sparingly; meaning is carried by icon, title and border).
  const filled = false

  const defaultIcon: DynamicIconName =
    tone === 'warning'
      ? 'IconAlertTriangle'
      : tone === 'error'
        ? 'IconAlertCircle'
        : tone === 'success'
          ? 'IconCircleCheck'
          : 'IconInfoCircle'

  const container = (() => {
    if (filled) {
      return {
        warning: 'bg-desert-orange border-desert-orange text-white',
        error: 'bg-desert-red border-desert-red text-white',
        success: 'bg-desert-olive border-desert-olive text-white',
        info: '',
      }[tone]
    }
    if (variant === 'solid') {
      return {
        warning: 'bg-desert-orange-lighter border-desert-orange',
        error: 'bg-desert-red-lighter border-desert-red',
        success: 'bg-desert-olive-lighter border-desert-olive',
        info: 'bg-surface-elevated border-border-default',
      }[tone]
    }
    if (variant === 'bordered') {
      return {
        warning: 'bg-surface-primary border-desert-orange-light',
        error: 'bg-surface-primary border-desert-red-light',
        success: 'bg-surface-primary border-desert-olive-light',
        info: 'bg-surface-elevated border-border-default',
      }[tone]
    }
    return {
      warning: 'bg-desert-orange-lighter border-desert-orange-light',
      error: 'bg-desert-red-lighter border-desert-red-light',
      success: 'bg-desert-olive-lighter border-desert-olive-light',
      info: 'bg-surface-secondary border-border-default',
    }[tone]
  })()

  const accent = filled
    ? 'text-white'
    : {
        warning: 'text-desert-orange-dark',
        error: 'text-desert-red-dark',
        success: 'text-desert-olive-dark',
        info: 'text-text-primary',
      }[tone]

  const body = filled
    ? 'text-white/90'
    : variant !== 'bordered' && tone !== 'info'
      ? accent
      : 'text-text-secondary'

  return (
    <div
      {...props}
      className={classNames(
        'rounded-[var(--radius-card)] border px-5 py-4 animate-nd-fade',
        container,
        props.className
      )}
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <DynamicIcon
            icon={icon || defaultIcon}
            className={classNames('mt-0.5 size-5 shrink-0', accent)}
          />
          <div className="min-w-0 flex-1">
            <h3 className={classNames('text-sm font-medium leading-snug', accent)}>{title}</h3>
            {message && (
              <p className={classNames('mt-1 text-sm leading-relaxed', body)}>{message}</p>
            )}
            {children && <div className="mt-3">{children}</div>}
          </div>
        </div>

        {(buttonProps || dismissible) && (
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            {buttonProps && (
              <StyledButton
                size="sm"
                {...buttonProps}
                variant={filled ? 'secondary' : buttonProps.variant}
              />
            )}
            {dismissible && (
              <button
                type="button"
                onClick={onDismiss}
                className={classNames(
                  'rounded-full p-1.5 transition-colors duration-[140ms] cursor-pointer',
                  filled
                    ? 'text-white hover:bg-black/20'
                    : 'text-text-muted hover:bg-surface-elevated hover:text-text-primary'
                )}
                aria-label={t('Dismiss alert')}
              >
                <DynamicIcon icon="IconX" className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
