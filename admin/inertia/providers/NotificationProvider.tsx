import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NotificationContext, Notification } from '../context/notification_context'
import { IconExclamationCircle, IconCircleCheck, IconInfoCircle, IconX } from '@tabler/icons-react'
import { setGlobalNotificationCallback } from '~/lib/util'
import { useTranslation } from 'react-i18next'
import { translateServerMessage } from '~/lib/server_messages'

function Icon({ type }: { type: string }) {
  switch (type) {
    case 'error':
      return <IconExclamationCircle className="h-5 w-5 text-desert-red" />
    case 'success':
      return <IconCircleCheck className="h-5 w-5 text-desert-olive" />
    default:
      return <IconInfoCircle className="h-5 w-5 text-text-primary" />
  }
}

const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<(Notification & { id: string })[]>([])
  // re-renders on language change; messages are translated at display time (they are often server messages)
  const { t } = useTranslation()
  const timers = useRef(new Map<string, number>())

  const removeNotification = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const addNotification = useCallback(
    (newNotif: Notification) => {
      const { message, type, duration = 5000 } = newNotif
      const id = crypto.randomUUID()
      setNotifications((prev) => [...prev, { id, message, type, duration }])
      if (duration > 0) {
        timers.current.set(
          id,
          window.setTimeout(() => removeNotification(id), duration)
        )
      }
    },
    [removeNotification]
  )

  const removeAllNotifications = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current.clear()
    setNotifications([])
  }, [])

  // Set the global notification callback when provider mounts; clear pending timers on unmount
  useEffect(() => {
    const pending = timers.current
    setGlobalNotificationCallback(addNotification)
    return () => {
      setGlobalNotificationCallback(() => {})
      pending.forEach((timer) => window.clearTimeout(timer))
    }
  }, [addNotification])

  const value = useMemo(
    () => ({ notifications, addNotification, removeNotification, removeAllNotifications }),
    [notifications, addNotification, removeNotification, removeAllNotifications]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {/* Toasts: bottom right, above the assistant button; announced politely to screen readers */}
      <div
        className="!fixed bottom-24 right-0 left-0 sm:left-auto z-[9999] flex flex-col items-end gap-2 p-4 pointer-events-none"
        aria-live="polite"
        aria-relevant="additions"
      >
        {notifications.map((notification) => (
          <div
            key={notification.id}
            role={notification.type === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto w-full sm:w-96 nd-glass rounded-[var(--radius-card)] border border-border-default shadow-2xl px-4 py-3 animate-nd-rise"
          >
            <div className="flex flex-row items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Icon type={notification.type} />
              </div>
              <p className="flex-1 min-w-0 break-words text-sm text-text-primary">
                {translateServerMessage(notification.message)}
              </p>
              <button
                type="button"
                onClick={() => removeNotification(notification.id)}
                className="-mr-1 rounded-full p-1 text-text-muted hover:bg-surface-elevated hover:text-text-primary cursor-pointer"
                aria-label={t('Dismiss notification')}
              >
                <IconX className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export default NotificationsProvider
