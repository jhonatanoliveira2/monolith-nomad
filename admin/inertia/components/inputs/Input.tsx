import classNames from 'classnames'
import { InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string
  label: string
  helpText?: string
  className?: string
  labelClassName?: string
  inputClassName?: string
  containerClassName?: string
  leftIcon?: React.ReactNode
  error?: boolean
  required?: boolean
}

const Input: React.FC<InputProps> = ({
  className,
  label,
  name,
  helpText,
  labelClassName,
  inputClassName,
  containerClassName,
  leftIcon,
  error,
  required,
  ...props
}) => {
  return (
    <div className={classNames(className)}>
      <label
        htmlFor={name}
        className={classNames('block text-sm font-medium text-text-primary', labelClassName)}
      >
        {label}
        {required ? '*' : ''}
      </label>
      {helpText && (
        <p id={`${name}-help`} className="mt-1 text-sm text-text-muted">
          {helpText}
        </p>
      )}
      <div className={classNames('mt-1.5', containerClassName)}>
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
              {leftIcon}
            </div>
          )}
          <input
            id={name}
            name={name}
            placeholder={props.placeholder || label}
            className={classNames(
              inputClassName,
              'nd-field block',
              leftIcon ? '!pl-10' : '',
              error ? '!border-desert-red !bg-desert-red-lighter' : ''
            )}
            aria-invalid={error || undefined}
            aria-describedby={helpText ? `${name}-help` : undefined}
            required={required}
            {...props}
          />
        </div>
      </div>
    </div>
  )
}

export default Input
