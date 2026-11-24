import { Link } from '@inertiajs/react'
import classNames from '~/lib/class_names'
import DotMeter from './DotMeter'
import StatusDot, { StatusTone } from './StatusDot'

/**
 * One system reading: label, a dot-matrix number, an optional unit/hint and an optional meter.
 * With `href` the whole tile is a link to the screen that explains the number.
 */
export default function StatTile({
  label,
  value,
  unit,
  hint,
  meter,
  status,
  href,
  loading,
  className,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  hint?: React.ReactNode
  meter?: { value: number; label: string; scale?: 'usage' | 'neutral' }
  status?: StatusTone
  href?: string
  loading?: boolean
  className?: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="nd-eyebrow">{label}</span>
        {status && <StatusDot tone={status} />}
      </div>
      {loading ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          <div className="nd-skeleton h-8 w-24" />
          <div className="nd-skeleton h-2 w-full" />
        </div>
      ) : (
        <>
          <p className="mt-3 flex items-baseline gap-1.5 text-text-primary">
            <span className="nd-display text-4xl">{value}</span>
            {unit && <span className="nd-mono text-sm text-text-muted">{unit}</span>}
          </p>
          {meter && (
            <DotMeter
              value={meter.value}
              label={meter.label}
              scale={meter.scale}
              className="mt-3"
              size="sm"
              segments={28}
            />
          )}
          {hint && <p className="mt-2 text-xs text-text-muted truncate">{hint}</p>}
        </>
      )}
    </>
  )
  const cls = classNames('nd-card block p-5 min-w-0', href && 'nd-card-interactive', className)
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
