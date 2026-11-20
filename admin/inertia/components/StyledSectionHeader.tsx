import classNames from 'classnames'
import { JSX } from 'react'

export interface StyledSectionHeaderProps {
  title: string
  level?: 1 | 2 | 3 | 4 | 5 | 6
  className?: string
}

const StyledSectionHeader = ({ title, level = 2, className }: StyledSectionHeaderProps) => {
  const Heading = `h${level}` as keyof JSX.IntrinsicElements
  return (
    <Heading
      className={classNames(
        'text-2xl font-bold text-desert-green mb-6 flex items-center gap-2',
        className
      )}
    >
      {/* Nothing theme: a lit LED instead of the colour bar */}
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
      {title}
    </Heading>
  )
}

export default StyledSectionHeader
