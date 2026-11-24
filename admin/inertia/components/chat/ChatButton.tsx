import { IconMessages } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

interface ChatButtonProps {
  onClick: () => void
}

export default function ChatButton({ onClick }: ChatButtonProps) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full border border-accent bg-accent text-accent-contrast shadow-2xl transition-transform duration-[140ms] ease-[cubic-bezier(0.2,0,0,1)] hover:scale-105 active:scale-95 cursor-pointer"
      aria-label={t('Open chat')}
      title={t('Open chat')}
    >
      <IconMessages className="h-6 w-6" />
    </button>
  )
}
