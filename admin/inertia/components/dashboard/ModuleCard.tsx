import { Link } from '@inertiajs/react'
import { IconArrowUpRight } from '@tabler/icons-react'
import classNames from '~/lib/class_names'

/**
 * A core capability of the server (Library, Maps, Drug Reference, Assistant, Docs): bigger than an app
 * tile, with one line of live context (`meta`) so the dashboard says what is there, not just a name.
 */
export default function ModuleCard({
  href,
  icon,
  title,
  description,
  meta,
  badge,
  className,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  meta?: React.ReactNode
  badge?: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={classNames(
        'nd-card nd-card-interactive group relative flex min-h-44 flex-col p-5 overflow-hidden',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-full border border-border-default text-text-primary [&_svg]:size-5">
          {icon}
        </span>
        <span className="flex items-center gap-2">
          {badge}
          <IconArrowUpRight
            size={18}
            className="text-text-muted transition-transform duration-[140ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text-primary"
            aria-hidden="true"
          />
        </span>
      </div>
      <div className="mt-auto pt-6">
        <h3 className="text-lg font-medium text-text-primary">{title}</h3>
        <p className="mt-1 text-sm text-text-secondary line-clamp-2">{description}</p>
        {meta && <p className="mt-3 nd-eyebrow">{meta}</p>}
      </div>
    </Link>
  )
}
