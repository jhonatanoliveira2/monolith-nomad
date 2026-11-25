import { router } from '@inertiajs/react'
import { IconCheck, IconMapPin } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import Badge from '~/components/nd/Badge'
import SegmentedControl from '~/components/nd/SegmentedControl'
import DynamicIcon, { DynamicIconName } from '~/components/DynamicIcon'
import StyledButton from '~/components/StyledButton'
import LoadingSpinner from '~/components/LoadingSpinner'
import classNames from '~/lib/class_names'
import type { SetupDraft } from '~/lib/setup_plan'
import { BRAZIL_REGIONS, BRAZIL_STATES, BRAZIL_TIMEZONES } from '../../../constants/brazil'

export type Capability = {
  id: string
  name: string
  technicalName: string
  description: string
  features: string[]
  services: string[]
  icon: DynamicIconName
  installed: boolean
  available: boolean
}

export type RecommendedModel = {
  name: string
  description?: string
  tags?: { size?: string; input: string }[]
}

/** A checkbox-like card: whole card toggles, state is announced, installed ones are locked. */
export function ChoiceCard({
  checked,
  locked,
  onToggle,
  disabled,
  children,
  className,
}: {
  checked: boolean
  locked?: boolean
  onToggle: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={locked || disabled || undefined}
      onClick={() => !locked && !disabled && onToggle()}
      className={classNames(
        'relative w-full rounded-[var(--radius-card)] border p-5 text-left transition-[border-color,background-color] duration-[140ms]',
        checked
          ? 'border-highlight bg-surface-elevated'
          : 'border-border-default bg-surface-primary',
        locked || disabled ? 'cursor-default' : 'cursor-pointer hover:border-text-muted',
        disabled && 'opacity-50',
        className
      )}
    >
      <span
        className={classNames(
          'absolute right-4 top-4 flex size-6 items-center justify-center rounded-full border',
          checked
            ? 'border-highlight bg-highlight text-highlight-contrast'
            : 'border-border-default'
        )}
        aria-hidden="true"
      >
        {checked && <IconCheck size={14} />}
      </span>
      {children}
    </button>
  )
}

