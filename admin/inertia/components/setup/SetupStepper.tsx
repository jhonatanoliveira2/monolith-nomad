import { IconCheck } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import classNames from '~/lib/class_names'

export const SETUP_STEPS = ['Features', 'Maps', 'Content', 'Review'] as const

/** Four-step progress: done steps are clickable to go back, the current one is lit in orange. */
export default function SetupStepper({
  step,
  maxVisited,
  onGo,
}: {
  step: number
  maxVisited: number
  onGo: (step: number) => void
}) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('Setup steps')}>
      <ol className="grid grid-cols-4 gap-2">
        {SETUP_STEPS.map((label, i) => {
          const n = i + 1
          const current = n === step
          const done = n < step
          const reachable = n <= maxVisited && !current
          return (
            <li key={label} className="min-w-0">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onGo(n)}
                aria-current={current ? 'step' : undefined}
                className={classNames(
                  'group flex w-full flex-col gap-2 text-left',
                  reachable ? 'cursor-pointer' : 'cursor-default'
                )}
              >
                <span
                  className={classNames(
                    'h-1 w-full rounded-full transition-colors duration-[240ms]',
                    current ? 'bg-highlight' : done ? 'bg-led' : 'bg-led-off'
                  )}
                  aria-hidden="true"
                />
                <span className="flex items-center gap-2">
                  <span
                    className={classNames(
                      'flex size-6 shrink-0 items-center justify-center rounded-full nd-mono text-[11px]',
                      current
                        ? 'bg-highlight text-highlight-contrast'
                        : done
                          ? 'bg-accent text-accent-contrast'
                          : 'border border-border-default text-text-muted'
                    )}
                  >
                    {done ? <IconCheck size={13} /> : n}
                  </span>
                  <span
                    className={classNames(
                      'truncate text-sm',
                      current
                        ? 'font-medium text-text-primary'
                        : reachable
                          ? 'text-text-secondary group-hover:text-text-primary'
                          : 'text-text-muted'
                    )}
                  >
                    {t(label)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
