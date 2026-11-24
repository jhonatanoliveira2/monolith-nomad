import classNames from '~/lib/class_names'

/**
 * Dot-matrix meter: a row of LEDs lit in proportion to `value` (0–100). With `scale="usage"` the lit
 * dots turn orange from 70 % and red from 90 % (resource usage); `scale="neutral"` stays monochrome.
 */
export default function DotMeter({
  value,
  segments = 24,
  scale = 'usage',
  label,
  className,
  size = 'md',
}: {
  value: number
  segments?: number
  scale?: 'usage' | 'neutral'
  label: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const lit = Math.round((clamped / 100) * segments)
  const tone =
    scale === 'usage' && clamped >= 90
      ? 'bg-desert-red'
      : scale === 'usage' && clamped >= 70
        ? 'bg-desert-orange'
        : 'bg-led'
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={classNames('flex items-center', size === 'sm' ? 'gap-[3px]' : 'gap-1', className)}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={classNames(
            'rounded-full transition-colors duration-[240ms]',
            size === 'sm' ? 'size-1' : 'size-1.5',
            i < lit ? tone : 'bg-led-off'
          )}
        />
      ))}
    </div>
  )
}
