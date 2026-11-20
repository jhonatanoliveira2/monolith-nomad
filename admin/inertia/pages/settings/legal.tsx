import { Head } from '@inertiajs/react'
import { Trans, useTranslation } from 'react-i18next'
import SettingsLayout from '~/layouts/SettingsLayout'
import { useProject } from '~/hooks/useProject'

const LINK_CLASS = 'text-text-primary underline underline-offset-2 hover:text-text-secondary'
const strong = { strong: <strong /> }

export default function LegalPage() {
  const { t } = useTranslation()
  const { repoUrl } = useProject()
  const noticesUrl = `${repoUrl}/blob/main/THIRD_PARTY_NOTICES.md`

  // Third-party projects: names, licenses and URLs are not translated; the descriptions are.
  const thirdParty = [
    { name: 'Kiwix', description: t('Offline Wikipedia and content reader'), license: 'GPL-3.0', url: 'https://kiwix.org' },
    {
      name: 'Kolibri',
      description: t('Offline learning platform by Learning Equality'),
      license: 'MIT',
      url: 'https://learningequality.org/kolibri',
    },
    { name: 'Ollama', description: t('Local large language model runtime'), license: 'MIT', url: 'https://ollama.com' },
    {
      name: 'CyberChef',
      description: t('Data analysis and encoding toolkit by GCHQ'),
      license: 'Apache 2.0',
      url: 'https://github.com/gchq/CyberChef',
    },
    {
      name: 'FlatNotes',
      description: t('Self-hosted note-taking application'),
      license: 'MIT',
      url: 'https://github.com/dullage/flatnotes',
    },
    {
      name: 'Qdrant',
      description: t('Vector search engine for AI knowledge base'),
      license: 'Apache 2.0',
      url: 'https://github.com/qdrant/qdrant',
    },
  ]

  return (
    <SettingsLayout>
      <Head title={t('Legal Notices')} />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6 max-w-4xl">
          <h1 className="text-4xl font-semibold mb-8">{t('Legal Notices')}</h1>

          {/* About this distribution */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('About this distribution')}</h2>
            <p className="text-text-primary mb-3">
              {t(
                'monolith-nomad is an independent derivative work of Project N.O.M.A.D. (Crosstalk Solutions, LLC), distributed under the Apache License 2.0. The modifications in this distribution were made by the monolith-nomad maintainer and are recorded in the repository history.'
              )}
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-primary mb-3">
              <li>
                <Trans
                  i18nKey="monolith-nomad is <strong>not official</strong> and is <strong>not affiliated with</strong> or endorsed by Crosstalk Solutions, LLC, Canonical Ltd. or Nothing Technology Limited."
                  components={strong}
                />
              </li>
              <li>
                {t(
                  'Ubuntu and the "Circle of Friends" logo are trademarks of Canonical Ltd. The interface uses a monochrome Circle of Friends only to indicate that the server runs on Ubuntu. Nothing is a trademark of Nothing Technology Limited; the visual theme is only inspired by its dot-matrix style and uses none of its assets.'
                )}
              </li>
              <li>
                {t(
                  'The Doto, Space Grotesk and Space Mono fonts are distributed under the SIL Open Font License 1.1; each license file ships with the font.'
                )}
              </li>
            </ul>
            <p className="text-text-primary">
              <Trans
                i18nKey="The full list of components, licenses and trademarks is in <link>THIRD_PARTY_NOTICES.md</link> in the repository."
                components={{ link: <a href={noticesUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS} /> }}
              />
            </p>
          </section>

          {/* License Agreement */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('License Agreement')}</h2>
            <p className="text-text-muted mb-4">
              {t(
                'monolith-nomad is distributed under the same license as the original work, the Apache License 2.0. The notice of the original work is reproduced below without changes, in English, which is the legally binding text.'
              )}
            </p>
            {/* Original work's notice, kept verbatim (Apache-2.0 §4): do not translate or edit. */}
            <div lang="en">
              <p className="text-text-primary mb-3">Copyright 2024-2026 Crosstalk Solutions, LLC</p>
              <p className="text-text-primary mb-3">
                Licensed under the Apache License, Version 2.0 (the &quot;License&quot;);
                you may not use this file except in compliance with the License.
                You may obtain a copy of the License at
              </p>
              <p className="text-text-primary mb-3">
                <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>https://www.apache.org/licenses/LICENSE-2.0</a>
              </p>
              <p className="text-text-primary">
                Unless required by applicable law or agreed to in writing, software
                distributed under the License is distributed on an &quot;AS IS&quot; BASIS,
                WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                See the License for the specific language governing permissions and
                limitations under the License.
              </p>
            </div>
          </section>

          {/* Third-Party Software */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('Third-Party Software Attribution')}</h2>
            <p className="text-text-primary mb-4">
              {t(
                'monolith-nomad, like the original Project N.O.M.A.D., integrates the following open source projects. We are grateful to their developers and communities:'
              )}
            </p>
            <ul className="space-y-3 text-text-primary">
              {thirdParty.map((p) => (
                <li key={p.name}>
                  <strong>{p.name}</strong> - {p.description} ({t('{{license}} License', { license: p.license })})
                  <br />
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>{p.url}</a>
                </li>
              ))}
            </ul>
          </section>

          {/* Privacy Statement */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('Privacy Statement')}</h2>
            <p className="text-text-primary mb-3">
              {t('monolith-nomad is designed with privacy as a core principle:')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-primary">
              <li>
                <Trans
                  i18nKey="<strong>Zero Telemetry:</strong> monolith-nomad does not collect, transmit, or store any usage data, analytics, or telemetry."
                  components={strong}
                />
              </li>
              <li>
                <Trans
                  i18nKey="<strong>Local-First:</strong> All your data, downloaded content, AI conversations, and notes remain on your device."
                  components={strong}
                />
              </li>
              <li>
                <Trans
                  i18nKey="<strong>No Accounts Required:</strong> monolith-nomad operates without user accounts or authentication by default."
                  components={strong}
                />
              </li>
              <li>
                <Trans
                  i18nKey="<strong>Network Optional:</strong> An internet connection is only required to download content or updates. All installed features work fully offline."
                  components={strong}
                />
              </li>
            </ul>
          </section>

          {/* Content Disclaimer */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('Content Disclaimer')}</h2>
            <p className="text-text-primary mb-3">
              {t(
                'monolith-nomad provides tools to download and access content from third-party sources including Wikipedia, Wikibooks, medical references, educational platforms, and other publicly available resources.'
              )}
            </p>
            <p className="text-text-primary mb-3">
              {t(
                'Neither the monolith-nomad maintainer nor Crosstalk Solutions, LLC creates, controls, verifies, or guarantees the accuracy, completeness, or reliability of any third-party content. The inclusion of any content does not constitute an endorsement.'
              )}
            </p>
            <p className="text-text-primary">
              {t(
                'Users are responsible for evaluating the appropriateness and accuracy of any content they download and use.'
              )}
            </p>
          </section>

          {/* Medical Disclaimer */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('Medical and Emergency Information Disclaimer')}</h2>
            <p className="text-text-primary mb-3">
              {t(
                'Some content available through monolith-nomad includes medical references, first aid guides, and emergency preparedness information. This content is provided for general informational purposes only.'
              )}
            </p>
            <p className="text-text-primary mb-3 font-semibold">
              {t('This information is NOT a substitute for professional medical advice, diagnosis, or treatment.')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-primary mb-3">
              <li>{t('Always seek the advice of qualified health providers with questions about medical conditions.')}</li>
              <li>
                {t(
                  'Never disregard professional medical advice or delay seeking it because of something you read in offline content.'
                )}
              </li>
              <li>{t('In a medical emergency, call emergency services immediately if available.')}</li>
              <li>
                {t(
                  'Medical information may become outdated. Verify critical information with current professional sources when possible.'
                )}
              </li>
            </ul>
          </section>

          {/* Data Storage Notice */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('Data Storage')}</h2>
            <p className="text-text-primary mb-3">
              {t('All data associated with monolith-nomad is stored locally on your device:')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-primary">
              <li><strong>{t('Installation Directory:')}</strong> /opt/project-nomad</li>
              <li><strong>{t('Downloaded Content:')}</strong> /opt/project-nomad/storage</li>
              <li><strong>{t('Application Data:')}</strong> {t('Stored in Docker volumes on your local system')}</li>
            </ul>
            <p className="text-text-primary mt-3">
              {t(
                'You maintain full control over your data. Uninstalling monolith-nomad or deleting these directories will permanently remove all associated data.'
              )}
            </p>
          </section>

        </main>
      </div>
    </SettingsLayout>
  )
}
