import { Head, Link } from '@inertiajs/react'
import { IconBooks, IconMapRoute, IconWorldDownload } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import ActiveDownloads from '~/components/ActiveDownloads'
import ActiveEmbedJobs from '~/components/ActiveEmbedJobs'
import ActiveModelDownloads from '~/components/ActiveModelDownloads'
import PageHeader from '~/components/nd/PageHeader'
import Section from '~/components/nd/Section'
import useServiceInstalledStatus from '~/hooks/useServiceInstalledStatus'
import AppLayout from '~/layouts/AppLayout'
import { SERVICE_NAMES } from '../../constants/service_names'

/**
 * Every queue in one place. Before the redesign, content, map, model and indexing progress were only
 * visible on the screen that started each download.
 */
export default function DownloadsPage() {
  const { t } = useTranslation()
  const ai = useServiceInstalledStatus(SERVICE_NAMES.OLLAMA)

  const sources = [
    {
      href: '/settings/zim/remote-explorer',
      icon: IconWorldDownload,
      title: t('Content Explorer'),
      text: t('Wikipedia, courses and reference collections (ZIM).'),
    },
    {
      href: '/library',
      icon: IconBooks,
      title: t('Library'),
      text: t('Books and manuals in PDF, EPUB and ZIM.'),
    },
    {
      href: '/settings/maps',
      icon: IconMapRoute,
      title: t('Maps Manager'),
      text: t('Offline map regions.'),
    },
  ]

  return (
    <AppLayout>
      <Head title={t('Downloads')} />
      <div className="nd-page">
        <PageHeader
          eyebrow={t('Content')}
          title={t('Downloads')}
          description={t(
            'Everything being downloaded or processed on this server. Downloads continue in the background, even if you close this page.'
          )}
        />
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-10">
            <Section id="content-downloads" title={t('Content, maps and documents')}>
              <ActiveDownloads />
            </Section>
            {ai.isInstalled && (
              <>
                <Section id="model-downloads" title={t('AI models')}>
                  <ActiveModelDownloads />
                </Section>
                <Section
                  id="processing"
                  title={t('Knowledge Base processing')}
                  description={t('Files being indexed so the assistant can cite them.')}
                >
                  <ActiveEmbedJobs />
                </Section>
              </>
            )}
          </div>
          <aside className="space-y-3 xl:pt-8">
            <p className="nd-eyebrow">{t('Get more content')}</p>
            {sources.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="nd-card nd-card-interactive flex gap-3 p-4"
              >
                <s.icon className="mt-0.5 size-[18px] shrink-0 text-text-secondary" stroke={1.75} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text-primary">{s.title}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">{s.text}</span>
                </span>
              </Link>
            ))}
          </aside>
        </div>
      </div>
    </AppLayout>
  )
}
