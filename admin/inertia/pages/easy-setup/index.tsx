import { Head, router } from '@inertiajs/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MODEL_DOWNLOAD_SIZES } from '../../../app/utils/model_recommendation'
import { IconArrowLeft, IconArrowRight, IconPlayerPlay } from '@tabler/icons-react'
import AppLayout from '~/layouts/AppLayout'
import PageHeader from '~/components/nd/PageHeader'
import Alert from '~/components/Alert'
import StyledButton from '~/components/StyledButton'
import LoadingSpinner from '~/components/LoadingSpinner'
import SetupStepper from '~/components/setup/SetupStepper'
import SetupSummary, { type SummaryLine } from '~/components/setup/SetupSummary'
import StepResources, { type Capability } from '~/components/setup/StepResources'
import StepMaps, { type MapEstimate } from '~/components/setup/StepMaps'
import StepContent from '~/components/setup/StepContent'
import StepReview from '~/components/setup/StepReview'
import api from '~/lib/api'
import { formatBytes } from '~/lib/util'
import { useNotifications } from '~/context/notification_context'
import useInternetStatus from '~/hooks/use_internet_status'
import useCreatorPacks from '~/hooks/use_creator_packs'
import { useSystemInfo } from '~/hooks/use_system_info'
import { getPrimaryDiskInfo } from '~/hooks/use_disk_display_data'
import {
  contentPlan,
  mapCodes,
  mapLabel,
  mapSlug,
  parseDraft,
  DEFAULT_SURVIVAL_LIBRARY,
  survivalLibraryPlan,
  type SetupDraft,
} from '~/lib/setup_plan'
import { ServiceSlim } from '../../../types/services'
import { SERVICE_NAMES } from '../../../constants/service_names'
import { DEFAULT_TIMEZONE } from '../../../constants/brazil'
import { useAiAssistantName } from '~/hooks/use_ai_assistant_name'

/** Default map detail: neighbourhood level keeps "all of Brazil" a reasonable download. */
const DEFAULT_MAP_ZOOM = 13
const DRAFT_KEY = 'ui.easySetupDraft'

function freshDraft(
  installed: Set<string>,
  timezone?: string | null,
  state?: string | null
): SetupDraft {
  return {
    version: 1,
    step: 1,
    // the Information Library is what makes the content step useful: suggested unless installed
    services: installed.has(SERVICE_NAMES.KIWIX) ? [] : [SERVICE_NAMES.KIWIX],
    maps: { scope: 'country', regions: [], states: [], maxzoom: DEFAULT_MAP_ZOOM, collections: [] },
    categories: {},
    wikipedia: null,
    creatorPacks: [],
    aiModels: [],
    ingestPolicy: 'Manual',
    timezone: timezone || DEFAULT_TIMEZONE,
    state: state ?? null,
    survivalLibrary: DEFAULT_SURVIVAL_LIBRARY,
    environment: null,
    place: null,
  }
}

function parseModelSize(size?: string): number {
  const m = size?.match(/^([\d.]+)\s*(GB|MB|KB)?$/i)
  if (!m) return 0
  const v = Number.parseFloat(m[1])
  const unit = (m[2] || 'GB').toUpperCase()
  return unit === 'GB' ? v * 1024 ** 3 : unit === 'MB' ? v * 1024 ** 2 : v * 1024
}

