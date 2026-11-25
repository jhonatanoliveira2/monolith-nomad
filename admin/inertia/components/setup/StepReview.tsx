import { useTranslation } from 'react-i18next'
import Badge from '~/components/nd/Badge'
import { formatBytes } from '~/lib/util'
import type { ContentPlan, SetupDraft } from '~/lib/setup_plan'
import type { CategoryWithStatus } from '../../../types/collections'
import { BRAZIL_STATES, BRAZIL_TIMEZONES } from '../../../constants/brazil'
import { PROFILE_LABEL } from './CategoryPlanner'
import { MAP_DETAIL } from './StepMaps'

function Group({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit?: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <section className="nd-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="nd-eyebrow !text-xs !text-text-secondary">{title}</h3>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-text-secondary underline-offset-4 hover:text-text-primary hover:underline cursor-pointer"
          >
            {t('Change')}
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function Row({
  label,
  value,
  bytes,
}: {
  label: string
  value?: React.ReactNode
  bytes?: number | null
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="min-w-0 text-text-primary">{label}</span>
      <span className="flex shrink-0 items-center gap-2 text-text-secondary">
        {value}
        {bytes !== undefined && (
          <span className="nd-mono w-20 text-right text-text-primary">
            {bytes === null ? '—' : formatBytes(bytes, 1)}
          </span>
        )}
      </span>
    </div>
  )
}

export default function StepReview({
  draft,
  goTo,
  serviceNames,
  mapLabel,
  mapBytes,
  mapInstalled,
  plan,
  categories,
  wikipediaLabel,
  wikipediaBytes,
  modelBytes,
  packBytes,
  collectionsBytes,
  survival,
}: {
  draft: SetupDraft
  goTo: (step: number) => void
  serviceNames: string[]
  mapLabel: string | null
  mapBytes: number | null
  mapInstalled: boolean
  plan: ContentPlan
  categories: CategoryWithStatus[]
  wikipediaLabel: string | null
  wikipediaBytes: number
  modelBytes: number
  packBytes: number
  collectionsBytes: number
  survival: { queue: { id: string }[]; skipped: number; bytes: number }
}) {
  const { t } = useTranslation()
  const state = BRAZIL_STATES.find((s) => s.code === draft.state)
  const tz = BRAZIL_TIMEZONES.find((z) => z.id === draft.timezone)
  const detail = MAP_DETAIL.find((d) => d.zoom === draft.maps.maxzoom)
  const planBySlug = new Map(plan.byCategory.map((c) => [c.slug, c]))

  return (
    <div className="space-y-3">
      <Group title={t('Region')} onEdit={() => goTo(1)}>
        <Row
          label={t('State')}
          value={state ? `${state.name} (${state.uf})` : t('Not specified')}
        />
        <Row label={t('Time zone')} value={tz ? `${tz.offset} · ${tz.label}` : draft.timezone} />
        <Row
          label={t('Environment')}
          value={
            draft.environment
              ? t(draft.environment === 'rural' ? 'Rural' : 'Urban')
              : t('Not specified')
          }
        />
        {draft.place && <Row label={t('City or area')} value={draft.place} />}
        <Row label={t('Language')} value="Português (Brasil)" />
      </Group>

      <Group title={t('Features')} onEdit={() => goTo(1)}>
        {serviceNames.length === 0 && draft.aiModels.length === 0 ? (
          <p className="text-sm text-text-muted">{t('No new apps.')}</p>
        ) : (
          <>
            {serviceNames.map((n) => (
              <Row key={n} label={n} value={<Badge>{t('Install')}</Badge>} />
            ))}
            {draft.aiModels.length > 0 && (
              <Row
                label={t('AI models: {{list}}', { list: draft.aiModels.join(', ') })}
                bytes={modelBytes}
              />
            )}
          </>
        )}
      </Group>

      <Group title={t('Maps')} onEdit={() => goTo(2)}>
        {mapLabel ? (
          <Row
            label={mapLabel}
            value={
              mapInstalled ? (
                <Badge tone="ok">{t('Already downloaded')}</Badge>
              ) : (
                detail && <Badge>{t(detail.label)}</Badge>
              )
            }
            bytes={mapInstalled ? 0 : mapBytes}
          />
        ) : (
          <p className="text-sm text-text-muted">{t('No Brazilian map.')}</p>
        )}
        {draft.maps.collections.length > 0 && (
          <Row
            label={
              draft.maps.collections.length === 1
                ? t('1 other curated map')
                : t('{{count}} other curated maps', { count: draft.maps.collections.length })
            }
            bytes={collectionsBytes}
          />
        )}
      </Group>

      <Group title={t('Content')} onEdit={() => goTo(3)}>
        {draft.survivalLibrary !== 'none' && (
          <Row
            label={t('Survival library')}
            value={
              survival.queue.length === 0
                ? t('Already installed')
                : survival.queue.length === 1
                  ? t('1 publication')
                  : t('{{count}} publications', { count: survival.queue.length })
            }
            bytes={survival.bytes}
          />
        )}
        {wikipediaLabel && <Row label={wikipediaLabel} bytes={wikipediaBytes} />}
        {Object.entries(draft.categories).length === 0 && !wikipediaLabel ? (
          <p className="text-sm text-text-muted">{t('No content selected.')}</p>
        ) : (
          categories
            .filter((c) => draft.categories[c.slug])
            .map((c) => {
              const sel = draft.categories[c.slug]
              const p = planBySlug.get(c.slug)
              return (
                <Row
                  key={c.slug}
                  label={c.name}
                  value={
                    <>
                      <Badge>{t(PROFILE_LABEL[sel.profile])}</Badge>
                      {(sel.english || sel.extra.length > 0) && <Badge tone="warn">EN</Badge>}
                      <span className="text-xs">
                        {(p?.resourceIds.length ?? 0) === 1
                          ? t('1 new')
                          : t('{{count}} new', { count: p?.resourceIds.length ?? 0 })}
                      </span>
                    </>
                  }
                  bytes={p?.bytes ?? 0}
                />
              )
            })
        )}
        {draft.creatorPacks.length > 0 && (
          <Row
            label={
              draft.creatorPacks.length === 1
                ? t('1 creator pack')
                : t('{{count}} creator packs', { count: draft.creatorPacks.length })
            }
            bytes={packBytes}
          />
        )}
        {plan.skipped > 0 && (
          <p className="mt-2 text-xs text-text-muted">
            {t(
              plan.skipped === 1
                ? '1 item is already installed or downloading and will not be downloaded again.'
                : '{{count}} items are already installed or downloading and will not be downloaded again.',
              {
                count: plan.skipped,
              }
            )}
          </p>
        )}
      </Group>

      <p className="text-xs text-text-muted">
        {t(
          'Downloads run in the background and resume after a failure. You can follow, cancel or retry them on the Downloads screen.'
        )}
      </p>
    </div>
  )
}
