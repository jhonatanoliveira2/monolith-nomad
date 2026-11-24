import { Head } from '@inertiajs/react'
import { IconCompass } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import EmptyState from '~/components/nd/EmptyState'

/** Standalone (outside the app shell) so it renders even when shared data is unavailable. */
export default function NotFound() {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Head title={t('Page not found')} />
      <div className="w-full max-w-lg">
        <p className="nd-display mb-6 text-center text-7xl text-text-primary" aria-hidden="true">
          404
        </p>
        <EmptyState
          icon={<IconCompass size={22} />}
          title={t('Page not found')}
          description={t('This page does not exist.')}
          action={
            <a
              href="/home"
              className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:opacity-90"
            >
              {t('Back to Home')}
            </a>
          }
        />
      </div>
    </main>
  )
}
