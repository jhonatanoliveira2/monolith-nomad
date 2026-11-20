import { useMemo } from 'react'
import clsx from 'clsx'
import DynamicIcon, { DynamicIconName} from './DynamicIcon'
import { IconRefresh } from '@tabler/icons-react'

export interface StyledButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  icon?: DynamicIconName
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'action' | 'success' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

const StyledButton: React.FC<StyledButtonProps> = ({
  children,
  icon,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  ...props
}) => {
  const isDisabled = useMemo(() => {
    return props.disabled || loading
  }, [props.disabled, loading])

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'h-3.5 w-3.5 mr-1.5'
      case 'lg':
        return 'h-5 w-5 mr-2.5'
      default:
        return 'h-4 w-4 mr-2'
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2.5 py-1.5 text-xs'
      case 'lg':
        return 'px-4 py-3 text-base'
      default:
        return 'px-3 py-2 text-sm'
    }
  }

  // Nothing theme: pill buttons, no shadows, quick press feedback. The main action is inverted
  // (ink on void); danger uses the alert red, the only colour reserved for destructive actions.
  const getVariantClasses = () => {
    const baseTransition = 'transition-[background-color,color,border-color,transform] duration-[140ms] ease-[cubic-bezier(0.2,0,0,1)]'
    const basePress = 'active:scale-[0.97]'
    switch (variant) {
      case 'primary':
      case 'action':
        return clsx(
          'bg-accent text-accent-contrast border border-accent',
          'hover:opacity-90',
          'disabled:bg-desert-green-light disabled:text-desert-stone-light disabled:border-desert-green-light',
          baseTransition,
          basePress
        )
      case 'secondary':
        return clsx(
          'bg-surface-elevated text-text-primary border border-border-default',
          'hover:border-text-secondary',
          'disabled:text-desert-stone-light',
          baseTransition,
          basePress
        )
      case 'danger':
        return clsx(
          'bg-alert text-white border border-alert',
          'hover:bg-desert-red-hover hover:border-desert-red-hover',
          'disabled:bg-desert-red-lighter disabled:text-desert-stone-light',
          baseTransition,
          basePress
        )
      case 'success':
        return clsx(
          'bg-desert-olive text-white border border-desert-olive',
          'hover:bg-desert-olive-hover hover:border-desert-olive-hover',
          'disabled:bg-desert-olive-lighter disabled:text-desert-stone-light',
          baseTransition,
          basePress
        )
      case 'ghost':
        return clsx(
          'bg-transparent text-text-primary border border-transparent',
          'hover:bg-surface-elevated',
          'disabled:text-desert-stone-light',
          baseTransition
        )
      case 'outline':
        return clsx(
          'bg-transparent text-text-primary border border-text-primary',
          'hover:bg-accent hover:text-accent-contrast hover:border-accent',
          'disabled:border-border-default disabled:text-desert-stone-light',
          baseTransition,
          basePress
        )
      default:
        return ''
    }
  }

  const getLoadingSpinner = () => {
    const spinnerSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
    return (
      <IconRefresh
        className={clsx(spinnerSize, 'animate-spin')}
      />
    )
  }

  const onClickHandler = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      e.preventDefault()
      return
    }
    props.onClick?.(e)
  }

  return (
    <button
      type="button"
      className={clsx(
        fullWidth ? 'flex w-full' : 'inline-flex',
        getSizeClasses(),
        getVariantClasses(),
        isDisabled ? 'pointer-events-none opacity-60' : 'cursor-pointer',
        'items-center justify-center rounded-full font-medium tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-desert-sand disabled:cursor-not-allowed',
        className
      )}
      {...props}
      disabled={isDisabled}
      onClick={onClickHandler}
    >
      {loading ? (
        getLoadingSpinner()
      ) : (
        <>
          {icon && <DynamicIcon icon={icon} className={getIconSize()} />}
          {children}
        </>
      )}
    </button>
  )
}

export default StyledButton
