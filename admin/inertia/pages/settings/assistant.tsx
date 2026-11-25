import { Head, Link } from '@inertiajs/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconCpu, IconWifiOff } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '~/components/Alert'
import StyledButton from '~/components/StyledButton'
import Badge from '~/components/nd/Badge'
import PageHeader from '~/components/nd/PageHeader'
import Section from '~/components/nd/Section'
import StatTile from '~/components/nd/StatTile'
import { useNotifications } from '~/context/notification_context'
import SettingsLayout from '~/layouts/SettingsLayout'
import api from '~/lib/api'
import { formatNumber } from '~/lib/format'
import { BRAZIL_REGIONS, BRAZIL_STATES } from '../../../constants/brazil'

const gib = (mib: number | null | undefined) =>
  mib === null || mib === undefined ? '—' : formatNumber(mib / 1024, { maximumFractionDigits: 1 })

/**
 * The local AI agent at a glance: that it runs offline, what the hardware is doing right now (GPU,
 * VRAM, RAM, loaded models, generation speed), which models fit this machine, how the knowledge base
 * is indexed, how translation is done and where the user is, for survival answers.
 */
export default function AssistantSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { addNotification } = useNotifications()

  const { data: status } = useQuery({
    queryKey: ['assistant-status'],
    queryFn: () => api.getAssistantStatus(),
    staleTime: 30_000,
  })
  const { data: perf } = useQuery({
    queryKey: ['assistant-performance'],
    queryFn: () => api.getAssistantPerformance(),
    refetchInterval: 2000,
  })

  const [region, setRegion] = useState({ state: '', environment: '', place: '' })
  useEffect(() => {
    if (!status) return
    setRegion({
      state: status.region.state ?? '',
      environment: status.region.environment ?? '',
      place: status.region.place ?? '',
    })
  }, [status])

  const saveRegion = useMutation({
    mutationFn: async () => {
      await api.updateSetting('regional.state', region.state)
      await api.updateSetting('regional.environment', region.environment)
      await api.updateSetting('regional.place', region.place.trim())
    },
    onSuccess: () => {
      addNotification({ type: 'success', message: t('Location saved.') })
      queryClient.invalidateQueries({ queryKey: ['assistant-status'] })
      queryClient.invalidateQueries({ queryKey: ['system-setting'] })
    },
  })
  const setBackend = useMutation({
    mutationFn: (value: string) => api.updateSetting('ai.amdBackend', value),
    onSuccess: () => {
      addNotification({
        type: 'success',
        message: t('Saved. It applies the next time the AI Assistant is reinstalled or updated.'),
      })
      queryClient.invalidateQueries({ queryKey: ['assistant-status'] })
    },
  })
  const download = useMutation({
    mutationFn: (model: string) => api.downloadModel(model),
    onSuccess: (res) =>
      addNotification({ type: res?.success ? 'success' : 'error', message: t(res?.message ?? '') }),
  })
  const migrate = useMutation({
    mutationFn: () => api.rebuildKnowledgeBase('embeddinggemma'),
    onSuccess: (res) => {
      addNotification({ type: res?.success ? 'success' : 'error', message: t(res?.message ?? '') })
      queryClient.invalidateQueries({ queryKey: ['assistant-status'] })
    },
  })

  const gpu = perf?.gpus.find((g) => g.vendorId === '1002') ?? perf?.gpus[0]
  const plan = status?.recommendation
  const installed = new Set(status?.installedModels ?? [])
  const wanted = plan ? [plan.chat, plan.tasks, plan.embedding].filter((m): m is string => !!m) : []

  return (
    <SettingsLayout>
      <Head title={t('Local assistant')} />
      <div className="w-full">
        <div className="nd-page space-y-10">
          <PageHeader
            eyebrow={t('AI')}
            title={t('Local assistant')}
            description={t(
              'Chat, reader help, translation and survival guidance that run entirely on this computer.'
            )}
          />

          <Alert
            type="info"
            title={t('100% offline after installation')}
            message={t(
              'Inference, embeddings, retrieval and translation use only local components. The internet is used only to download models and content. There are no live weather alerts, news or risk warnings.'
            )}
          />

          <Section
            id="performance"
            title={t('Performance now')}
            description={t('GPU and memory read every 2 seconds from the operating system.')}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label={t('GPU usage')}
                value={gpu?.busyPercent ?? '—'}
                unit="%"
                meter={
                  gpu?.busyPercent !== null && gpu?.busyPercent !== undefined
                    ? { value: gpu.busyPercent, label: t('GPU usage') }
                    : undefined
                }
                hint={
                  gpu
                    ? [
                        gpu.temperatureC !== null ? `${formatNumber(gpu.temperatureC)} °C` : null,
                        gpu.powerW !== null ? `${formatNumber(gpu.powerW)} W` : null,
                        gpu.shaderClockMHz !== null
                          ? `${formatNumber(gpu.shaderClockMHz)} MHz`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : t('No GPU counters')
                }
                loading={!perf}
              />
              <StatTile
                label={t('VRAM')}
                value={gib(gpu?.vramUsedMiB)}
                unit={`/ ${gib(gpu?.vramTotalMiB)} GB`}
                meter={
                  gpu?.vramUsedMiB && gpu?.vramTotalMiB
                    ? { value: (gpu.vramUsedMiB / gpu.vramTotalMiB) * 100, label: t('VRAM') }
                    : undefined
                }
                hint={
                  gpu?.gttUsedMiB
                    ? t('{{size}} GB in system memory (GTT)', { size: gib(gpu.gttUsedMiB) })
                    : undefined
                }
                loading={!perf}
              />
              <StatTile
                label={t('RAM')}
                value={gib(perf?.memory.usedMiB)}
                unit={`/ ${gib(perf?.memory.totalMiB)} GB`}
                meter={
                  perf
                    ? {
                        value: (perf.memory.usedMiB / perf.memory.totalMiB) * 100,
                        label: t('RAM'),
                      }
                    : undefined
                }
                loading={!perf}
              />
              <StatTile
                label={t('Generation speed')}
                value={perf?.models[0]?.avgGenTps ?? '—'}
                unit="tok/s"
                hint={
                  perf?.models[0]
                    ? t('{{model}}, average of the last {{count}} answers', {
                        model: perf.models[0].model,
                        count: perf.models[0].runs,
                      })
                    : t('No answers generated yet')
                }
                loading={!perf}
              />
            </div>
            <div className="mt-4">
              <p className="nd-eyebrow mb-2">{t('Loaded models')}</p>
              {perf && perf.loadedModels.length === 0 ? (
                <p className="text-sm text-text-muted">{t('No model loaded right now.')}</p>
              ) : (
                <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
                  {perf?.loadedModels.map((m) => {
                    const share =
                      m.sizeBytes > 0 ? Math.round((m.vramBytes / m.sizeBytes) * 100) : 0
                    return (
                      <li
                        key={m.name}
                        className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
                      >
                        <span className="nd-mono text-text-primary">{m.name}</span>
                        <Badge tone={share >= 100 ? 'ok' : 'warn'}>
                          {share >= 100 ? t('100% GPU') : t('{{share}}% GPU', { share })}
                        </Badge>
                        {m.contextLength && (
                          <span className="text-text-muted">
                            {t('context {{n}}', { n: formatNumber(m.contextLength) })}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </Section>

          <Section
            id="models"
            title={t('Models for this computer')}
            description={
              status
                ? t('Detected: {{vram}} GB of VRAM and {{ram}} GB of RAM.', {
                    vram: gib(status.hardware.vramMiB),
                    ram: gib(status.hardware.ramMiB),
                  })
                : undefined
            }
            action={{ label: t('All models'), href: '/settings/models' }}
          >
            {plan && (
              <div className="space-y-3">
                <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
                  {wanted.map((name) => (
                    <li
                      key={name}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="nd-mono text-sm text-text-primary">{name}</p>
                        <p className="text-xs text-text-muted">
                          {name === plan.embedding
                            ? t('Embeddings for the knowledge base (multilingual)')
                            : name === plan.tasks
                              ? t('Small model for auxiliary tasks')
                              : t('Chat, reader and survival agent')}
                        </p>
                      </div>
                      {installed.has(name) ||
                      (name === plan.embedding && status?.embedding?.model === name) ? (
                        <Badge tone="ok">{t('Installed')}</Badge>
                      ) : (
                        <StyledButton
                          size="sm"
                          variant="secondary"
                          loading={download.isPending && download.variables === name}
                          onClick={() => download.mutate(name)}
                        >
                          {t('Download')}
                        </StyledButton>
                      )}
                    </li>
                  ))}
                </ul>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {plan.notes.map((note) => (
                    <li key={note}>{t(note)}</li>
                  ))}
                  {!plan.measured && (
                    <li>
                      {t(
                        'Recommendation estimated from model sizes; not measured on this hardware.'
                      )}
                    </li>
                  )}
                </ul>
              </div>
            )}
            {status?.amdBackend && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle px-4 py-3">
                <IconCpu size={18} className="text-text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">
                    {t('AMD backend: {{backend}}', {
                      backend: status.amdBackend.backend === 'vulkan' ? 'Vulkan (RADV)' : 'ROCm',
                    })}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t(
                      'Automatic picks Vulkan on RDNA 4 (measured 25% faster generation and 2x faster embeddings on an RX 9060 XT) and ROCm on other AMD cards.'
                    )}
                  </p>
                </div>
                <label className="sr-only" htmlFor="amd-backend">
                  {t('AMD backend')}
                </label>
                <select
                  id="amd-backend"
                  className="nd-field !w-auto"
                  value={status.amdBackend.source === 'kv' ? status.amdBackend.backend : 'auto'}
                  onChange={(e) => setBackend.mutate(e.target.value)}
                >
                  <option value="auto">{t('Automatic')}</option>
                  <option value="vulkan">Vulkan</option>
                  <option value="rocm">ROCm</option>
                </select>
              </div>
            )}
          </Section>

          <Section
            id="knowledge"
            title={t('Knowledge base')}
            description={t('How the library is indexed for search (RAG).')}
            action={{ label: t('Knowledge Base'), href: '/chat?knowledge_base=true' }}
          >
            {status?.embedding && (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  {t('Embedding model: {{model}}', { model: status.embedding.model })}{' '}
                  <Badge tone={status.embedding.multilingual ? 'ok' : 'warn'}>
                    {status.embedding.multilingual ? t('multilingual') : t('English-centric')}
                  </Badge>
                </p>
                {status.embedding.migrationAvailable && (
                  <div className="space-y-3 rounded-xl border border-desert-orange-light bg-desert-orange-lighter px-4 py-3">
                    <p className="text-sm font-medium text-desert-orange-dark">
                      {t('Better search in Portuguese is available')}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {t(
                        'This index was built with nomic-embed-text, which finds the right passage for 61% of Portuguese questions in our test; EmbeddingGemma found it for 100%. Switching rebuilds the whole index, which takes a while on large libraries.'
                      )}
                    </p>
                    <StyledButton
                      size="sm"
                      loading={migrate.isPending}
                      onClick={() => {
                        if (window.confirm(t('Rebuild the whole knowledge-base index now?'))) {
                          migrate.mutate()
                        }
                      }}
                    >
                      {t('Rebuild with EmbeddingGemma')}
                    </StyledButton>
                  </div>
                )}
              </div>
            )}
            {status?.survival && (
              <p className="mt-3 text-sm text-text-secondary">
                {status.survival.works > 0
                  ? status.survival.works === 1
                    ? t('1 survival work indexed, edition of {{newest}}.', {
                        newest: status.survival.newest ?? '?',
                      })
                    : t(
                        '{{count}} survival works indexed, editions from {{oldest}} to {{newest}}.',
                        {
                          count: status.survival.works,
                          oldest: status.survival.oldest ?? '?',
                          newest: status.survival.newest ?? '?',
                        }
                      )
                  : t(
                      'No survival works indexed yet: install them in Library > Survival and Emergencies.'
                    )}{' '}
                <Link href="/library" className="underline underline-offset-4">
                  {t('Library')}
                </Link>
              </p>
            )}
          </Section>

          <Section
            id="translation"
            title={t('Translation')}
            description={t(
              'On demand, in the readers: a selection or the open page, never a whole book.'
            )}
          >
            <p className="text-sm text-text-secondary">
              {status && status.translation.bergamotPairs.length > 0
                ? t(
                    'Bergamot (Translated Library app) for {{pairs}}; other languages use the local model.',
                    { pairs: status.translation.bergamotPairs.join(', ') }
                  )
                : t(
                    'Translations use the local model. Install the Translated Library app for faster translation on the CPU.'
                  )}
            </p>
            {status && (
              <p className="mt-1 text-xs text-text-muted">
                {status.translation.cache.segments === 1
                  ? t('1 translated passage in the cache.')
                  : t('{{count}} translated passages in the cache.', {
                      count: formatNumber(status.translation.cache.segments),
                    })}
              </p>
            )}
          </Section>

          <Section
            id="region"
            title={t('Location for survival answers')}
            description={t(
              'Used only to tailor answers to your region. It stays on this computer and can be changed per conversation.'
            )}
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-sm">
                <span className="block text-text-secondary">{t('State')}</span>
                <select
                  className="nd-field"
                  value={region.state}
                  onChange={(e) => setRegion((r) => ({ ...r, state: e.target.value }))}
                >
                  <option value="">{t('State not informed')}</option>
                  {BRAZIL_REGIONS.map((reg) => (
                    <optgroup key={reg.id} label={reg.name}>
                      {BRAZIL_STATES.filter((s) => s.region === reg.id).map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-text-secondary">{t('Environment')}</span>
                <select
                  className="nd-field"
                  value={region.environment}
                  onChange={(e) => setRegion((r) => ({ ...r, environment: e.target.value }))}
                >
                  <option value="">{t('Not informed')}</option>
                  <option value="urbano">{t('Urban')}</option>
                  <option value="rural">{t('Rural')}</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-text-secondary">{t('City or area')}</span>
                <input
                  className="nd-field"
                  maxLength={80}
                  value={region.place}
                  onChange={(e) => setRegion((r) => ({ ...r, place: e.target.value }))}
                />
              </label>
              <StyledButton
                size="sm"
                loading={saveRegion.isPending}
                onClick={() => saveRegion.mutate()}
              >
                {t('Save')}
              </StyledButton>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
              <IconWifiOff size={14} aria-hidden="true" />
              {t('Country: Brazil. Other countries get general guidance without regional data.')}
            </p>
          </Section>
        </div>
      </div>
    </SettingsLayout>
  )
}
