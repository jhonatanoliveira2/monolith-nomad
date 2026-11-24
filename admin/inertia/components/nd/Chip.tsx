import classNames from '~/lib/class_names'

/** Toggle pill used by filters. `count` shows how many results the option would give. */
export default function Chip({
  active,
  onClick,
  children,
  count,
  disabled,
  className,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
        'transition-[background-color,color,border-color] duration-[140ms] ease-[cubic-bezier(0.2,0,0,1)]',
        'disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer',
        active
          ? 'bg-accent text-accent-contrast border-accent'
          : 'bg-transparent text-text-secondary border-border-default hover:border-text-muted hover:text-text-primary',
        className
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={classNames(
            'nd-mono text-[10px]',
            active ? 'text-accent-contrast/70' : 'text-text-muted'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
