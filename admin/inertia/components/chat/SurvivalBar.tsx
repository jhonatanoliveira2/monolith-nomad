import { IconMapPin, IconWifiOff } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import SegmentedControl from '~/components/nd/SegmentedControl'
import { BRAZIL_REGIONS, BRAZIL_STATES } from '../../../constants/brazil'

export type AssistantMode = 'general' | 'survival'
export type ChatLocation = {
  state: string | null
  environment: 'urbano' | 'rural' | null
  place: string | null
}

/**
 * Mode switch between the general chat and the survival agent, and, in survival mode, where the user
 * is (state, urban or rural, a place name) plus the standing offline notice: the agent has no live
 * alerts or news, only the library, whose dates are shown.
 */
export default function SurvivalBar({
  mode,
  onModeChange,
  location,
  onLocationChange,
  onSaveDefault,
  knowledge,
}: {
  mode: AssistantMode
  onModeChange: (mode: AssistantMode) => void
  location: ChatLocation
  onLocationChange: (location: ChatLocation) => void
  onSaveDefault?: () => void
  knowledge?: { works: number; newest: string | null; oldest: string | null } | null
}) {
  const { t } = useTranslation()
  const field =
    'rounded-xl border border-border-default bg-surface-primary px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-desert-green'
  return (
    <div className="border-b border-border-subtle bg-surface-secondary px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SegmentedControl
          size="sm"
          label={t('Assistant mode')}
          value={mode}
          onChange={onModeChange}
          options={[
            { value: 'general', label: t('General') },
            { value: 'survival', label: t('Survival') },
          ]}
        />
        {mode === 'survival' && (
          <div className="flex flex-wrap items-center gap-2">
            <IconMapPin size={16} className="text-text-muted" aria-hidden="true" />
            <label className="sr-only" htmlFor="survival-state">
              {t('State')}
            </label>
            <select
              id="survival-state"
              className={field}
              value={location.state ?? ''}
              onChange={(e) => onLocationChange({ ...location, state: e.target.value || null })}
            >
              <option value="">{t('State not informed')}</option>
              {BRAZIL_REGIONS.map((region) => (
                <optgroup key={region.id} label={region.name}>
                  {BRAZIL_STATES.filter((s) => s.region === region.id).map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <label className="sr-only" htmlFor="survival-environment">
              {t('Environment')}
            </label>
            <select
              id="survival-environment"
              className={field}
              value={location.environment ?? ''}
              onChange={(e) =>
                onLocationChange({
                  ...location,
                  environment: (e.target.value || null) as ChatLocation['environment'],
                })
              }
            >
              <option value="">{t('Urban or rural?')}</option>
              <option value="urbano">{t('Urban')}</option>
              <option value="rural">{t('Rural')}</option>
            </select>
            <label className="sr-only" htmlFor="survival-place">
              {t('City or area')}
            </label>
            <input
              id="survival-place"
              className={`${field} w-40`}
              maxLength={80}
              placeholder={t('City or area')}
              value={location.place ?? ''}
              onChange={(e) => onLocationChange({ ...location, place: e.target.value || null })}
            />
            {onSaveDefault && (
              <button
                type="button"
                onClick={onSaveDefault}
                className="rounded-full px-2.5 py-1 text-xs text-text-secondary underline decoration-border-default underline-offset-4 hover:text-text-primary"
              >
                {t('Save as default')}
              </button>
            )}
          </div>
        )}
      </div>
      {mode === 'survival' && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-text-muted">
          <IconWifiOff size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {t(
              'Offline: no live weather alerts, news or risk warnings. Answers come from the installed library.'
            )}{' '}
            {knowledge && knowledge.works > 0
              ? knowledge.works === 1
                ? t('1 survival work indexed, edition of {{newest}}.', {
                    newest: knowledge.newest ?? '?',
                  })
                : t('{{count}} survival works indexed, editions from {{oldest}} to {{newest}}.', {
                    count: knowledge.works,
                    oldest: knowledge.oldest ?? '?',
                    newest: knowledge.newest ?? '?',
                  })
              : t(
                  'No survival works indexed yet: install them in Library > Survival and Emergencies.'
                )}
          </span>
        </p>
      )}
    </div>
  )
}