export default function EasySetupWizard(props: {
  system: { services: ServiceSlim[]; remoteOllamaUrl: string }
}) {
  const { t } = useTranslation()
  const aiAssistantName = useAiAssistantName()
  const { addNotification } = useNotifications()
  const { isOnline } = useInternetStatus()
  const queryClient = useQueryClient()
  const { data: systemInfo } = useSystemInfo({ enabled: true })
  const { configured: creatorPacksConfigured, packs: creatorPacks } = useCreatorPacks()

  const installedServices = useMemo(
    () => new Set(props.system.services.filter((s) => s.installed).map((s) => s.service_name)),
    [props.system.services]
  )

  // ---- draft: restored from the server, saved while the user goes ----
  const [draft, setDraft] = useState<SetupDraft | null>(null)
  const [maxVisited, setMaxVisited] = useState(1)
  const [processing, setProcessing] = useState(false)
  const [remoteOllama, setRemoteOllama] = useState({
    enabled: !!props.system.remoteOllamaUrl,
    url: props.system.remoteOllamaUrl ?? '',
    error: null as string | null,
  })

  // Set when the wizard starts from a fresh draft, so the hardware recommendation is preselected once
  const freshRef = useRef(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [saved, tz, state] = await Promise.all([
        api.getSetting(DRAFT_KEY).catch(() => undefined),
        api.getSetting('regional.timezone').catch(() => undefined),
        api.getSetting('regional.state').catch(() => undefined),
      ])
      if (cancelled) return
      const restored = parseDraft(saved?.value)
      freshRef.current = !restored
      const next = restored ?? freshDraft(installedServices, tz?.value, state?.value)
      setDraft(next)
      setMaxVisited(next.step)
    })()
    return () => {
      cancelled = true
    }
  }, [installedServices])

  const update = useCallback((patch: Partial<SetupDraft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }, [])

  useEffect(() => {
    if (!draft || processing) return
    const id = window.setTimeout(() => {
      api.updateSetting(DRAFT_KEY, JSON.stringify(draft)).catch(() => {})
    }, 800)
    return () => window.clearTimeout(id)
  }, [draft, processing])

  // ---- data ----
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['curated-categories'],
    queryFn: async () => (await api.listCuratedCategories()) ?? [],
    refetchOnWindowFocus: false,
  })
  const { data: mapCollections = [] } = useQuery({
    queryKey: ['curated-map-collections'],
    queryFn: async () => (await api.listCuratedMapCollections()) ?? [],
    refetchOnWindowFocus: false,
  })
  const { data: wikipediaState } = useQuery({
    queryKey: ['wikipedia-state'],
    queryFn: () => api.getWikipediaState(),
    refetchOnWindowFocus: false,
  })
  // Hardware-based recommendation (models that fit this GPU and answer well in Portuguese)
  const { data: assistantStatus } = useQuery({
    queryKey: ['assistant-status'],
    queryFn: () => api.getAssistantStatus(),
    refetchOnWindowFocus: false,
  })
  const { data: library } = useQuery({
    queryKey: ['library'],
    queryFn: () => api.getLibrary(),
    refetchOnWindowFocus: false,
  })
  const { data: upstreamModels = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['recommended-ollama-models'],
    queryFn: async () => (await api.getAvailableModels({ recommendedOnly: true }))?.models ?? [],
    refetchOnWindowFocus: false,
  })
  const hardwarePlan = assistantStatus?.recommendation
  // The models measured for this hardware come first; the generic list follows
  const models = useMemo(() => {
    if (!hardwarePlan) return upstreamModels
    const own = [
      {
        name: hardwarePlan.chat,
        description: t('Recommended for this computer: chat, readers and the survival agent.'),
        tags: [{ size: MODEL_DOWNLOAD_SIZES[hardwarePlan.chat], input: 'Text, Image' }],
      },
      {
        name: hardwarePlan.embedding,
        description: t('Multilingual embeddings for searching the library in Portuguese.'),
        tags: [{ size: MODEL_DOWNLOAD_SIZES[hardwarePlan.embedding], input: 'Text' }],
      },
    ]
    return [...own, ...upstreamModels.filter((m) => !own.some((o) => o.name === m.name))]
  }, [hardwarePlan, upstreamModels, t])

  // A new draft starts with the hardware recommendation selected (models not installed yet)
  useEffect(() => {
    if (!draft || !hardwarePlan || !freshRef.current) return
    freshRef.current = false
    const installedModels = new Set(assistantStatus?.installedModels ?? [])
    const pick = [hardwarePlan.chat, hardwarePlan.embedding].filter((m) => !installedModels.has(m))
    if (pick.length && draft.aiModels.length === 0) update({ aiModels: pick })
  }, [draft, hardwarePlan, assistantStatus])

  const { data: regionFiles = [] } = useQuery({
    queryKey: ['map-region-files'],
    queryFn: async () => (await api.listMapRegionFiles()) ?? [],
    refetchOnWindowFocus: false,
  })
  const { data: jobs = [] } = useQuery({
    queryKey: ['download-jobs'],
    queryFn: async () => (await api.listDownloadJobs()) ?? [],
  })

  const refreshManifests = useMutation({
    mutationFn: () => api.refreshManifests(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curated-map-collections'] })
      queryClient.invalidateQueries({ queryKey: ['curated-categories'] })
    },
  })
  useEffect(() => {
    refreshManifests.mutate()
    api.updateSetting('ui.hasVisitedEasySetup', 'true').catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- capabilities ----
  const capabilities: Capability[] = useMemo(() => {
    const has = (s: string) => props.system.services.some((x) => x.service_name === s)
    const list: Omit<Capability, 'installed' | 'available'>[] = [
      {
        id: 'information',
        name: t('Information Library'),
        technicalName: 'Kiwix',
        description: t(
          'Offline access to Wikipedia, medical references, how-to guides, and encyclopedias'
        ),
        features: [
          t('Complete Wikipedia offline'),
          t('Medical references and first aid guides'),
          t('DIY repair guides and how-to content'),
        ],
        services: [SERVICE_NAMES.KIWIX],
        icon: 'IconBooks',
      },
      {
        id: 'education',
        name: t('Education Platform'),
        technicalName: 'Kolibri',
        description: t('Interactive learning platform with video courses and exercises'),
        features: [t('Interactive exercises and quizzes'), t('Progress tracking for learners')],
        services: [SERVICE_NAMES.KOLIBRI_GEN2],
        icon: 'IconSchool',
      },
      {
        id: 'ai',
        name: aiAssistantName,
        technicalName: 'Ollama',
        description: t('Local AI chat that runs entirely on your hardware - no internet required'),
        features: [
          t('Private conversations that never leave your device'),
          t('Runs on your own hardware with local AI models'),
        ],
        services: [SERVICE_NAMES.OLLAMA],
        icon: 'IconRobot',
      },
    ]
    return list.map((c) => ({
      ...c,
      installed: c.services.every((s) => installedServices.has(s)),
      available: c.services.some(has),
    }))
  }, [props.system.services, installedServices, aiAssistantName, t])

  const aiInstalled = installedServices.has(SERVICE_NAMES.OLLAMA)
  const aiInSetup =
    !!draft &&
    (draft.services.includes(SERVICE_NAMES.OLLAMA) || aiInstalled || remoteOllama.enabled)
  const kiwixReady =
    !!draft &&
    (draft.services.includes(SERVICE_NAMES.KIWIX) || installedServices.has(SERVICE_NAMES.KIWIX))

  const toggleCapability = (cap: Capability) => {
    if (!draft || cap.installed) return
    const selected = cap.services.every((s) => draft.services.includes(s))
    if (cap.id === 'ai' && selected) {
      const hasAi =
        draft.aiModels.length > 0 || draft.ingestPolicy !== 'Manual' || remoteOllama.enabled
      if (
        hasAi &&
        !window.confirm(
          t(
            'Turning off AI will discard your AI model picks, indexing policy, and remote Ollama configuration. Continue?'
          )
        )
      )
        return
      setRemoteOllama({ enabled: false, url: '', error: null })
      update({ aiModels: [], ingestPolicy: 'Manual' })
    }
    update({
      services: selected
        ? draft.services.filter((s) => !cap.services.includes(s))
        : [...new Set([...draft.services, ...cap.services])],
    })
  }

  // ---- maps: measured size for the exact selection ----
  const codes = draft ? mapCodes(draft.maps) : []
  const slug = draft ? mapSlug(draft.maps) : null
  const label = draft ? mapLabel(draft.maps) : ''
  const zoom = draft?.maps.maxzoom ?? DEFAULT_MAP_ZOOM
  const mapInstalled =
    !!slug &&
    regionFiles.some((f) => f.name.startsWith(`${slug}_`) && f.name.endsWith(`_z${zoom}.pmtiles`))
  const mapDownloading = jobs.some(
    (j) => j.filetype === 'map' && j.status !== 'failed' && j.title === label
  )
  const [estimate, setEstimate] = useState<{
    bytes: number | null
    loading: boolean
    error: string | null
  }>({
    bytes: null,
    loading: false,
    error: null,
  })
  const cache = useRef(new Map<string, number>())
  const [retryTick, setRetryTick] = useState(0)
  const estimateKey = codes.length ? `${codes.join(',')}|${zoom}` : ''

  useEffect(() => {
    if (!estimateKey || mapInstalled || mapDownloading || !isOnline) {
      setEstimate({ bytes: null, loading: false, error: null })
      return
    }
    const cached = cache.current.get(estimateKey)
    if (cached !== undefined) {
      setEstimate({ bytes: cached, loading: false, error: null })
      return
    }
    const controller = new AbortController()
    setEstimate({ bytes: null, loading: true, error: null })
    const id = window.setTimeout(async () => {
      try {
        const [countries, z] = estimateKey.split('|')
        const res = await api.extractMapPreflight(
          { countries: countries.split(','), maxzoom: Number(z) },
          controller.signal
        )
        cache.current.set(estimateKey, res.bytes)
        setEstimate({ bytes: res.bytes, loading: false, error: null })
      } catch (e) {
        if (controller.signal.aborted) return
        setEstimate({
          bytes: null,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }, 700)
    return () => {
      window.clearTimeout(id)
      controller.abort()
    }
  }, [estimateKey, mapInstalled, mapDownloading, isOnline, retryTick])

  const mapEstimate: MapEstimate = { ...estimate, retry: () => setRetryTick((n) => n + 1) }

  // ---- totals ----
  const installedIds = useMemo(
    () => new Set(categories.flatMap((c) => c.installedResourceIds ?? [])),
    [categories]
  )
  const downloadingIds = useMemo(
    () => new Set(categories.flatMap((c) => c.downloadingResourceIds ?? [])),
    [categories]
  )
  const plan = useMemo(
    () =>
      draft
        ? contentPlan(categories, kiwixReady ? draft.categories : {}, installedIds, downloadingIds)
        : { byCategory: [], skipped: 0, bytes: 0 },
    [draft, categories, installedIds, downloadingIds, kiwixReady]
  )
  const survivalPlan = useMemo(
    () => survivalLibraryPlan(library?.items ?? [], draft?.survivalLibrary ?? 'none'),
    [library, draft?.survivalLibrary]
  )
  const wikiOption =
    draft?.wikipedia && wikipediaState
      ? wikipediaState.options.find((o) => o.id === draft.wikipedia)
      : undefined
  const wikiChanged =
    !!wikiOption && draft?.wikipedia !== wikipediaState?.currentSelection?.optionId
  const wikiBytes = wikiChanged && wikiOption ? wikiOption.size_mb * 1024 * 1024 : 0
  const modelBytes = draft
    ? draft.aiModels.reduce(
        (s, name) => s + parseModelSize(models.find((m) => m.name === name)?.tags?.[0]?.size),
        0
      )
    : 0
  const packBytes = draft
    ? draft.creatorPacks.reduce(
        (s, id) => s + (creatorPacks.find((p) => p.id === id)?.size_mb ?? 0) * 1024 * 1024,
        0
      )
    : 0
  const collectionsBytes = draft
    ? draft.maps.collections.reduce((s, slugC) => {
        const c = mapCollections.find((x) => x.slug === slugC)
        return c && !c.all_installed
          ? s + c.resources.reduce((a, r) => a + r.size_mb * 1024 * 1024, 0)
          : s
      }, 0)
    : 0
  const wantsMap = codes.length > 0 && !mapInstalled && !mapDownloading
  const mapBytes = wantsMap ? (estimate.bytes ?? 0) : 0
  const total =
    plan.bytes +
    wikiBytes +
    modelBytes +
    packBytes +
    collectionsBytes +
    mapBytes +
    survivalPlan.bytes

  const disk = getPrimaryDiskInfo(systemInfo?.disk, systemInfo?.fsSize)
  const freeBytes = disk ? Math.max(0, disk.totalSize - disk.totalUsed) : null
  const tooBig = freeBytes !== null && total > freeBytes

  const newServices = draft
    ? draft.services.filter(
        (s) => !installedServices.has(s) && !(remoteOllama.enabled && s === SERVICE_NAMES.OLLAMA)
      )
    : []
  const serviceNames = newServices.map((s) =>
    t(props.system.services.find((x) => x.service_name === s)?.friendly_name || s)
  )
  const anything =
    newServices.length > 0 ||
    plan.byCategory.length > 0 ||
    wantsMap ||
    wikiChanged ||
    (draft?.maps.collections.length ?? 0) > 0 ||
    (draft?.creatorPacks.length ?? 0) > 0 ||
    (draft?.aiModels.length ?? 0) > 0 ||
    survivalPlan.queue.length > 0 ||
    remoteOllama.enabled

  const lines: SummaryLine[] = [
    { label: t('Apps'), bytes: null, detail: serviceNames.join(', ') || t('none') },
    {
      label: t('Maps'),
      bytes: codes.length ? (mapInstalled ? 0 : mapBytes + collectionsBytes) : collectionsBytes,
      pending: wantsMap && estimate.loading,
      detail: codes.length ? label : undefined,
    },
    { label: t('Content'), bytes: plan.bytes + wikiBytes + packBytes },
    ...(survivalPlan.queue.length
      ? [{ label: t('Survival library'), bytes: survivalPlan.bytes }]
      : []),
    ...(modelBytes ? [{ label: t('AI models'), bytes: modelBytes }] : []),
  ]

  // ---- navigation ----
  const step = draft?.step ?? 1
  const go = (n: number) => {
    if (!draft) return
    update({ step: n })
    setMaxVisited((m) => Math.max(m, n))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ---- install ----
  const start = async () => {
    if (!draft) return
    if (!isOnline) {
      addNotification({
        type: 'error',
        message: t('You must have an internet connection to complete the setup.'),
      })
      return
    }
    setProcessing(true)
    const failures: string[] = []
    const attempt = async (what: string, fn: () => Promise<unknown>) => {
      try {
        const res = await fn()
        if (res === undefined || (res as any)?.success === false) failures.push(what)
      } catch {
        failures.push(what)
      }
    }
    try {
      await Promise.all([
        api
          .updateSetting('regional.timezone', draft.timezone)
          .catch(() => failures.push(t('Time zone'))),
        api.updateSetting('regional.state', draft.state ?? '').catch(() => {}),
        aiInSetup
          ? api.updateSetting('rag.defaultIngestPolicy', draft.ingestPolicy).catch(() => {})
          : null,
      ])

      if (remoteOllama.enabled && remoteOllama.url) {
        const r = await api.configureRemoteOllama(remoteOllama.url)
        if (!r?.success) {
          setRemoteOllama({
            ...remoteOllama,
            error: (r as any)?.message || t('Failed to configure remote Ollama.'),
          })
          setProcessing(false)
          go(1)
          return
        }
      }

      await Promise.all(newServices.map((s) => attempt(s, () => api.installService(s))))

      await Promise.all([
        ...plan.byCategory.map((c) =>
          attempt(categories.find((x) => x.slug === c.slug)?.name ?? c.slug, () =>
            api.downloadCategoryTier(c.slug, c.tierSlug, c.resourceIds)
          )
        ),
        wantsMap
          ? attempt(label, () =>
              api.extractMapRegion({
                countries: codes,
                maxzoom: zoom,
                label,
                estimatedBytes: estimate.bytes ?? undefined,
              })
            )
          : null,
        ...draft.maps.collections.map((c) => attempt(c, () => api.downloadMapCollection(c))),
        ...draft.creatorPacks.map((id) => attempt(id, () => api.installCreatorPack(id))),
        ...draft.aiModels.map((m) => attempt(m, () => api.downloadModel(m))),
        ...survivalPlan.queue.map((w) =>
          attempt(w.title, () => api.downloadLibraryFile(w.id, 'pdf'))
        ),
      ])
      // Where the user is, for the survival agent (kept on this machine only)
      await Promise.all([
        api.updateSetting('regional.environment', draft.environment ?? '').catch(() => {}),
        api.updateSetting('regional.place', draft.place ?? '').catch(() => {}),
      ])

      if (wikiChanged && draft.wikipedia) {
        await attempt(t('Wikipedia'), () => api.selectWikipedia(draft.wikipedia!))
      }

      await api.updateSetting(DRAFT_KEY, '').catch(() => {})
      addNotification(
        failures.length
          ? {
              type: 'error',
              message: t(
                'Setup started, but these items failed: {{list}}. Try them again from the Downloads screen or this wizard.',
                {
                  list: failures.join(', '),
                }
              ),
              duration: 15000,
            }
          : {
              type: 'success',
              message: t('Setup wizard completed! Your selections are being processed.'),
            }
      )
      router.visit('/easy-setup/complete')
    } catch (error) {
      console.error('Error during setup:', error)
      addNotification({
        type: 'error',
        message: t('An error occurred during setup. Some items may not have been processed.'),
      })
    } finally {
      setProcessing(false)
    }
  }

  const nav = (
    <div className="flex flex-col gap-2">
      {step < 4 ? (
        <StyledButton onClick={() => go(step + 1)} disabled={!isOnline} fullWidth>
          <span className="inline-flex items-center gap-1.5">
            {t('Next')} <IconArrowRight size={16} />
          </span>
        </StyledButton>
      ) : (
        <StyledButton
          onClick={start}
          loading={processing}
          disabled={processing || !isOnline || !anything || tooBig}
          fullWidth
        >
          <span className="inline-flex items-center gap-1.5">
            <IconPlayerPlay size={16} /> {t('Start installation')}
          </span>
        </StyledButton>
      )}
      {step > 1 && (
        <StyledButton variant="ghost" onClick={() => go(step - 1)} disabled={processing} fullWidth>
          <span className="inline-flex items-center gap-1.5">
            <IconArrowLeft size={16} /> {t('Back')}
          </span>
        </StyledButton>
      )}
      <p className="text-center text-xs text-text-muted">
        {t('Your choices are saved; you can leave and come back.')}
      </p>
    </div>
  )

  return (
    <AppLayout>
      <Head title={t('Easy Setup Wizard')} />
      <div className="nd-page">
        <PageHeader
          eyebrow={t('Easy Setup')}
          title={t('Set up your server')}
          description={t(
            'Four steps: features, maps, content and review. Nothing is downloaded until you confirm.'
          )}
        />
        {!isOnline && (
          <Alert
            className="mb-6"
            type="warning"
            title={t('No Internet Connection')}
            message={t(
              "You'll need an internet connection to proceed. Please connect to the internet and try again."
            )}
          />
        )}
        {!draft ? (
          <LoadingSpinner />
        ) : (
          <>
            <SetupStepper step={step} maxVisited={maxVisited} onGo={go} />
            <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0 animate-nd-fade" key={step}>
                {step === 1 && (
                  <StepResources
                    draft={draft}
                    update={update}
                    capabilities={capabilities}
                    toggleCapability={toggleCapability}
                    aiName={aiAssistantName}
                    aiInSetup={aiInSetup}
                    aiInstalled={aiInstalled}
                    remoteOllama={remoteOllama}
                    setRemoteOllama={setRemoteOllama}
                    models={models}
                    modelsLoading={modelsLoading}
                    online={isOnline}
                  />
                )}
                {step === 2 && (
                  <StepMaps
                    draft={draft}
                    update={update}
                    estimate={mapEstimate}
                    installed={mapInstalled}
                    downloading={mapDownloading}
                    collections={mapCollections}
                    online={isOnline}
                  />
                )}
                {step === 3 && (
                  <StepContent
                    draft={draft}
                    update={update}
                    categories={categories}
                    categoriesLoading={categoriesLoading}
                    wikipediaState={wikipediaState}
                    creatorPacks={{ configured: !!creatorPacksConfigured, packs: creatorPacks }}
                    kiwixReady={kiwixReady}
                    survival={{ items: library?.items ?? [], plan: survivalPlan }}
                    enableKiwix={() =>
                      update({ services: [...new Set([...draft.services, SERVICE_NAMES.KIWIX])] })
                    }
                    online={isOnline}
                  />
                )}
                {step === 4 && (
                  <StepReview
                    draft={draft}
                    goTo={go}
                    serviceNames={serviceNames}
                    mapLabel={codes.length ? label : null}
                    mapBytes={estimate.bytes}
                    mapInstalled={mapInstalled || mapDownloading}
                    plan={plan}
                    categories={categories}
                    wikipediaLabel={wikiChanged ? (wikiOption?.name ?? null) : null}
                    wikipediaBytes={wikiBytes}
                    modelBytes={modelBytes}
                    packBytes={packBytes}
                    collectionsBytes={collectionsBytes}
                    survival={survivalPlan}
                  />
                )}
              </div>
              <div className="xl:sticky xl:top-6 xl:self-start">
                <SetupSummary
                  lines={lines}
                  totalBytes={total}
                  freeBytes={freeBytes}
                  diskBytes={disk?.totalSize ?? null}
                  measuring={wantsMap && estimate.loading}
                >
                  <div className="hidden xl:block">{nav}</div>
                </SetupSummary>
              </div>
            </div>
            {/* small screens: total and the next action stay at hand */}
            <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-border-subtle px-4 py-3 nd-glass sm:-mx-6 sm:px-6 xl:hidden">
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="text-text-secondary">{t('Total download')}</span>
                <span className="nd-mono text-text-primary">{formatBytes(total, 1)}</span>
              </div>
              {nav}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
