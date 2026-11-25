import { useTranslation } from 'react-i18next'
import Badge from '~/components/nd/Badge'
import type { SurvivalMeta } from '../../../types/assistant'

/**
 * What the survival agent understood before answering: gravity level (1–6), hazards, phase and place.
 * Shown above the answer so a wrong classification is visible and can be corrected by rephrasing.
 */
export default function SurvivalScenarioCard({ meta }: { meta: SurvivalMeta }) {
  const { t } = useTranslation()
  const { labels, scenario, location } = meta
  const place = [
    location.place,
    labels.state,
    labels.region && t('{{region}} region', { region: labels.region }),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="mb-3 rounded-xl border border-border-subtle bg-surface-secondary px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={scenario.level >= 4 ? 'error' : scenario.level >= 2 ? 'warn' : 'neutral'}>
          {t('Level {{level}}', { level: scenario.level })}
        </Badge>
        <span className="font-medium text-text-primary">{labels.level}</span>
      </div>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-text-secondary">
        <dt className="text-text-muted">{t('Hazard')}</dt>
        <dd>{labels.hazards.length ? labels.hazards.join('; ') : t('not identified')}</dd>
        <dt className="text-text-muted">{t('Phase')}</dt>
        <dd>{labels.phase}</dd>
        <dt className="text-text-muted">{t('Location')}</dt>
        <dd>
          {place || t('not informed')}
          {location.environment
            ? ` · ${t(location.environment === 'rural' ? 'Rural' : 'Urban')}`
            : ''}
          {location.source === 'settings' ? ` (${t('from settings')})` : ''}
        </dd>
      </dl>
      <p className="mt-1.5 text-text-muted">
        {scenario.method === 'model'
          ? t('Automatic classification by the local model; it may be wrong.')
          : t('Automatic classification by keywords; it may be wrong.')}
      </p>
    </div>
  )
}
