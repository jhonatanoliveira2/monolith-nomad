import { Link, usePage } from '@inertiajs/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import AppShell from '~/layouts/AppShell'
import api from '~/lib/api'
import classNames from '~/lib/class_names'

/** Documentation: the list of guides is a secondary column beside the article (a select on mobile). */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { url } = usePage()
  const path = url.split(/[?#]/)[0]
  const { data, isLoading } = useQuery<Array<{ title: string; slug: string }>>({
    queryKey: ['docs'],
    queryFn: async () => (await api.listDocs()) ?? [],
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
  const docs = data ?? []

  return (
    <AppShell>
      <div className="nd-page">
        <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] xl:gap-12">
          <aside className="lg:sticky lg:top-10 lg:self-start">
            <p className="nd-eyebrow mb-3 flex items-center gap-2">
              <span className="nd-led text-led" aria-hidden="true" />
              {t('Documentation')}
            </p>
            <label className="lg:hidden block">
              <span className="sr-only">{t('Choose a guide')}</span>
              <select
                className="nd-field"
                value={path}
                onChange={(e) => (window.location.href = e.target.value)}
              >
                {docs.map((doc) => (
                  <option key={doc.slug} value={`/docs/${doc.slug}`}>
                    {doc.title}
                  </option>
                ))}
              </select>
            </label>
            <nav aria-label={t('Guides')} className="hidden lg:block">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="nd-skeleton h-7" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-0.5 border-l border-border-subtle">
                  {docs.map((doc) => {
                    const href = `/docs/${doc.slug}`
                    const active = path === href
                    return (
                      <li key={doc.slug}>
                        <Link
                          href={href}
                          aria-current={active ? 'page' : undefined}
                          className={classNames(
                            '-ml-px block border-l py-1.5 pl-4 pr-2 text-sm transition-colors duration-[140ms]',
                            active
                              ? 'border-led text-text-primary font-medium'
                              : 'border-transparent text-text-secondary hover:text-text-primary hover:border-text-muted'
                          )}
                        >
                          {doc.title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </nav>
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </AppShell>
  )
}
