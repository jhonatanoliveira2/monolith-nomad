import { IconSearch } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type SearchHit = {
  id: string
  label: string
  before: string
  match: string
  after: string
  target: unknown
}

/** In-document search for both readers: type, press Enter, pick a result to jump there. */
export default function ReaderSearchPanel({
  initialQuery,
  hits,
  done,
  progress,
  onSearch,
  onSelect,
}: {
  initialQuery: string
  hits: SearchHit[]
  done: boolean
  progress?: string
  onSearch: (query: string) => void
  onSelect: (hit: SearchHit) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(initialQuery)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          onSearch(query)
        }}
        className="border-b border-border-subtle p-4"
      >
        <label className="relative block">
          <span className="sr-only">{t('Search in this document')}</span>
          <IconSearch
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search in this document')}
            className="nd-field !pl-9"
          />
        </label>
        <p className="mt-2 nd-mono text-[11px] text-text-muted" aria-live="polite">
          {initialQuery
            ? done
              ? hits.length === 1
                ? t('1 result')
                : t('{{count}} results', { count: hits.length })
              : (progress ?? t('Searching...'))
            : t('Press Enter to search')}
        </p>
      </form>
      <ol className="min-h-0 flex-1 overflow-y-auto p-2">
        {hits.map((hit) => (
          <li key={hit.id}>
            <button
              type="button"
              onClick={() => onSelect(hit)}
              className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-surface-secondary cursor-pointer"
            >
              <span className="nd-eyebrow !text-[10px]">{hit.label}</span>
              <span className="mt-1 block text-sm text-text-secondary line-clamp-3">
                {hit.before}
                <mark className="rounded bg-alert/25 px-0.5 text-text-primary">{hit.match}</mark>
                {hit.after}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