export default function StepResources({
  draft,
  update,
  capabilities,
  toggleCapability,
  aiName,
  aiInSetup,
  aiInstalled,
  remoteOllama,
  setRemoteOllama,
  models,
  modelsLoading,
  online,
}: {
  draft: SetupDraft
  update: (patch: Partial<SetupDraft>) => void
  capabilities: Capability[]
  toggleCapability: (c: Capability) => void
  aiName: string
  aiInSetup: boolean
  aiInstalled: boolean
  remoteOllama: { enabled: boolean; url: string; error: string | null }
  setRemoteOllama: (v: { enabled: boolean; url: string; error: string | null }) => void
  models: RecommendedModel[]
  modelsLoading: boolean
  online: boolean
}) {
  const { t } = useTranslation()
  const tzKnown = BRAZIL_TIMEZONES.some((z) => z.id === draft.timezone)

  return (
    <div className="space-y-10">
      {/* Region and language */}
      <section aria-labelledby="setup-region" className="nd-card p-6">
        <div className="flex items-start gap-3">
          <IconMapPin className="mt-0.5 size-5 text-highlight" />
          <div>
            <h2 id="setup-region" className="text-lg font-medium text-text-primary">
              {t('Region and language')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {t('Brazil is the default. Your state sets the time zone and the suggested map.')}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-text-primary">{t('State')}</span>
            <select
              className="nd-field mt-1.5"
              value={draft.state ?? ''}
              onChange={(e) => {
                const code = e.target.value || null
                const st = BRAZIL_STATES.find((s) => s.code === code)
                update({ state: code, ...(st ? { timezone: st.timezone } : {}) })
              }}
            >
              <option value="">{t('Not specified')}</option>
              {BRAZIL_REGIONS.map((r) => (
                <optgroup key={r.id} label={r.name}>
                  {BRAZIL_STATES.filter((s) => s.region === r.id).map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.uf})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-text-primary">{t('Time zone')}</span>
            <select
              className="nd-field mt-1.5"
              value={draft.timezone}
              onChange={(e) => update({ timezone: e.target.value })}
            >
              {!tzKnown && <option value={draft.timezone}>{draft.timezone}</option>}
              {BRAZIL_TIMEZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.offset} · {z.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-text-primary">{t('Environment')}</span>
            <select
              className="nd-field mt-1.5"
              value={draft.environment ?? ''}
              onChange={(e) =>
                update({ environment: (e.target.value || null) as SetupDraft['environment'] })
              }
            >
              <option value="">{t('Not specified')}</option>
              <option value="urbano">{t('Urban')}</option>
              <option value="rural">{t('Rural')}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-text-primary">{t('City or area')}</span>
            <input
              className="nd-field mt-1.5"
              maxLength={80}
              value={draft.place ?? ''}
              placeholder={t('e.g. Manaus')}
              onChange={(e) => update({ place: e.target.value || null })}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {t(
            'State, environment and city tailor the survival assistant to your region. They stay on this server.'
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5" aria-label={t('Regional formats')}>
          {[
            t('Português (Brasil)'),
            'pt_BR.UTF-8',
            t('Real (R$)'),
            'DD/MM/AAAA',
            t('24-hour clock'),
            t('Metric system'),
            '°C',
          ].map((f) => (
            <Badge key={f}>{f}</Badge>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-muted">
          {t(
            'The keyboard layout (ABNT2) belongs to the computer you use to open this page, not to the server.'
          )}
        </p>
      </section>

      {/* Modules */}
      <section aria-labelledby="setup-modules">
        <h2 id="setup-modules" className="nd-eyebrow !text-xs !text-text-secondary mb-4">
          {t('Modules')}
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {capabilities
            .filter((c) => c.available)
            .map((cap) => {
              const checked = cap.installed || cap.services.every((s) => draft.services.includes(s))
              return (
                <ChoiceCard
                  key={cap.id}
                  checked={checked}
                  locked={cap.installed}
                  onToggle={() => toggleCapability(cap)}
                  disabled={!online}
                >
                  <DynamicIcon icon={cap.icon} className="!size-6 text-text-primary" />
                  <h3 className="mt-4 pr-8 text-base font-medium text-text-primary">{cap.name}</h3>
                  <p className="text-xs text-text-muted">
                    {t('Powered by {{name}}', { name: cap.technicalName })}
                  </p>
                  {cap.installed && (
                    <Badge tone="ok" className="mt-2">
                      {t('Installed')}
                    </Badge>
                  )}
                  <p className="mt-3 text-sm text-text-secondary">{cap.description}</p>
                  <ul className="mt-3 space-y-1">
                    {cap.features.map((f) => (
                      <li key={f} className="flex gap-2 text-xs text-text-secondary">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-text-muted" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </ChoiceCard>
              )
            })}
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-[var(--radius-card)] border border-dashed border-border-default p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-secondary">
            {t('Notes, data tools and the full app catalog are in the Supply Depot.')}
          </p>
          <StyledButton variant="secondary" size="sm" onClick={() => router.visit('/supply-depot')}>
            {t('Open Supply Depot')}
          </StyledButton>
        </div>
      </section>

      {/* AI options */}
      {aiInSetup && (
        <section aria-labelledby="setup-ai" className="space-y-5">
          <h2 id="setup-ai" className="nd-eyebrow !text-xs !text-text-secondary">
            {t('Configure {{name}}', { name: aiName })}
          </h2>
          {!aiInstalled && (
            <div className="nd-card p-5">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={remoteOllama.enabled}
                  onChange={(e) =>
                    setRemoteOllama({ ...remoteOllama, enabled: e.target.checked, error: null })
                  }
                  className="size-4 accent-[var(--color-highlight)]"
                />
                <span className="text-sm text-text-primary">{t('Use remote Ollama instance')}</span>
              </label>
              {remoteOllama.enabled && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={remoteOllama.url}
                    onChange={(e) =>
                      setRemoteOllama({ ...remoteOllama, url: e.target.value, error: null })
                    }
                    placeholder="http://192.168.1.100:11434"
                    aria-label={t('Remote Ollama URL')}
                    className="nd-field"
                  />
                  {remoteOllama.error && (
                    <p className="mt-1 text-xs text-desert-red-dark">{remoteOllama.error}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {remoteOllama.enabled ? (
            <p className="text-sm text-text-muted">
              {t('Models are managed on the remote machine.')}
            </p>
          ) : modelsLoading ? (
            <LoadingSpinner />
          ) : models.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {models.map((m) => (
                <ChoiceCard
                  key={m.name}
                  checked={draft.aiModels.includes(m.name)}
                  disabled={!online}
                  onToggle={() =>
                    update({
                      aiModels: draft.aiModels.includes(m.name)
                        ? draft.aiModels.filter((x) => x !== m.name)
                        : [...draft.aiModels, m.name],
                    })
                  }
                  className="!p-4"
                >
                  <h3 className="pr-8 font-medium text-text-primary nd-mono text-sm">{m.name}</h3>
                  {m.description && (
                    <p className="mt-1 text-xs text-text-secondary line-clamp-2">{m.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.tags?.[0]?.size && <Badge>{m.tags[0].size}</Badge>}
                    {m.tags?.[0]?.input.toLowerCase().includes('image') && (
                      <Badge>{t('Supports images')}</Badge>
                    )}
                  </div>
                </ChoiceCard>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              {t('No recommended AI models available at this time.')}
            </p>
          )}

          <div className="nd-card p-5">
            <p className="text-sm font-medium text-text-primary">
              {t('Auto-index new content for {{name}}?', { name: aiName })}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {t('You can change this any time from the Knowledge Base panel inside AI Chat.')}
            </p>
            <SegmentedControl
              className="mt-3"
              size="sm"
              label={t('Auto-index policy')}
              value={draft.ingestPolicy}
              onChange={(v) => update({ ingestPolicy: v })}
              options={[
                { value: 'Manual', label: t('Ask me first') },
                { value: 'Always', label: t('Yes, always') },
              ]}
            />
          </div>
        </section>
      )}
    </div>
  )
}
