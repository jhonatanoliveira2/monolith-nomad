import { router } from '@inertiajs/react'
import {
  IconAlertTriangle,
  IconCheck,
  IconLoader2,
  IconMap,
  IconRefresh,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import Badge from '~/components/nd/Badge'
import SegmentedControl from '~/components/nd/SegmentedControl'
import classNames from '~/lib/class_names'
import { formatBytes } from '~/lib/util'
import { mapCodes, mapLabel, type MapScope, type SetupDraft } from '~/lib/setup_plan'
import type { CollectionWithStatus } from '../../../types/collections'
import { BRAZIL_REGIONS, BRAZIL_STATES } from '../../../constants/brazil'
import { ChoiceCard } from './StepResources'

export type MapEstimate = {
  bytes: number | null
  loading: boolean
  error: string | null
  retry: () => void
}

/** Detail levels offered (pmtiles max zoom): sizes are measured for the actual selection. */
export const MAP_DETAIL = [
  { zoom: 15, label: 'Streets', hint: 'Streets, numbers and points of interest' },
  { zoom: 13, label: 'Neighbourhoods', hint: 'Streets of cities, less detail when zoomed in' },
  { zoom: 10, label: 'Cities', hint: 'Roads and cities, for an overview' },
] as const

export default function StepMaps({
  draft,
  update,
  estimate,
  installed,
  downloading,
  collections,
  online,
}: {
  draft: SetupDraft
  update: (patch: Partial<SetupDraft>) => void
  estimate: MapEstimate
  installed: boolean
  downloading: boolean
  collections: CollectionWithStatus[]
  online: boolean
}) {
  const { t } = useTranslation()
  const maps = draft.maps
  const setMaps = (patch: Partial<SetupDraft['maps']>) => update({ maps: { ...maps, ...patch } })
  const codes = mapCodes(maps)

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

  return (
    <div className="space-y-8">
      <section aria-labelledby="maps-area" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="maps-area" className="nd-eyebrow !text-xs !text-text-secondary">
            {t('Area')}
          </h2>
          <SegmentedControl<MapScope>
            label={t('Map area')}
            size="sm"
            value={maps.scope}
            onChange={(scope) => setMaps({ scope })}
            options={[
              { value: 'country', label: t('All of Brazil') },
              { value: 'regions', label: t('Regions') },
              { value: 'states', label: t('States') },
              { value: 'none', label: t('No maps') },
            ]}
          />
        </div>

        {maps.scope === 'country' && (
          <div className="nd-card nd-dot-field flex items-center gap-4 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-elevated">
              <IconMap className="size-5 text-highlight" />
            </span>
            <div>
              <p className="font-medium text-text-primary">{t('All of Brazil')}</p>
              <p className="text-sm text-text-secondary">
                {t('The 27 federative units in one offline map.')}
              </p>
            </div>
          </div>
        )}

        {maps.scope === 'regions' && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {BRAZIL_REGIONS.map((r) => {
              const states = BRAZIL_STATES.filter((s) => s.region === r.id)
              return (
                <ChoiceCard
                  key={r.id}
                  checked={maps.regions.includes(r.id)}
                  onToggle={() => setMaps({ regions: toggle(maps.regions, r.id) })}
                  className="!p-4"
                >
                  <p className="pr-8 font-medium text-text-primary">{r.name}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {states.map((s) => s.uf).join(' · ')}
                  </p>
                </ChoiceCard>
              )
            })}
          </div>
        )}

        {maps.scope === 'states' && (
          <div className="space-y-4">
            {BRAZIL_REGIONS.map((r) => (
              <fieldset key={r.id}>
                <legend className="nd-eyebrow mb-2 !text-[10px]">{r.name}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {BRAZIL_STATES.filter((s) => s.region === r.id).map((s) => {
                    const on = maps.states.includes(s.code)
                    return (
                      <button
                        key={s.code}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setMaps({ states: toggle(maps.states, s.code) })}
                        className={classNames(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs cursor-pointer transition-colors duration-[140ms]',
                          on
                            ? 'border-highlight bg-highlight text-highlight-contrast'
                            : 'border-border-default text-text-secondary hover:border-text-muted hover:text-text-primary'
                        )}
                      >
                        <span className="nd-mono">{s.uf}</span> {s.name}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </section>

      {maps.scope !== 'none' && (
        <section aria-labelledby="maps-detail" className="space-y-4">
          <h2 id="maps-detail" className="nd-eyebrow !text-xs !text-text-secondary">
            {t('Detail')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {MAP_DETAIL.map((d) => (
              <ChoiceCard
                key={d.zoom}
                checked={maps.maxzoom === d.zoom}
                onToggle={() => setMaps({ maxzoom: d.zoom })}
                className="!p-4"
              >
                <p className="pr-8 font-medium text-text-primary">{t(d.label)}</p>
                <p className="mt-1 text-xs text-text-muted">{t(d.hint)}</p>
                <p className="mt-2 nd-mono text-[10px] uppercase tracking-wider text-text-muted">
                  zoom {d.zoom}
                </p>
              </ChoiceCard>
            ))}
          </div>

          <div
            className="nd-card flex flex-wrap items-center justify-between gap-3 p-5"
            aria-live="polite"
          >
            <div className="min-w-0">
              <p className="font-medium text-text-primary">
                {codes.length > 0 ? mapLabel(maps) : t('Choose at least one area')}
              </p>
              <p className="text-xs text-text-muted">
                {t('Size measured on the map source for this exact selection.')}
              </p>
            </div>
            {installed ? (
              <Badge tone="ok">
                <IconCheck size={12} /> {t('Already downloaded')}
              </Badge>
            ) : downloading ? (
              <Badge tone="warn">{t('Downloading')}</Badge>
            ) : codes.length === 0 ? null : estimate.loading ? (
              <span className="inline-flex items-center gap-2 text-sm text-text-muted">
                <IconLoader2 size={16} className="animate-spin" /> {t('Measuring...')}
              </span>
            ) : estimate.error ? (
              <span className="inline-flex items-center gap-2 text-sm text-desert-red-dark">
                <IconAlertTriangle size={16} />
                {estimate.error}
                <button
                  type="button"
                  onClick={estimate.retry}
                  className="inline-flex items-center gap-1 underline cursor-pointer"
                  disabled={!online}
                >
                  <IconRefresh size={14} /> {t('Try again')}
                </button>
              </span>
            ) : estimate.bytes !== null ? (
              <span className="nd-display text-3xl text-text-primary">
                {formatBytes(estimate.bytes, 1)}
              </span>
            ) : null}
          </div>
        </section>
      )}

      {collections.length > 0 && (
        <details className="nd-card group p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span>
              <span className="font-medium text-text-primary">{t('Other curated maps')}</span>
              <span className="block text-xs text-text-muted">
                {t('Regions of the United States from the original catalog.')}
              </span>
            </span>
            <span className="nd-mono text-xs text-text-muted">{collections.length}</span>
          </summary>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {collections.map((c) => {
              const bytes = c.resources.reduce((s, r) => s + r.size_mb * 1024 * 1024, 0)
              return (
                <ChoiceCard
                  key={c.slug}
                  checked={c.all_installed || maps.collections.includes(c.slug)}
                  locked={c.all_installed}
                  onToggle={() => setMaps({ collections: toggle(maps.collections, c.slug) })}
                  className="!p-4"
                >
                  <p className="pr-8 text-sm font-medium text-text-primary">{c.name}</p>
                  <p className="mt-1 nd-mono text-xs text-text-muted">{formatBytes(bytes, 1)}</p>
                </ChoiceCard>
              )
            })}
          </div>
        </details>
      )}

      <p className="text-sm text-text-muted">
        {t('Other countries can be added any time in the')}{' '}
        <button
          type="button"
          onClick={() => router.visit('/settings/maps')}
          className="text-text-primary underline underline-offset-4 cursor-pointer"
        >
          {t('Maps Manager')}
        </button>
        .
      </p>
    </div>
  )
}
