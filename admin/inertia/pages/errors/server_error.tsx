import { Head } from '@inertiajs/react'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import EmptyState from '~/components/nd/EmptyState'

/** Standalone (outside the app shell) so it renders even when the server could not build shared data. */
export default function ServerError(props: { error: any }) {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Head title={t('Server Error')} />
      <div className="w-full max-w-lg">
        <p className="nd-display mb-6 text-center text-7xl text-text-primary" aria-hidden="true">
          500
        </p>
        <EmptyState
          tone="error"
          icon={<IconAlertTriangle size={22} />}
          title={t('Server Error')}
          description={props.error?.message}
          action={
            <>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center rounded-full border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:border-text-muted cursor-pointer"
              >
                {t('Try again')}
              </button>
              <a
                href="/home"
                className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:opacity-90"
              >
                {t('Back to Home')}
              </a>
            </>
          }
        />
      </div>
    </main>
  )
}
