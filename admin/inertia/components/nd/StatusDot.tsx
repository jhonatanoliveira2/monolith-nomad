import classNames from '~/lib/class_names'

export type StatusTone = 'ok' | 'warn' | 'error' | 'idle' | 'live' | 'neutral'

const TONE: Record<StatusTone, string> = {
  ok: 'text-desert-olive',
  warn: 'text-desert-orange-dark',
  error: 'text-desert-red',
  idle: 'text-led-off',
  live: 'text-highlight',
  neutral: 'text-text-muted',
}

/**
 * A single LED. `live` blinks (something is happening right now); the other tones are steady.
 * Always pair it with text: colour alone never carries the meaning.
 */
export default function StatusDot({
  tone = 'neutral',
  className,
  pulse,
  label,
}: {
  tone?: StatusTone
  className?: string
  /** Blink even when the tone is not `live` (e.g. a stalled download). */
  pulse?: boolean
  /** Accessible name when the dot stands alone. */
  label?: string
}) {
  return (
    <span
      className={classNames(
        'nd-led',
        TONE[tone],
        (pulse || tone === 'live') && 'animate-nd-blink',
        className
      )}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
