import {
  IconArrowUpRight,
  IconBolt,
  IconBooks,
  IconExternalLink,
  IconFileText,
  IconFolder,
  IconMap,
  IconMessageCircle,
  IconPencil,
  IconPill,
  IconPlus,
  IconSettings,
  IconTrash,
  IconWifiOff,
  IconWorldDownload,
} from '@tabler/icons-react'
import { Head, Link, router } from '@inertiajs/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppLayout from '~/layouts/AppLayout'
import { getServiceLink } from '~/lib/navigation'
import { ServiceSlim } from '../../types/services'
import DynamicIcon, { DynamicIconName } from '~/components/DynamicIcon'
import { useUpdateAvailable } from '~/hooks/use_update_available'
import { useSystemSetting } from '~/hooks/use_system_setting'
import {
  useBenchmarkRerunBanner,
  BENCHMARK_RERUN_BANNER_QUERY_KEY,
} from '~/hooks/use_benchmark_rerun_banner'
import api from '~/lib/api'
import classNames from '~/lib/class_names'
import Alert from '~/components/Alert'
import WhatsNewBanner from '~/components/WhatsNewBanner'
import { SERVICE_NAMES } from '../../constants/service_names'
import LinkTileModal from '~/components/LinkTileModal'
import { linkTileColor } from '../../constants/link_tile_colors'
import Section from '~/components/nd/Section'
import StatusDot, { StatusTone } from '~/components/nd/StatusDot'
import Badge from '~/components/nd/Badge'
import SystemStatusRow from '~/components/dashboard/SystemStatusRow'
import DownloadsActivity from '~/components/dashboard/DownloadsActivity'
import ModuleCard from '~/components/dashboard/ModuleCard'
import DashboardClock from '~/components/dashboard/DashboardClock'
import useServiceInstalledStatus from '~/hooks/useServiceInstalledStatus'
import { useAiAssistantName } from '~/hooks/use_ai_assistant_name'

/** Container state of a managed app, as reported by Docker (SystemService.getServices). */
function serviceState(status: string | undefined): { tone: StatusTone; label: string } {
  switch (status) {
    case 'running':
      return { tone: 'ok', label: 'Running' }
    case 'restarting':
      return { tone: 'warn', label: 'Restarting' }
    case 'exited':
    case 'created':
    case 'paused':
    case 'dead':
      return { tone: 'idle', label: 'Stopped' }
    default:
      return { tone: 'neutral', label: 'Unknown' }
  }
}

type AppEntry = {
  key: string
  label: string
  href: string
  description: string
  icon: React.ReactNode
  displayOrder: number
  poweredBy: string | null
  status?: string
  /** Set only for user-added link tiles, which render differently and can be edited. */
  linkTile?: ServiceSlim
}

