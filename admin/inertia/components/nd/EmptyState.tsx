import classNames from '~/lib/class_names'

/**
 * Empty, error and "nothing here yet" states share one shape: a dot field, an icon, one sentence that
 * says what happened and, when there is one, the next step.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
  compact = false,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  tone?: 'neutral' | 'error'
  className?: string
  compact?: boolean
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={classNames(
        'nd-card nd-dot-field flex flex-col items-center justify-center text-center animate-nd-fade',
        compact ? 'px-6 py-8' : 'px-6 py-14',
        tone === 'error' && 'border-desert-red-light',
        className
      )}
    >
      {icon && (
        <div
          className={classNames(
            'mb-4 flex size-12 items-center justify-center rounded-full border bg-surface-primary',
            tone === 'error'
              ? 'border-desert-red-light text-desert-red'
              : 'border-border-default text-text-secondary'
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <p className="text-base font-medium text-text-primary">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm text-text-secondary">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
