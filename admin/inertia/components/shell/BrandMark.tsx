import UbuntuLogo from '~/components/UbuntuLogo'
import classNames from '~/lib/class_names'

/**
 * monolith-nomad wordmark: the Ubuntu logo, MONOLITH in dot-matrix type and "nomad" in mono, joined by
 * a single dot in Ubuntu orange (the highlight colour).
 */
export default function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <span className={classNames('inline-flex items-center gap-2.5 text-text-primary', className)}>
      <UbuntuLogo title="monolith-nomad" className={compact ? 'size-9' : 'size-8 shrink-0'} />
      {!compact && (
        <span className="flex items-baseline gap-1 leading-none">
          <span className="font-dot text-lg uppercase tracking-[0.08em]">Monolith</span>
          <span className="size-1.5 rounded-full bg-highlight self-center" aria-hidden="true" />
          <span className="nd-mono text-xs text-text-secondary">nomad</span>
        </span>
      )}
    </span>
  )
}
