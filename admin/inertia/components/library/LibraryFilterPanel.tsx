import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DynamicIcon, { DynamicIconName } from '~/components/DynamicIcon'
import Chip from '~/components/nd/Chip'
import classNames from '~/lib/class_names'
import {
  LEVEL_ORDER,
  LIBRARY_FORMATS,
  languageLabel,
  type FacetCounts,
  type LibraryFilters,
} from '~/lib/library_filters'
import type { LibraryArea } from '../../../types/library'
import { LEVEL_LABEL } from './LevelDots'

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
      <legend className="nd-eyebrow mb-2.5 float-left w-full">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  )
}

/**
 * Faceted filters: area (the knowledge field), subject (its subcategories), language, level and
 * format. Every option shows how many works it would leave; options that would leave none are
 * disabled instead of hidden, so the catalogue's shape stays visible.
 */
export default function LibraryFilterPanel({
  areas,
  counts,
  filters,
  onChange,
}: {
  areas: LibraryArea[]
  counts: FacetCounts
  filters: LibraryFilters
  onChange: (patch: Partial<LibraryFilters>) => void
}) {
  const { t } = useTranslation()
  const [allSubjects, setAllSubjects] = useState(false)

  const subjects = [...counts.subject.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')
  )
  const visibleSubjects = allSubjects ? subjects : subjects.slice(0, 10)
  const languages = [...counts.lang.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-5">
      <Group title={t('Area of knowledge')}>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              aria-pressed={filters.area === null}
              onClick={() => onChange({ area: null, subject: null })}
              className={classNames(
                'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm cursor-pointer transition-colors duration-[140ms]',
                filters.area === null
                  ? 'bg-surface-elevated text-text-primary'
                  : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
              )}
            >
              <span className="flex-1">{t('All areas')}</span>
            </button>
          </li>
          {areas.map((a) => {
            const n = counts.area.get(a.slug) ?? 0
            const active = filters.area === a.slug
            return (
              <li key={a.slug}>
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={n === 0 && !active}
                  onClick={() => onChange({ area: active ? null : a.slug, subject: null })}
                  className={classNames(
                    'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm cursor-pointer transition-colors duration-[140ms] disabled:opacity-40 disabled:cursor-not-allowed',
                    active
                      ? 'bg-surface-elevated text-text-primary'
                      : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                  )}
                >
                  <DynamicIcon icon={a.icon as DynamicIconName} className="!size-4 shrink-0" stroke={1.75} />
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="nd-mono text-[11px] text-text-muted">{n}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Group>

      {subjects.length > 0 && (
        <Group title={filters.area ? t('Subjects in this area') : t('Subjects')}>
          <div className="flex flex-wrap gap-1.5">
            {visibleSubjects.map(([subject, n]) => (
              <Chip
                key={subject}
                active={filters.subject === subject}
                count={n}
                onClick={() => onChange({ subject: filters.subject === subject ? null : subject })}
              >
                {subject}
              </Chip>
            ))}
          </div>
          {subjects.length > 10 && (
            <button
              type="button"
              onClick={() => setAllSubjects((v) => !v)}
              className="mt-2 text-xs text-text-secondary underline-offset-4 hover:text-text-primary hover:underline cursor-pointer"
            >
              {allSubjects
                ? t('Show fewer')
                : t('Show all {{count}}', { count: subjects.length })}
            </button>
          )}
        </Group>
      )}

      <Group title={t('Level')}>
        <div className="flex flex-wrap gap-1.5">
          {LEVEL_ORDER.map((l) => (
            <Chip
              key={l}
              active={filters.level === l}
              count={counts.level.get(l) ?? 0}
              disabled={!counts.level.get(l) && filters.level !== l}
              onClick={() => onChange({ level: filters.level === l ? null : l })}
            >
              {t(LEVEL_LABEL[l])}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title={t('Format')}>
        <div className="flex flex-wrap gap-1.5">
          {LIBRARY_FORMATS.map((f) => (
            <Chip
              key={f}
              active={filters.format === f}
              count={counts.format.get(f) ?? 0}
              disabled={!counts.format.get(f) && filters.format !== f}
              onClick={() => onChange({ format: filters.format === f ? null : f })}
            >
              {f.toUpperCase()}
            </Chip>
          ))}
        </div>
      </Group>

      {languages.length > 0 && (
        <Group title={t('Language')}>
          <div className="flex flex-wrap gap-1.5">
            {languages.map(([code, n]) => (
              <Chip
                key={code}
                active={filters.lang === code}
                count={n}
                onClick={() => onChange({ lang: filters.lang === code ? null : code })}
              >
                {t(languageLabel(code))}
              </Chip>
            ))}
          </div>
        </Group>
      )}
    </div>
  )
}
