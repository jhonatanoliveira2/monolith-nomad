import classNames from 'classnames'
import { JSX } from 'react'

export interface StyledSectionHeaderProps {
  title: string
  level?: 1 | 2 | 3 | 4 | 5 | 6
  className?: string
}

/** Section title inside a page: a lit LED, the title and a dotted rule to the edge (Nothing). */
const StyledSectionHeader = ({ title, level = 2, className }: StyledSectionHeaderProps) => {
  const Heading = `h${level}` as keyof JSX.IntrinsicElements
  return (
    <Heading
      className={classNames(
        'text-xl font-medium text-text-primary mb-5 flex items-center gap-3',
        className
      )}
    >
      <span aria-hidden="true" className="nd-led text-led" />
      <span className="shrink-0">{title}</span>
      <span aria-hidden="true" className="nd-rule flex-1 min-w-8" />
    </Heading>
  )
}

export default StyledSectionHeader
