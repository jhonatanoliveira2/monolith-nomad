import { Link } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import classNames from '~/lib/class_names'
import type { ChatSource, ChatSourceLocation } from '../../../types/chat'

/**
 * Library PDF/EPUB files (storage/library/<name>.pdf) open in the offline reader; everything else
 * (ZIMs, uploads) has no reader link.
 */
export function readerHref(
  source: string | undefined,
  location?: ChatSourceLocation
): string | null {
  const match = source
    ? /[/\\]storage[/\\]library[/\\]([^/\\]+\.(pdf|epub))$/i.exec(source)
    : null
  if (!match) return null
  const base = `/library/read/${encodeURIComponent(match[1])}`
  if (location?.page) return `${base}?page=${location.page}`
  if (location?.href) return `${base}?href=${encodeURIComponent(location.href)}`
  return base
}

/** "Sources" under an answer: each work with the pages or chapters the answer was based on. */
export default function SourceList({
  sources,
  className,
}: {
  sources: ChatSource[]
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div className={classNames('text-xs text-text-primary', className)}>
      <div className="mb-1 font-medium">{t('Sources')}</div>
      <ul className="space-y-1">
        {sources.map((src, idx) => {
          const open = readerHref(src.source)
          return (
            <li key={idx}>
              {open ? (
                <Link
                  href={open}
                  className="underline decoration-border-default underline-offset-4 hover:decoration-text-primary"
                >
                  {src.title}
                </Link>
              ) : (
                src.title
              )}
              {src.date && <span className="text-text-secondary"> ({src.date})</span>}
              {src.locations && src.locations.length > 0 && (
                <span className="text-text-secondary">
                  {' — '}
                  {src.locations.map((loc, i) => {
                    const href = readerHref(src.source, loc)
                    return (
                      <span key={loc.label}>
                        {i > 0 && ', '}
                        {href ? (
                          <Link
                            href={href}
                            className="underline decoration-border-default underline-offset-2 hover:text-text-primary"
                          >
                            {loc.label}
                          </Link>
                        ) : (
                          loc.label
                        )}
                      </span>
                    )
                  })}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
