import { useRef } from 'react'
import classNames from '~/lib/class_names'

export type SegmentOption<T extends string> = { value: T; label: string; count?: number }

/** A single choice among a few views (radio group semantics, arrow keys move the selection). */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={classNames(
        'inline-flex items-center rounded-full border border-border-default bg-surface-primary p-1',
        className
      )}
    >
      {options.map((opt, i) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={classNames(
              'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap cursor-pointer',
              'transition-[background-color,color] duration-[140ms] ease-[cubic-bezier(0.2,0,0,1)]',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
              active
                ? 'bg-accent text-accent-contrast'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={classNames(
                  'nd-mono text-[10px]',
                  active ? 'text-accent-contrast/70' : 'text-text-muted'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
