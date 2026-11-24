import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { IconX } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import classNames from '~/lib/class_names'

/**
 * Side sheet for details and secondary controls (work details, mobile filters, navigation).
 * Focus is trapped while open and returns to the trigger on close (Headless UI Dialog).
 */
export default function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  side = 'right',
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  eyebrow?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  side?: 'left' | 'right'
  width?: string
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[60]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-scrim transition-opacity duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] data-[closed]:opacity-0"
      />
      <div className={classNames('fixed inset-y-0 flex w-full', side === 'right' ? 'right-0 justify-end' : 'left-0')}>
        <DialogPanel
          transition
          className={classNames(
            'flex h-full w-full flex-col bg-surface-primary border-border-default shadow-2xl',
            'transition-transform duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)]',
            side === 'right'
              ? 'border-l data-[closed]:translate-x-full'
              : 'border-r data-[closed]:-translate-x-full',
            width
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
            <div className="min-w-0">
              {eyebrow && <p className="nd-eyebrow mb-1.5">{eyebrow}</p>}
              <DialogTitle className="text-xl font-medium text-text-primary leading-snug">
                {title}
              </DialogTitle>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-full p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary cursor-pointer"
              aria-label={t('Close')}
            >
              <IconX size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="border-t border-border-subtle px-6 py-4">{footer}</div>}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
