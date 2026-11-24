import PageHeader from '~/components/nd/PageHeader'
import { Head } from '@inertiajs/react'
import SettingsLayout from '~/layouts/SettingsLayout'
import CreatorPacksSection from '~/components/CreatorPacksSection'
import ActiveDownloads from '~/components/ActiveDownloads'
import useCreatorPacks from '~/hooks/use_creator_packs'
import { useTranslation } from 'react-i18next'

export default function CreatorPacksPage() {
  const { t } = useTranslation()
  const { configured } = useCreatorPacks()

  return (
    <SettingsLayout>
      <Head title={t('Creator Packs')} />
      <div className="w-full">
        <div className="nd-page">
          <PageHeader
            eyebrow={t('Content')}
            title={t('Creator Packs')}
            description={t(
              'Install branded video collections from creators. Packs download in the background and play offline through Kiwix.'
            )}
          />

          {configured ? (
            <>
              <CreatorPacksSection allowUninstall />
              <div className="mt-10">
                <ActiveDownloads filetype="zim" withHeader />
              </div>
            </>
          ) : (
            <p className="text-text-muted mt-4">
              {t("Creator Packs aren't available on this build.")}
            </p>
          )}
        </div>
      </div>
    </SettingsLayout>
  )
}
