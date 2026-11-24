import { Link } from '@inertiajs/react'
import { IconBug, IconSearch } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import ThemeToggle from '~/components/ThemeToggle'
import LocaleToggle from '~/components/LocaleToggle'
import StatusDot from '~/components/nd/StatusDot'
import classNames from '~/lib/class_names'
import type { NavGroup, NavItem } from '~/lib/nav_config'
import BrandMark from './BrandMark'

export type NavBadges = { update: boolean; downloads: number; downloadsFailed: number }

function ItemBadge({ item, badges, rail }: { item: NavItem; badges: NavBadges; rail: boolean }) {
  const { t } = useTranslation()
  if (item.badge === 'update' && badges.update) {
    return rail ? (
      <StatusDot tone="warn" className="absolute top-2 right-2 size-1.5" />
    ) : (
      <span className="ml-auto nd-mono text-[10px] uppercase tracking-wider text-desert-orange-dark">
        {t('New')}
      </span>
    )
  }
  if (item.badge === 'downloads' && (badges.downloads > 0 || badges.downloadsFailed > 0)) {
    const tone = badges.downloadsFailed > 0 ? 'error' : 'live'
    return rail ? (
      <StatusDot tone={tone} className="absolute top-2 right-2 size-1.5" />
    ) : (
      <span className="ml-auto inline-flex items-center gap-1.5 nd-mono text-[11px] text-text-secondary">
        <StatusDot tone={tone} className="size-1.5" />
        {badges.downloads + badges.downloadsFailed}
      </span>
    )
  }
  return null
}

function NavLink({
  item,
  active,
  badges,
  rail,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  badges: NavBadges
  rail: boolean
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const label = item.literal ? item.label : t(item.label)
  const cls = classNames(
    'group relative flex items-center rounded-xl text-sm',
    'transition-[background-color,color] duration-[140ms] ease-[cubic-bezier(0.2,0,0,1)]',
    rail ? 'size-11 justify-center' : 'gap-3 px-3 py-2',
    active
      ? 'bg-surface-elevated text-text-primary'
      : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
  )
  const content = (
    <>
      {active && !rail && (
        <span
          className="absolute -left-3 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-highlight"
          aria-hidden="true"
        />
      )}
      <item.icon className="size-[18px] shrink-0" stroke={1.75} aria-hidden="true" />
      {rail ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
      <ItemBadge item={item} badges={badges} rail={rail} />
    </>
  )
  const common = {
    className: cls,
    title: rail ? label : undefined,
    'aria-current': active ? ('page' as const) : undefined,
    onClick: onNavigate,
  }
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" {...common}>
        {content}
      </a>
    )
  }
  if (item.hardLink) {
    return (
      <a href={item.href} {...common}>
        {content}
      </a>
    )
  }
  return (
    <Link href={item.href} {...common}>
      {content}
    </Link>
  )
}

/**
 * Global navigation. `rail` is the icon-only variant used next to immersive screens (map, chat,
 * reader), so they keep almost the whole width without losing the way around the app.
 */
export default function Sidebar({
  groups,
  activeId,
  badges,
  rail = false,
  appVersion,
  isOnline,
  onNavigate,
  onOpenPalette,
  onOpenDebug,
}: {
  groups: NavGroup[]
  activeId: string | null
  badges: NavBadges
  rail?: boolean
  appVersion: string
  isOnline: boolean
  onNavigate?: () => void
  onOpenPalette: () => void
  onOpenDebug: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className={classNames(
        'flex h-full flex-col bg-surface-primary/95 border-r border-border-subtle',
        rail ? 'w-16 items-center' : 'w-64'
      )}
    >
      <div className={classNames('flex h-16 shrink-0 items-center', rail ? 'justify-center' : 'px-5')}>
        <Link href="/home" aria-label={t('Dashboard')} onClick={onNavigate} className="rounded-lg">
          <BrandMark compact={rail} />
        </Link>
      </div>

      <div className={classNames('shrink-0', rail ? 'pb-2' : 'px-3 pb-3')}>
        <button
          type="button"
          onClick={onOpenPalette}
          className={classNames(
            'flex items-center rounded-xl border border-border-default text-text-muted cursor-pointer',
            'hover:border-text-muted hover:text-text-primary transition-colors duration-[140ms]',
            rail ? 'size-11 justify-center' : 'w-full gap-2 px-3 py-2 text-sm'
          )}
          aria-label={t('Search the interface')}
          title={rail ? t('Search the interface') : undefined}
        >
          <IconSearch className="size-4 shrink-0" />
          {!rail && (
            <>
              <span className="flex-1 text-left">{t('Search...')}</span>
              <kbd className="nd-kbd">Ctrl K</kbd>
            </>
          )}
        </button>
      </div>

      <nav
        aria-label={t('Main navigation')}
        className={classNames('flex-1 overflow-y-auto themed-scrollbar', rail ? 'px-2' : 'px-3')}
      >
        {groups.map((group, gi) => (
          <div key={group.id} className={gi > 0 ? (rail ? 'mt-3 pt-3 border-t border-border-subtle' : 'mt-5') : ''}>
            {group.label && !rail && (
              <p className="nd-eyebrow px-3 pb-1.5 !text-[10px]">{t(group.label)}</p>
            )}
            <ul role="list" className={classNames('space-y-0.5', rail && 'flex flex-col items-center')}>
              {group.items.map((item) => (
                <li key={item.id}>
                  <NavLink
                    item={item}
                    active={item.id === activeId}
                    badges={badges}
                    rail={rail}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={classNames(
          'shrink-0 border-t border-border-subtle',
          rail ? 'flex flex-col items-center gap-2 py-3' : 'px-5 py-4'
        )}
      >
        {rail ? (
          <>
            <StatusDot tone={isOnline ? 'ok' : 'warn'} label={isOnline ? t('Online') : t('Offline')} />
            <ThemeToggle compact />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 nd-mono text-[11px] text-text-secondary">
                <StatusDot tone={isOnline ? 'ok' : 'warn'} />
                {isOnline ? t('Online') : t('Offline')}
              </span>
              <span className="nd-mono text-[11px] text-text-muted">v{appVersion}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-1">
              <ThemeToggle compact />
              <LocaleToggle />
              <button
                type="button"
                onClick={() => {
                  onNavigate?.()
                  onOpenDebug()
                }}
                title={t('Debug Info')}
                aria-label={t('Debug Info')}
                className="inline-flex size-9 items-center justify-center rounded-full text-text-secondary hover:bg-surface-elevated hover:text-text-primary cursor-pointer"
              >
                <IconBug className="size-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
