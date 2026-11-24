import { forwardRef } from 'react'
import classNames from '~/lib/class_names'

/** Icon-only button with a mandatory accessible label (also shown as the native tooltip). */
const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string
    active?: boolean
    size?: 'sm' | 'md'
  }
>(function IconButton({ label, active, size = 'md', className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={classNames(
        'inline-flex items-center justify-center rounded-full border cursor-pointer',
        'transition-[background-color,color,border-color] duration-[140ms] ease-[cubic-bezier(0.2,0,0,1)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        size === 'sm' ? 'size-8' : 'size-10',
        active
          ? 'bg-accent text-accent-contrast border-accent'
          : 'border-transparent text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
        className
      )}
    >
      {children}
    </button>
  )
})

export default IconButton
