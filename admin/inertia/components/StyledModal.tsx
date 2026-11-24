import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import StyledButton, { StyledButtonProps } from './StyledButton'
import React from 'react'
import classNames from '~/lib/class_names'
import { useTranslation } from 'react-i18next'

export type StyledModalProps = {
  onClose?: () => void
  title: string
  cancelText?: string
  cancelIcon?: StyledButtonProps['icon']
  cancelLoading?: boolean
  confirmText?: string
  confirmIcon?: StyledButtonProps['icon']
  confirmVariant?: StyledButtonProps['variant']
  confirmLoading?: boolean
  confirmDisabled?: boolean
  open: boolean
  onCancel?: () => void
  onConfirm?: () => void
  children: React.ReactNode
  icon?: React.ReactNode
  large?: boolean
}

/**
 * Dialog: raised panel, title on the left, actions on the right (cancel, then the main action).
 * Bottom sheet on small screens. Focus trap and Esc come from Headless UI.
 */
const StyledModal: React.FC<StyledModalProps> = ({
  children,
  title,
  open,
  onClose,
  cancelText,
  cancelIcon,
  cancelLoading = false,
  confirmText,
  confirmIcon,
  confirmVariant = 'action',
  confirmLoading = false,
  confirmDisabled = false,
  onCancel,
  onConfirm,
  icon,
  large = false,
}) => {
  const { t } = useTranslation()
  // defaults are resolved at render so they follow the interface language ('' still hides a button)
  if (cancelText === undefined) cancelText = t('Cancel')
  if (confirmText === undefined) confirmText = t('Confirm')
  const hasFooter = (cancelText && onCancel) || (confirmText && onConfirm)
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (onClose) onClose()
      }}
      // above side sheets (z-60), below the command palette (z-70)
      className="relative z-[65]"
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-scrim transition-opacity duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6">
          <DialogPanel
            transition
            className={classNames(
              'relative w-full transform overflow-hidden bg-surface-primary text-left border border-border-default shadow-2xl',
              'rounded-t-[var(--radius-panel)] sm:rounded-[var(--radius-panel)]',
              'transition duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] data-[closed]:translate-y-6 data-[closed]:opacity-0 sm:data-[closed]:translate-y-2 sm:data-[closed]:scale-[0.98]',
              large ? 'sm:max-w-7xl' : 'sm:max-w-lg'
            )}
          >
            <div className="px-6 pt-6 pb-5 sm:px-7 sm:pt-7">
              <div className="flex items-start gap-4">
                {icon && (
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border-default bg-surface-secondary [&_svg]:!size-6">
                    {icon}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium text-text-primary leading-snug"
                  >
                    {title}
                  </DialogTitle>
                  <div className="mt-2 !h-fit text-sm text-text-secondary">{children}</div>
                </div>
              </div>
            </div>
            {hasFooter && (
              <div className="flex flex-col-reverse gap-2 border-t border-border-subtle bg-surface-secondary/60 px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
                {cancelText && onCancel && (
                  <StyledButton
                    variant="secondary"
                    onClick={() => {
                      if (onCancel) onCancel()
                    }}
                    icon={cancelIcon}
                    loading={cancelLoading}
                  >
                    {cancelText}
                  </StyledButton>
                )}
                {confirmText && onConfirm && (
                  <StyledButton
                    variant={confirmVariant}
                    onClick={() => {
                      if (onConfirm) onConfirm()
                    }}
                    icon={confirmIcon}
                    loading={confirmLoading}
                    disabled={confirmDisabled}
                  >
                    {confirmText}
                  </StyledButton>
                )}
              </div>
            )}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}

export default StyledModal
