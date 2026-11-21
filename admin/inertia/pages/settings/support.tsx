import { Head, Link } from '@inertiajs/react'
import { IconExternalLink } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import SettingsLayout from '~/layouts/SettingsLayout'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import { useProject } from '~/hooks/use_project'

const UPSTREAM_REPO_URL = 'https://github.com/Crosstalk-Solutions/project-nomad'

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-desert-green hover:underline"
    >
      {children}
      <IconExternalLink size={16} aria-hidden="true" />
    </a>
  )
}

/**
 * About & Support. An independent distribution has no donation or marketing section: this page says what
 * monolith-nomad is, where to report problems, where the source code is, and credits the original project.
 */
export default function SupportPage() {
  const { repoUrl, issuesUrl } = useProject()
  const { t } = useTranslation()
  const noticesUrl = `${repoUrl}/blob/main/THIRD_PARTY_NOTICES.md`

  return (
    <SettingsLayout>
      <Head title={t('About & Support')} />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6 max-w-4xl">
          <h1 className="text-4xl font-semibold mb-4">{t('About & Support')}</h1>
          <p className="text-text-muted mb-10 text-lg">
            {t(
              'monolith-nomad is an independent distribution derived from Project N.O.M.A.D. It is not an official version and is not affiliated with or endorsed by the original project or Crosstalk Solutions, LLC.'
            )}
          </p>

          <section className="mb-10">
            <StyledSectionHeader title={t('Report a problem')} />
            <p className="text-text-primary mb-3">
              {t(
                'Found a bug or have a suggestion? Open an issue in the monolith-nomad repository. Including the "Debug Info" text (link at the bottom of the home screen) helps diagnose the problem.'
              )}
            </p>
            <ExternalLink href={issuesUrl}>{t('Open an issue')}</ExternalLink>
          </section>

          <section className="mb-10">
            <StyledSectionHeader title={t('Source code')} />
            <p className="text-text-primary mb-3">
              {t(
                'monolith-nomad is open source software under the Apache License 2.0. The code, the change history and the documentation are in the repository.'
              )}
            </p>
            <ExternalLink href={repoUrl}>{t('View the repository')}</ExternalLink>
          </section>

          <section className="mb-10">
            <StyledSectionHeader title={t('Original project')} />
            <p className="text-text-primary mb-3">
              {t(
                'monolith-nomad is built on Project N.O.M.A.D., created by Crosstalk Solutions, LLC and released under the Apache License 2.0. Credit for the original work belongs to its authors. Problems with this distribution should be reported here, not to the original project.'
              )}
            </p>
            <ExternalLink href={UPSTREAM_REPO_URL}>{t('Project N.O.M.A.D. on GitHub')}</ExternalLink>
          </section>

          <section className="mb-10">
            <StyledSectionHeader title={t('Licenses and notices')} />
            <p className="text-text-primary mb-3">
              {t(
                'The license, the copyright notice of the original work and the third-party attributions are on the Legal Notices page. The full list of components, licenses and trademarks is in THIRD_PARTY_NOTICES.md in the repository.'
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link href="/settings/legal" className="font-medium text-desert-green hover:underline">
                {t('Legal Notices')}
              </Link>
              <ExternalLink href={noticesUrl}>THIRD_PARTY_NOTICES.md</ExternalLink>
            </div>
          </section>
        </main>
      </div>
    </SettingsLayout>
  )
}
