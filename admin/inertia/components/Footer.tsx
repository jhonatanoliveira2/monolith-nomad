import { useState } from 'react'
import { usePage } from '@inertiajs/react'
import { UsePageProps } from '../../types/system'
import ThemeToggle from '~/components/ThemeToggle'
import { IconBug } from '@tabler/icons-react'
import DebugInfoModal from './DebugInfoModal'
import LocaleToggle from './LocaleToggle'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { appVersion } = usePage().props as unknown as UsePageProps
  const [debugModalOpen, setDebugModalOpen] = useState(false)
  const { t } = useTranslation()

  return (
    <footer>
      <div className="flex items-center justify-center gap-3 border-t border-border-subtle py-4">
        <p className="text-sm/6 text-text-secondary">monolith-nomad v{appVersion}</p>
        <span className="text-text-muted">|</span>
        <button
          onClick={() => setDebugModalOpen(true)}
          className="text-sm/6 text-text-muted hover:text-desert-green flex items-center gap-1 cursor-pointer"
        >
          <IconBug className="size-3.5" />
          {t('Debug Info')}
        </button>
        <ThemeToggle />
        <LocaleToggle />
      </div>
      <DebugInfoModal open={debugModalOpen} onClose={() => setDebugModalOpen(false)} />
    </footer>
  )
}