export default function Home(props: {
  system: {
    services: ServiceSlim[]
  }
  // Server-computed: true when the offline FDA drug dataset is installed or
  // installing (curated Medicine tier). Gates the medical-reference module.
  drugReferenceInstalled: boolean
}) {
  const { t } = useTranslation()
  const updateInfo = useUpdateAvailable()
  const rerunBanner = useBenchmarkRerunBanner()
  const queryClient = useQueryClient()
  const aiAssistantName = useAiAssistantName()
  const ai = useServiceInstalledStatus(SERVICE_NAMES.OLLAMA)

  // Link tile management. `editingTile` null with the modal open means "create".
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [editingTile, setEditingTile] = useState<ServiceSlim | null>(null)
  // Deleting a tile is not undoable and the tiles are user-entered, so the trash
  // icon arms a confirm rather than deleting on the first click.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)

  const { data: library } = useQuery({ queryKey: ['library'], queryFn: () => api.getLibrary() })
  const libraryCount = library?.items.length ?? 0
  const libraryInstalled = (library?.items ?? []).filter((i) =>
    i.files.some((f) => f.status === 'installed' || f.status === 'update_available')
  ).length

  const refreshServices = () => router.reload({ only: ['system'] })

  const handleDeleteTile = async (serviceName: string) => {
    let result: Awaited<ReturnType<typeof api.deleteLinkTile>> | undefined
    try {
      result = await api.deleteLinkTile(serviceName)
    } catch {
      result = undefined
    }
    setPendingDelete(null)
    if (!result?.success) {
      setLinkError(t('Failed to remove this link.'))
      return
    }
    refreshServices()
  }

  const handleDismissRerunBanner = async () => {
    await api.updateSetting('benchmark.rerunBannerDismissed', true)
    queryClient.invalidateQueries({ queryKey: BENCHMARK_RERUN_BANNER_QUERY_KEY })
  }

  // Easy Setup gets a "start here" marker until the wizard has been visited once
  const { data: easySetupVisited } = useSystemSetting({ key: 'ui.hasVisitedEasySetup' })
  const shouldHighlightEasySetup = easySetupVisited?.value
    ? String(easySetupVisited.value) !== 'true'
    : false

  // Managed apps (non-dependency services with a UI) and user link tiles, in display order.
  const apps = useMemo<AppEntry[]>(() => {
    const list: AppEntry[] = []
    props.system.services
      .filter(
        (service) =>
          service.installed && (service.ui_location || service.custom_url) && !service.is_link_tile
      )
      .forEach((service) => {
        list.push({
          key: service.service_name,
          label:
            service.service_name === SERVICE_NAMES.OLLAMA && aiAssistantName
              ? aiAssistantName
              : t(service.friendly_name || service.service_name),
          href: getServiceLink(service.ui_location || '', service.custom_url),
          description:
            service.description ||
            t('Access the {{name}} application', {
              name: service.friendly_name || service.service_name,
            }),
          icon: service.icon ? (
            <DynamicIcon icon={service.icon as DynamicIconName} className="!size-5" />
          ) : (
            <IconWifiOff size={20} />
          ),
          displayOrder: service.display_order ?? 100,
          poweredBy: service.powered_by ?? null,
          status: service.status,
        })
      })
    props.system.services
      .filter((service) => service.is_link_tile && service.custom_url)
      .forEach((service) => {
        list.push({
          key: service.service_name,
          label: t(service.friendly_name || service.service_name),
          href: getServiceLink('', service.custom_url),
          description: service.description || t('Opens in a new tab'),
          icon: <DynamicIcon icon={service.icon as DynamicIconName} className="!size-5" />,
          displayOrder: service.display_order ?? 90,
          poweredBy: null,
          linkTile: service,
        })
      })
    return list.sort((a, b) => a.displayOrder - b.displayOrder)
  }, [props.system.services, aiAssistantName, t])

  const managedApps = apps.filter((a) => !a.linkTile)
  const runningApps = managedApps.filter((a) => a.status === 'running').length

  const statusLine =
    managedApps.length === 0
      ? t('No apps installed yet. Start with Easy Setup or the Supply Depot.')
      : runningApps === managedApps.length
        ? t('All {{count}} apps are running.', { count: managedApps.length })
        : t('{{running}} of {{count}} apps are running.', {
            running: runningApps,
            count: managedApps.length,
          })

  return (
    <AppLayout>
      <Head title={t('Command Center')} />
      <div className="nd-page space-y-10">
        {/* 1 · Where am I, what time is it, is everything fine */}
        <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between animate-nd-rise">
          <div className="min-w-0">
            <p className="nd-eyebrow mb-3 flex items-center gap-2">
              <span className="nd-led text-led" aria-hidden="true" />
              {t('Command Center')}
            </p>
            <h1 className="text-3xl sm:text-4xl font-medium text-text-primary leading-tight">
              {t('Your offline server')}
            </h1>
            <p className="mt-2 text-base text-text-secondary">{statusLine}</p>
          </div>
          <DashboardClock />
        </header>

        {/* Notices: only what needs attention, most important first */}
        {(updateInfo?.updateAvailable || rerunBanner?.show || linkError) && (
          <div className="space-y-3">
            {updateInfo?.updateAvailable && (
              <Alert
                title={t('An update is available for monolith-nomad!')}
                type="info-inverted"
                variant="solid"
                buttonProps={{
                  variant: 'primary',
                  children: t('Go to Settings'),
                  icon: 'IconSettings',
                  onClick: () => router.visit('/settings/update'),
                }}
              />
            )}
            {rerunBanner?.show && (
              <Alert
                title={t('Your benchmark can be re-scored with Score v2')}
                message={t(
                  "We've upgraded the benchmark scoring system. Re-run your benchmark to get an updated Score v2 result on the community leaderboard."
                )}
                type="info-inverted"
                variant="solid"
                dismissible
                onDismiss={handleDismissRerunBanner}
                buttonProps={{
                  variant: 'primary',
                  children: t('Re-run benchmark'),
                  icon: 'IconRefresh',
                  onClick: () => router.visit('/settings/benchmark'),
                }}
              />
            )}
            {linkError && (
              <Alert
                title={linkError}
                type="error"
                dismissible
                onDismiss={() => setLinkError(null)}
              />
            )}
          </div>
        )}
        <WhatsNewBanner />

        {/* 2 · System status */}
        <Section
          id="status"
          title={t('System status')}
          action={{ label: t('Details'), href: '/settings/system' }}
        >
          <SystemStatusRow />
          <div className="mt-3">
            <DownloadsActivity />
          </div>
        </Section>

        {/* 3 · Knowledge: what the server offers to read and consult */}
        <Section id="knowledge" title={t('Knowledge')}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ModuleCard
              href="/library"
              icon={<IconBooks />}
              title={t('Library')}
              description={t('Books and manuals in Portuguese to download and read offline')}
              meta={
                library
                  ? t('{{count}} works · {{installed}} downloaded', {
                      count: libraryCount,
                      installed: libraryInstalled,
                    })
                  : undefined
              }
            />
            <ModuleCard
              href="/maps"
              icon={<IconMap />}
              title={t('Maps')}
              description={t('View offline maps')}
            />
            {props.drugReferenceInstalled && (
              <ModuleCard
                href="/drug-reference"
                icon={<IconPill />}
                title={t('Drug Reference')}
                description={t('Offline FDA drug labels. Search by drug name or by symptom')}
              />
            )}
            {ai.isInstalled && (
              <ModuleCard
                href="/chat"
                icon={<IconMessageCircle />}
                title={aiAssistantName}
                description={t('Ask questions about your offline content')}
              />
            )}
            <ModuleCard
              href="/docs/home"
              icon={<IconFileText />}
              title={t('Docs')}
              description={t('Read monolith-nomad manuals and guides')}
            />
          </div>
        </Section>

        {/* 4 · Apps and shortcuts */}
        <Section
          id="apps"
          title={t('Apps')}
          count={managedApps.length}
          action={{ label: t('Supply Depot'), href: '/supply-depot' }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {apps.map((app) => {
              if (app.linkTile) {
                const tile = app.linkTile
                const color = linkTileColor(tile.link_color)
                const confirming = pendingDelete === tile.service_name
                return (
                  <div key={app.key} className="group relative">
                    <a
                      href={app.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={classNames(
                        'flex h-full items-center gap-4 rounded-[var(--radius-card)] border border-dashed p-4 pr-20 transition-colors duration-[140ms] hover:bg-surface-secondary',
                        color.border,
                        color.bg
                      )}
                      title={t('A shortcut you added. monolith-nomad does not manage this.')}
                    >
                      <span
                        className={classNames(
                          'flex size-10 shrink-0 items-center justify-center rounded-full border border-border-default',
                          color.marker
                        )}
                      >
                        {app.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium text-text-primary truncate">
                          {app.label}
                          <IconExternalLink size={13} className="text-text-muted shrink-0" />
                        </span>
                        <span className="block text-xs text-text-muted truncate">
                          {app.description}
                        </span>
                      </span>
                    </a>
                    {confirming ? (
                      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteTile(tile.service_name)}
                          className="rounded-full bg-desert-red px-3 py-1 text-xs font-medium text-white hover:bg-desert-red-hover cursor-pointer"
                        >
                          {t('Remove')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(null)}
                          className="rounded-full border border-border-default bg-surface-primary px-3 py-1 text-xs text-text-secondary hover:text-text-primary cursor-pointer"
                        >
                          {t('Cancel')}
                        </button>
                      </div>
                    ) : (
                      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-100 sm:opacity-0 transition-opacity duration-[140ms] group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTile(tile)
                            setLinkModalOpen(true)
                          }}
                          title={t('Edit this link')}
                          aria-label={t('Edit this link')}
                          className="rounded-full p-1.5 text-text-muted hover:bg-surface-elevated hover:text-text-primary cursor-pointer"
                        >
                          <IconPencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(tile.service_name)}
                          title={t('Remove this link')}
                          aria-label={t('Remove this link')}
                          className="rounded-full p-1.5 text-text-muted hover:bg-surface-elevated hover:text-desert-red cursor-pointer"
                        >
                          <IconTrash size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              }
              const state = serviceState(app.status)
              return (
                <a
                  key={app.key}
                  href={app.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nd-card nd-card-interactive group flex items-center gap-4 p-4"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-text-primary">
                    {app.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-text-primary truncate">
                      {app.label}
                    </span>
                    <span className="block text-xs text-text-muted truncate">
                      {app.poweredBy
                        ? t('Powered by {{name}}', { name: app.poweredBy })
                        : app.description}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 nd-mono text-[10px] uppercase tracking-wider text-text-muted">
                    <StatusDot tone={state.tone} />
                    <span className="hidden sm:inline">{t(state.label)}</span>
                  </span>
                  <IconArrowUpRight
                    size={16}
                    className="shrink-0 text-text-muted group-hover:text-text-primary"
                    aria-hidden="true"
                  />
                </a>
              )
            })}

            {/* Add-a-link affordance, last in the grid so it never displaces an app. */}
            <button
              type="button"
              onClick={() => {
                setEditingTile(null)
                setLinkModalOpen(true)
              }}
              className="flex items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-border-default p-4 text-left text-text-muted transition-colors duration-[140ms] hover:border-text-muted hover:text-text-primary cursor-pointer"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-current">
                <IconPlus size={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{t('Add a Link')}</span>
                <span className="block text-xs">
                  {t('A shortcut to something else on your network')}
                </span>
              </span>
            </button>
          </div>
        </Section>

        {/* 5 · Get more content and configure */}
        <Section id="tools" title={t('Tools')}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: '/easy-setup',
                icon: <IconBolt size={18} />,
                title: t('Easy Setup'),
                text: t(
                  'Not sure where to start? Use the setup wizard to quickly configure monolith-nomad!'
                ),
                highlight: shouldHighlightEasySetup,
              },
              {
                href: '/settings/zim/remote-explorer',
                icon: <IconWorldDownload size={18} />,
                title: t('Content Explorer'),
                text: t('Browse and download content for offline reading!'),
              },
              {
                href: '/settings/zim',
                icon: <IconFolder size={18} />,
                title: t('Content Manager'),
                text: t('Manage your stored content files.'),
              },
              {
                href: '/settings/system',
                icon: <IconSettings size={18} />,
                title: t('Settings'),
                text: t('Configure monolith-nomad settings'),
              },
            ].map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className={classNames(
                  'nd-card nd-card-interactive flex gap-3 p-4',
                  tool.highlight && '!border-highlight'
                )}
              >
                <span className="mt-0.5 text-text-secondary">{tool.icon}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-medium text-text-primary">
                    {tool.title}
                    {tool.highlight && <Badge tone="highlight">{t('Start here!')}</Badge>}
                  </span>
                  <span className="mt-0.5 block text-xs text-text-muted line-clamp-2">
                    {tool.text}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      </div>

      <LinkTileModal
        open={linkModalOpen}
        tile={editingTile}
        onClose={() => setLinkModalOpen(false)}
        onSaved={() => {
          setLinkModalOpen(false)
          refreshServices()
        }}
        showError={(msg) => setLinkError(msg)}
      />
    </AppLayout>
  )
}
