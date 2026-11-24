import { Link } from '@inertiajs/react'
import { IconArrowRight } from '@tabler/icons-react'
import classNames from '~/lib/class_names'

/**
 * A titled group of content. The title is a small mono label (Nothing's section language), so the
 * content — not the heading — carries the visual weight.
 */
export default function Section({
  id,
  title,
  description,
  count,
  action,
  children,
  className,
}: {
  id?: string
  title: React.ReactNode
  description?: React.ReactNode
  count?: number
  /** A link ({label, href}) or any node rendered at the right of the header. */
  action?: { label: string; href: string } | React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  const isLink =
    action && typeof action === 'object' && 'href' in (action as object) && 'label' in (action as object)
  return (
    <section id={id} aria-labelledby={headingId} className={classNames('animate-nd-rise', className)}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            id={headingId}
            className="nd-eyebrow !text-text-secondary flex items-center gap-2 !text-xs"
          >
            {title}
            {count !== undefined && <span className="text-text-muted nd-mono">{count}</span>}
          </h2>
          {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
        </div>
        {isLink ? (
          <Link
            href={(action as { href: string }).href}
            className="group inline-flex items-center gap-1 whitespace-nowrap text-sm text-text-secondary hover:text-text-primary shrink-0"
          >
            {(action as { label: string }).label}
            <IconArrowRight
              size={14}
              className="transition-transform duration-[140ms] group-hover:translate-x-0.5"
            />
          </Link>
        ) : (
          (action as React.ReactNode)
        )}
      </div>
      {children}
    </section>
  )
}
