import { Head } from '@inertiajs/react'
import { useEffect } from 'react'
import MarkdocRenderer from '~/components/MarkdocRenderer'
import DocsLayout from '~/layouts/DocsLayout'
import { useTranslation } from 'react-i18next'

export default function Show({ content }: { content: any }) {
  const { t } = useTranslation()
  // Deep-link support: when arriving at /docs/<slug>#<anchor> (e.g. from a Supply Depot app's
  // "Docs" menu item), scroll to that section. The content renders synchronously from props, so a
  // double rAF lets the headings paint before we look one up.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''))
    if (!hash) return
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    )
  }, [content])

  return (
    <DocsLayout>
      <Head title={t('Documentation')} />
      <article className="max-w-3xl animate-nd-fade">
        <MarkdocRenderer content={content} />
      </article>
    </DocsLayout>
  )
}
