import { IconCheck, IconChevronDown } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Badge from '~/components/nd/Badge'
import DynamicIcon, { DynamicIconName } from '~/components/DynamicIcon'
import Switch from '~/components/inputs/Switch'
import classNames from '~/lib/class_names'
import { formatBytes } from '~/lib/util'
import {
  bytesOf,
  categoryResources,
  DEFAULT_SELECTION,
  languageGroup,
  PROFILES,
  profileSummary,
  selectedResources,
  type CategorySelection,
  type SetupProfile,
} from '~/lib/setup_plan'
import type { CategoryWithStatus } from '../../../types/collections'

export const PROFILE_LABEL: Record<SetupProfile, string> = {
  essential: 'Essential',
  standard: 'Standard',
  complete: 'Comprehensive',
  custom: 'Custom',
}

function langBadge(language?: string) {
  const l = (language ?? 'pt').toLowerCase()
  if (l === 'mul') return 'MULTI'
  return l.toUpperCase()
}

/**
 * One content category: pick Essential / Standard / Complete (or a custom list), Portuguese first.
 * Each profile shows its real size from the manifest; English items are listed apart and stay off
 * until enabled for the category or one by one.
 */
export default function CategoryPlanner({
  category,
  selection,
  onChange,
  disabled,
}: {
  category: CategoryWithStatus
  selection: CategorySelection | undefined
  onChange: (sel: CategorySelection | undefined) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const installed = new Set(category.installedResourceIds ?? [])
  const downloading = new Set(category.downloadingResourceIds ?? [])
  const all = categoryResources(category)
  const english = selection?.english ?? false
  const chosen = selection ? selectedResources(category, selection) : []
  const chosenIds = new Set(chosen.map((r) => r.id))
  const chosenBytes = chosen.filter((r) => !installed.has(r.id)).reduce((s, r) => s + bytesOf(r), 0)
  const foreignAll = all.filter((x) => languageGroup(x.resource.language) !== 'pt')
  const onlyForeign = foreignAll.length === all.length

  const setProfile = (profile: SetupProfile | null) => {
    if (!profile) return onChange(undefined)
    if (profile === 'custom') {
      return onChange({
        ...(selection ?? DEFAULT_SELECTION),
        profile,
        custom: chosen.map((r) => r.id),
      })
    }
    onChange({
      ...(selection ?? DEFAULT_SELECTION),
      profile,
      english: selection?.english ?? onlyForeign,
    })
  }

  const toggleResource = (id: string, foreign: boolean) => {
    if (!selection) return
    if (selection.profile === 'custom') {
      const custom = selection.custom.includes(id)
        ? selection.custom.filter((x) => x !== id)
        : [...selection.custom, id]
      return onChange({ ...selection, custom })
    }
    if (!foreign || selection.english) return
    const extra = selection.extra.includes(id)
      ? selection.extra.filter((x) => x !== id)
      : [...selection.extra, id]
    onChange({ ...selection, extra })
  }

  const profileOptions: (SetupProfile | null)[] = [null, ...PROFILES, 'custom']
  const foreignInProfile =
    selection && selection.profile !== 'custom'
      ? profileSummary(category, selection.profile, false)
      : null

  return (
    <article
      className={classNames(
        'nd-card overflow-hidden transition-colors duration-[140ms]',
        selection && '!border-highlight'
      )}
    >
      <div className="flex flex-wrap items-start gap-4 p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-elevated">
          <DynamicIcon icon={category.icon as DynamicIconName} className="!size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-text-primary">{category.name}</h3>
          <p className="mt-0.5 text-sm text-text-secondary line-clamp-2">{category.description}</p>
          {onlyForeign && (
            <p className="mt-1 text-xs text-desert-orange-dark">
              {t('Only English content in this category.')}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="nd-mono text-sm text-text-primary">
            {selection ? formatBytes(chosenBytes, 1) : '—'}
          </p>
          <p className="text-xs text-text-muted">
            {selection
              ? chosen.length === 1
                ? t('1 item')
                : t('{{count}} items', { count: chosen.length })
              : t('Not included')}
          </p>
        </div>
      </div>

      {/* Profiles with their real size */}
      <div
        role="radiogroup"
        aria-label={t('Download profile for {{name}}', { name: category.name })}
        className="grid grid-cols-2 gap-px border-t border-border-subtle bg-border-subtle sm:grid-cols-5"
      >
        {profileOptions.map((p) => {
          const active = (selection?.profile ?? null) === p
          const summary = p && p !== 'custom' ? profileSummary(category, p, english) : null
          return (
            <button
              key={p ?? 'none'}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => setProfile(p)}
              className={classNames(
                'flex flex-col items-start gap-0.5 px-4 py-3 text-left cursor-pointer transition-colors duration-[140ms] disabled:cursor-not-allowed',
                active ? 'bg-surface-elevated' : 'bg-surface-primary hover:bg-surface-secondary'
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                {active && <span className="nd-led text-highlight" aria-hidden="true" />}
                {p ? t(PROFILE_LABEL[p]) : t('None')}
              </span>
              <span className="nd-mono text-[11px] text-text-muted">
                {summary
                  ? summary.count === 0
                    ? '—'
                    : `${formatBytes(summary.bytes, 1)} · ${summary.count}`
                  : p === 'custom'
                    ? t('pick items')
                    : t('skip')}
              </span>
            </button>
          )
        })}
      </div>

      {/* Language and items */}
      {selection && (
        <div className="border-t border-border-subtle px-5 py-4">
          {selection.profile !== 'custom' &&
            foreignInProfile &&
            (foreignInProfile.foreignCount > 0 || selection.english) && (
              <Switch
                checked={selection.english}
                onChange={(v) => onChange({ ...selection, english: v, extra: [] })}
                label={t('Include English items')}
                description={
                  foreignInProfile.foreignCount > 0
                    ? t(
                        foreignInProfile.foreignCount === 1
                          ? '1 item, {{size}}, off by default'
                          : '{{count}} items, {{size}}, off by default',
                        {
                          count: foreignInProfile.foreignCount,
                          size: formatBytes(foreignInProfile.foreignBytes, 1),
                        }
                      )
                    : t('All items of this profile are included')
                }
              />
            )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-2 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <IconChevronDown
              size={16}
              className={classNames('transition-transform duration-[140ms]', open && 'rotate-180')}
            />
            {open
              ? t('Hide items')
              : t('See the {{count}} items and the differences between profiles', {
                  count: all.length,
                })}
          </button>
          {open && (
            <ul className="mt-3 divide-y divide-border-subtle">
              {all.map(({ resource, profile }) => {
                const foreign = languageGroup(resource.language) !== 'pt'
                const on = chosenIds.has(resource.id)
                const isInstalled = installed.has(resource.id)
                const isDownloading = downloading.has(resource.id)
                const editable =
                  selection.profile === 'custom' ||
                  (foreign &&
                    !selection.english &&
                    PROFILES.indexOf(profile) <= PROFILES.indexOf(selection.profile as never))
                return (
                  <li key={resource.id} className="flex items-start gap-3 py-2.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={resource.title}
                      disabled={!editable || disabled}
                      onClick={() => toggleResource(resource.id, foreign)}
                      className={classNames(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border',
                        on
                          ? 'border-highlight bg-highlight text-highlight-contrast'
                          : 'border-border-default',
                        editable ? 'cursor-pointer' : 'cursor-default opacity-60'
                      )}
                    >
                      {on && <IconCheck size={12} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary">{resource.title}</p>
                      <p className="text-xs text-text-muted line-clamp-1">{resource.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      <Badge tone={foreign ? 'warn' : 'neutral'}>
                        {langBadge(resource.language)}
                      </Badge>
                      <Badge>{t(PROFILE_LABEL[profile])}</Badge>
                      {isInstalled ? (
                        <Badge tone="ok">{t('Installed')}</Badge>
                      ) : isDownloading ? (
                        <Badge tone="warn">{t('Downloading')}</Badge>
                      ) : null}
                      <span className="nd-mono w-16 text-right text-xs text-text-secondary">
                        {formatBytes(bytesOf(resource), 1)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}
