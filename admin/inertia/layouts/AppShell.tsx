import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { Link, usePage } from '@inertiajs/react'
import { useQuery } from '@tanstack/react-query'
import { IconMenu2, IconSearch } from '@tabler/icons-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ChatButton from '~/components/chat/ChatButton'
import IconButton from '~/components/nd/IconButton'
import BrandMark from '~/components/shell/BrandMark'
import CommandPalette from '~/components/shell/CommandPalette'
import Sidebar, { NavBadges } from '~/components/shell/Sidebar'
import ThemeToggle from '~/components/ThemeToggle'
import useCreatorPacks from '~/hooks/use_creator_packs'
import useInternetStatus from '~/hooks/use_internet_status'
import useServiceInstalledStatus from '~/hooks/useServiceInstalledStatus'
import { useSystemSetting } from '~/hooks/use_system_setting'
import { useUpdateAvailable } from '~/hooks/use_update_available'
import api from '~/lib/api'
import classNames from '~/lib/class_names'
import { activeNavId, buildNavigation } from '~/lib/nav_config'
import { getServiceLink } from '~/lib/navigation'
import { SERVICE_NAMES } from '../../constants/service_names'

// Heavy and rarely opened: loaded on first use so they stay out of every page's bundle
const ChatModal = lazy(() => import('~/components/chat/ChatModal'))
const DebugInfoModal = lazy(() => import('~/components/DebugInfoModal'))

type ShellPageProps = {
  appVersion: string
  aiAssistantName?: string
  features?: { drugReference?: boolean }
}

/**
 * The one frame around every screen: global navigation (sidebar on desktop, drawer on mobile), the
 * command palette and the floating assistant. `immersive` screens (map, chat, reader) get the icon
 * rail instead of the full sidebar and no top bar on mobile — they draw their own toolbar.
 */
export default function AppShell({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: 'default' | 'immersive'
}) {
  const { t } = useTranslation()
  const page = usePage<ShellPageProps>()
  const { appVersion, aiAssistantName, features } = page.props
  const path = page.url.split('?')[0]
  const immersive = variant === 'immersive'

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  // mount the lazy modals only after their first opening (then keep them for the close transition)
  const [chatLoaded, setChatLoaded] = useState(false)
  const [debugLoaded, setDebugLoaded] = useState(false)

  const ai = useServiceInstalledStatus(SERVICE_NAMES.OLLAMA)
  const { configured: creatorPacks } = useCreatorPacks()
  const { data: serviceLogsUrl } = useSystemSetting({ key: 'ui.serviceLogsUrl' })
  const updateInfo = useUpdateAvailable()
  const { isOnline } = useInternetStatus()

  // Shares the cache of useDownloads(); pages that show downloads poll faster on the same key.
  const { data: jobs } = useQuery({
    queryKey: ['download-jobs'],
    queryFn: () => api.listDownloadJobs(),
    refetchInterval: (q) => (q.state.data && q.state.data.length > 0 ? 4000 : 20000),
  })

  const groups = useMemo(
    () =>
      buildNavigation({
        aiInstalled: !!ai.isInstalled,
        aiName: aiAssistantName?.trim() ? t(aiAssistantName) : t('AI Assistant'),
        creatorPacks: !!creatorPacks,
        drugReference: !!features?.drugReference,
        serviceLogsHref: getServiceLink('9999', serviceLogsUrl?.value),
      }),
    [
      ai.isInstalled,
      aiAssistantName,
      creatorPacks,
      features?.drugReference,
      serviceLogsUrl?.value,
      t,
    ]
  )
  const activeId = activeNavId(groups, path)

  const badges: NavBadges = {
    update: !!updateInfo?.updateAvailable,
    downloads: (jobs ?? []).filter((j) => j.status !== 'failed').length,
    downloadsFailed: (jobs ?? []).filter((j) => j.status === 'failed').length,
  }

  // Ctrl/⌘ K anywhere; "/" when not typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close the mobile drawer after an Inertia navigation
  useEffect(() => setDrawerOpen(false), [path])

  const sidebarProps = {
    groups,
    activeId,
    badges,
    appVersion,
    isOnline,
    onOpenPalette: () => setPaletteOpen(true),
    onOpenDebug: () => {
      setDebugLoaded(true)
      setDebugOpen(true)
    },
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-contrast"
      >
        {t('Skip to content')}
      </a>

      {/* Desktop navigation */}
      <aside
        className={classNames(
          'hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex nd-glass',
          immersive ? 'lg:w-16' : 'lg:w-64'
        )}
      >
        <Sidebar {...sidebarProps} rail={immersive} />
      </aside>

      {/* Mobile top bar */}
      {!immersive && (
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border-subtle px-2 nd-glass lg:hidden">
          <IconButton label={t('Open menu')} onClick={() => setDrawerOpen(true)}>
            <IconMenu2 className="size-5" />
          </IconButton>
          <Link href="/home" className="flex-1 min-w-0" aria-label={t('Dashboard')}>
            <BrandMark />
          </Link>
          <IconButton label={t('Search the interface')} onClick={() => setPaletteOpen(true)}>
            <IconSearch className="size-5" />
          </IconButton>
          <ThemeToggle compact />
        </header>
      )}

      <Dialog open={drawerOpen} onClose={setDrawerOpen} className="relative z-[60] lg:hidden">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-scrim transition-opacity duration-[240ms] data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            className="flex h-full transition-transform duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] data-[closed]:-translate-x-full"
          >
            <Sidebar {...sidebarProps} onNavigate={() => setDrawerOpen(false)} />
          </DialogPanel>
        </div>
      </Dialog>

      <main
        id="main"
        tabIndex={-1}
        className={classNames(
          'min-h-screen focus:outline-none',
          immersive ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        {children}
      </main>

      {!immersive && ai.isInstalled && path !== '/chat' && (
        <>
          <ChatButton
            onClick={() => {
              setChatLoaded(true)
              setChatOpen(true)
            }}
          />
          {chatLoaded && (
            <Suspense fallback={null}>
              <ChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
            </Suspense>
          )}
        </>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} groups={groups} />
      {debugLoaded && (
        <Suspense fallback={null}>
          <DebugInfoModal open={debugOpen} onClose={() => setDebugOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
