// Helper hook to show error notifications
import { useNotifications } from '../context/notification_context'

const useErrorNotification = () => {
  const { addNotification } = useNotifications()

  const showError = (message: string) => {
    addNotification({ message, type: 'error' })
  }

  return { showError }
}

export default useErrorNotification
