import classNames from '~/lib/class_names'

/**
 * The header every page starts with: an optional eyebrow (where you are), the title, one sentence of
 * description and the page-level actions on the right. Keeps titles the same size on every screen.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** Extra line under the description (counts, last update, filters summary). */
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={classNames(
        'mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between animate-nd-rise',
        className
      )}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow && (
          <p className="nd-eyebrow mb-3 flex items-center gap-2">
            <span className="nd-led text-highlight" aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl sm:text-4xl font-medium text-text-primary leading-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-base text-text-secondary leading-relaxed">{description}</p>
        )}
        {children && <div className="mt-3">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  )
}
