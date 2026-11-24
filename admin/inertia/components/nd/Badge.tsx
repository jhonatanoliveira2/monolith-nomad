import classNames from '~/lib/class_names'

export type BadgeTone = 'neutral' | 'solid' | 'highlight' | 'ok' | 'warn' | 'error'

const TONE: Record<BadgeTone, string> = {
  neutral: 'border-border-default text-text-secondary',
  solid: 'border-accent bg-accent text-accent-contrast',
  highlight: 'border-highlight bg-highlight text-highlight-contrast',
  ok: 'border-desert-olive-light bg-desert-olive-lighter text-desert-olive-dark',
  warn: 'border-desert-orange-light bg-desert-orange-lighter text-desert-orange-dark',
  error: 'border-desert-red-light bg-desert-red-lighter text-desert-red-dark',
}

/** Small mono tag: formats, levels, states. */
export default function Badge({
  tone = 'neutral',
  children,
  className,
  title,
}: {
  tone?: BadgeTone
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={classNames(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 nd-mono text-[10px] uppercase tracking-[0.08em] leading-4 whitespace-nowrap',
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
