import { useTranslation } from 'react-i18next'
import classNames from '~/lib/class_names'
import { LEVEL_ORDER } from '~/lib/library_filters'
import type { LibraryLevel } from '../../../types/library'

export const LEVEL_LABEL: Record<LibraryLevel, string> = {
  iniciante: 'Beginner',
  intermediario: 'Intermediate',
  avancado: 'Advanced',
}

/** Learning level as three LEDs (beginner → advanced); lit dots are the levels the work serves. */
export default function LevelDots({
  levels,
  className,
}: {
  levels: LibraryLevel[]
  className?: string
}) {
  const { t } = useTranslation()
  const label = t('Levels: {{levels}}', {
    levels: LEVEL_ORDER.filter((l) => levels.includes(l))
      .map((l) => t(LEVEL_LABEL[l]))
      .join(', '),
  })
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={classNames('inline-flex items-center gap-1', className)}
    >
      {LEVEL_ORDER.map((l) => (
        <span
          key={l}
          aria-hidden="true"
          className={classNames(
            'size-1.5 rounded-full',
            levels.includes(l) ? 'bg-led' : 'bg-led-off'
          )}
        />
      ))}
    </span>
  )
}
