import { Head, Link, usePage } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  IconAdjustmentsHorizontal,
  IconBook2,
  IconBooks,
  IconCloudOff,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { AxiosError } from 'axios'
import AppLayout from '~/layouts/AppLayout'
import DynamicIcon, { DynamicIconName } from '~/components/DynamicIcon'
import PageHeader from '~/components/nd/PageHeader'
import Section from '~/components/nd/Section'
import SegmentedControl from '~/components/nd/SegmentedControl'
import EmptyState from '~/components/nd/EmptyState'
import Drawer from '~/components/nd/Drawer'
import StyledButton from '~/components/StyledButton'
import WorkCard from '~/components/library/WorkCard'
import WorkDetails from '~/components/library/WorkDetails'
import LibraryFilterPanel from '~/components/library/LibraryFilterPanel'
import { LEVEL_LABEL } from '~/components/library/LevelDots'
import { useNotifications } from '~/context/notification_context'
import { getServiceLink } from '~/lib/navigation'
import { formatBytes } from '~/lib/util'
import api from '~/lib/api'
import {
  EMPTY_FILTERS,
  RECENT_KEY,
  activeFilterCount,
  facetCounts,
  fileSize,
  filterItems,
  filtersFromSearch,
  filtersToSearch,
  isInstalled,
  languageLabel,
  type LibraryFilters,
  type LibrarySort,
  type LibraryStatusFilter,
  type RecentDocument,
} from '~/lib/library_filters'
import { SERVICE_NAMES } from '../../../constants/service_names'
import type { LibraryFileWithStatus, LibraryItemWithStatus } from '../../../types/library'

function readRecent(): RecentDocument[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function LibraryPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { addNotification } = useNotifications()
  const [filters, setFilters] = useState<LibraryFilters>(() =>
    typeof window === 'undefined' ? EMPTY_FILTERS : filtersFromSearch(window.location.search)
  )
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [recent] = useState<RecentDocument[]>(readRecent)

  const patch = (p: Partial<LibraryFilters>) => setFilters((f) => ({ ...f, ...p }))

  // An Inertia visit to /library?q=… while already here (e.g. from the command palette) keeps this
  // component mounted: take the filters from the new URL.
  const { url: pageUrl } = usePage()
  useEffect(() => {
    const search = pageUrl.includes('?') ? pageUrl.slice(pageUrl.indexOf('?')) : ''
    setFilters(filtersFromSearch(search))
  }, [pageUrl])

  // Keep the URL in sync (bookmarkable, survives the round trip to the reader); debounced, since
  // browsers throttle history.replaceState and typing fires it on every key.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = `${window.location.pathname}${filtersToSearch(filters)}`
      if (next === `${window.location.pathname}${window.location.search}`) return
      try {
        window.history.replaceState(window.history.state, '', next)
      } catch {}
    }, 300)
    return () => window.clearTimeout(id)
  }, [filters])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['library'],
    queryFn: () => api.getLibrary(),
    refetchInterval: (query) =>
      query.state.data?.items.some((i) => i.files.some((f) => f.status === 'downloading'))
        ? 3000
        : false,
  })
  const { data: services } = useQuery({
    queryKey: ['system-services'],
    queryFn: () => api.getSystemServices(),
  })
  const kiwix = services?.find((s) => s.service_name === SERVICE_NAMES.KIWIX && s.installed)
  const kiwixUrl = kiwix ? getServiceLink(kiwix.ui_location ?? '', kiwix.custom_url) : null

  const items = useMemo(() => data?.items ?? [], [data])
  const areaList = useMemo(() => data?.areas ?? [], [data])
  const areas = useMemo(() => new Map(areaList.map((a) => [a.slug, a])), [areaList])
  const filtered = useMemo(() => filterItems(items, filters), [items, filters])
  const counts = useMemo(() => facetCounts(items, filters), [items, filters])
  const selected = items.find((i) => i.id === selectedId) ?? null

  const shelf = items.filter((i) => i.files.some(isInstalled))
  const shelfBytes = items
    .flatMap((i) => i.files)
    .filter(isInstalled)
    .reduce((sum, f) => sum + (fileSize(f) ?? 0), 0)

  // Recently opened documents that are still installed
  const installedFiles = new Set(
    items.flatMap((i) => i.files.filter(isInstalled).map((f) => f.filename))
  )
  const continueReading = recent.filter((r) => installedFiles.has(r.filename)).slice(0, 4)

  const nFilters = activeFilterCount(filters)
  const grouped =
    !filters.area && !filters.subject && !filters.q.trim() && filters.sort === 'catalog'

  const sections = useMemo(() => {
    if (!grouped) return []
    const known = new Set(areaList.map((a) => a.slug))
    const groups = new Map<string, LibraryItemWithStatus[]>()
    for (const item of filtered) {
      // a work whose first area is missing from the manifest still gets listed (under "other")
      const key = item.areas.find((a) => known.has(a)) ?? 'other'
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return [...areaList.map((a) => a.slug), 'other']
      .filter((slug) => groups.has(slug))
      .map((slug) => ({ slug, items: groups.get(slug)! }))
  }, [grouped, filtered, areaList])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['library'] })

  const serverError = (error: unknown) =>
    (error instanceof AxiosError &&
      (error.response?.data?.error || error.response?.data?.message)) ||
    (error instanceof Error ? error.message : String(error))

  const handleDownload = async (item: LibraryItemWithStatus, file: LibraryFileWithStatus) => {
    setBusyKey(`${item.id}:${file.format}`)
    try {
      const res = await api.downloadLibraryFile(item.id, file.format)
      addNotification({ type: res.queued ? 'success' : 'info', message: res.message })
    } catch (error) {
      addNotification({ type: 'error', message: serverError(error) })
    } finally {
      setBusyKey(null)
      refresh()
    }
  }

  const handleRemove = async (item: LibraryItemWithStatus, file: LibraryFileWithStatus) => {
    if (file.format === 'zim') return
    setBusyKey(`${item.id}:${file.format}`)
    try {
      await api.removeLibraryFile(item.id, file.format)
      addNotification({
        type: 'success',
        message: t('Removed the {{format}} of "{{title}}".', {
          format: file.format.toUpperCase(),
          title: item.title,
        }),
      })
    } catch (error) {
      addNotification({ type: 'error', message: serverError(error) })
    } finally {
      setBusyKey(null)
      refresh()
    }
  }

  const statusOptions: { value: LibraryStatusFilter; label: string; count?: number }[] = [
    { value: 'all', label: t('All'), count: counts.status.get('all') },
    { value: 'offline', label: t('On your shelf'), count: counts.status.get('offline') ?? 0 },
    { value: 'available', label: t('To download'), count: counts.status.get('available') ?? 0 },
    ...((counts.status.get('downloading') ?? 0) > 0 || filters.status === 'downloading'
      ? [
          {
            value: 'downloading' as const,
            label: t('Downloading'),
            count: counts.status.get('downloading') ?? 0,
          },
        ]
      : []),
  ]

  const activeChips: { key: string; label: string; clear: Partial<LibraryFilters> }[] = [
    ...(filters.area
      ? [
          {
            key: 'area',
            label: areas.get(filters.area)?.name ?? filters.area,
            clear: { area: null, subject: null },
          },
        ]
      : []),
    ...(filters.subject
      ? [{ key: 'subject', label: filters.subject, clear: { subject: null } }]
      : []),
    ...(filters.level
      ? [{ key: 'level', label: t(LEVEL_LABEL[filters.level]), clear: { level: null } }]
      : []),
    ...(filters.format
      ? [{ key: 'format', label: filters.format.toUpperCase(), clear: { format: null } }]
      : []),
    ...(filters.lang
      ? [{ key: 'lang', label: t(languageLabel(filters.lang)), clear: { lang: null } }]
      : []),
  ]

  const renderGrid = (list: LibraryItemWithStatus[]) => (
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {list.map((item) => (
        <WorkCard
          key={item.id}
          item={item}
          areas={areas}
          kiwixUrl={kiwixUrl}
          busy={busyKey?.startsWith(`${item.id}:`) ?? false}
          onOpen={() => setSelectedId(item.id)}
          onDownload={(file) => handleDownload(item, file)}
        />
      ))}
    </div>
  )

  const filterPanel = (
    <LibraryFilterPanel areas={areaList} counts={counts} filters={filters} onChange={patch} />
  )

  return (
    <AppLayout>
      <Head title={t('Library')} />
      <div className="nd-page">
        <PageHeader
          eyebrow={t('Knowledge')}
          title={t('Library')}
          description={t(
            'Books, manuals and offline reference works in Portuguese, from official sources and with open licenses. Download what you need and read it here, without internet.'
          )}
        />

        {/* Shelf summary */}
        <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t('Works'), value: data ? items.length : '—' },
            { label: t('On your shelf'), value: data ? shelf.length : '—' },
            { label: t('Space used'), value: data ? formatBytes(shelfBytes, 1) : '—' },
            { label: t('Areas'), value: data ? areaList.length : '—' },
          ].map((s) => (
            <div key={s.label} className="nd-card px-5 py-4">
              <dt className="nd-eyebrow !text-[10px]">{s.label}</dt>
              <dd className="mt-2 nd-display text-3xl text-text-primary">{s.value}</dd>
            </div>
          ))}
        </dl>

        {continueReading.length > 0 && nFilters === 0 && !filters.q && (
          <Section id="continue" title={t('Continue reading')} className="mb-10">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {continueReading.map((r) => (
                <Link
                  key={r.filename}
                  href={`/library/read/${r.filename}`}
                  className="nd-card nd-card-interactive flex items-center gap-3 p-4"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-elevated">
                    <IconBook2 size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-text-primary">
                      {r.title}
                    </span>
                    <span className="nd-eyebrow !text-[10px]">{r.format}</span>
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* Toolbar: search, availability, sort */}
        <div className="sticky top-14 lg:top-0 z-20 -mx-4 mb-6 border-b border-border-subtle px-4 py-3 nd-glass sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative flex-1">
              <span className="sr-only">{t('Search the library')}</span>
              <IconSearch
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="search"
                value={filters.q}
                onChange={(e) => patch({ q: e.target.value })}
                placeholder={t('Search by title, author or subject')}
                className="nd-field !pl-10"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                label={t('Offline availability')}
                options={statusOptions}
                value={filters.status}
                onChange={(status) => patch({ status })}
                size="sm"
                className="overflow-x-auto max-w-full"
              />
              <label className="flex items-center gap-2">
                <span className="sr-only">{t('Sort by')}</span>
                <select
                  value={filters.sort}
                  onChange={(e) => patch({ sort: e.target.value as LibrarySort })}
                  className="nd-field !w-auto !py-1.5 !text-xs"
                >
                  <option value="catalog">{t('Sort: by area')}</option>
                  <option value="title">{t('Sort: title')}</option>
                  <option value="year">{t('Sort: newest')}</option>
                  <option value="size">{t('Sort: smallest download')}</option>
                </select>
              </label>
              <StyledButton
                size="sm"
                variant="secondary"
                className="xl:hidden"
                onClick={() => setFiltersOpen(true)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <IconAdjustmentsHorizontal size={14} />
                  {t('Filters')}
                  {nFilters > 0 && <span className="nd-mono">· {nFilters}</span>}
                </span>
              </StyledButton>
            </div>
          </div>
          {(activeChips.length > 0 || filters.q) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="nd-mono text-xs text-text-muted" aria-live="polite">
                {filtered.length === 1
                  ? t('1 work')
                  : t('{{count}} works', { count: filtered.length })}
              </span>
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => patch(c.clear)}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2.5 py-1 text-xs text-text-primary hover:bg-surface-secondary cursor-pointer"
                  aria-label={t('Remove filter {{name}}', { name: c.label })}
                >
                  {c.label} <IconX size={12} />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}
                className="text-xs text-text-secondary underline-offset-4 hover:text-text-primary hover:underline cursor-pointer"
              >
                {t('Clear all')}
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-8 xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-10">
          <aside className="hidden xl:block">
            <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1 themed-scrollbar">
              {filterPanel}
            </div>
          </aside>

          <div className="min-w-0">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3" aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="nd-skeleton h-56" />
                ))}
              </div>
            ) : isError || !data || items.length === 0 ? (
              <EmptyState
                tone="error"
                icon={<IconCloudOff size={22} />}
                title={t('The library catalog could not be loaded.')}
                description={t('Check the internet connection and try again.')}
                action={
                  <StyledButton variant="secondary" icon="IconRefresh" onClick={() => refetch()}>
                    {t('Try again')}
                  </StyledButton>
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<IconBooks size={22} />}
                title={t('No work matches these filters.')}
                description={t('Remove a filter or search for something broader.')}
                action={
                  <StyledButton variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                    {t('Clear all filters')}
                  </StyledButton>
                }
              />
            ) : grouped ? (
              <div className="space-y-10">
                {sections.map(({ slug, items: list }) => {
                  const a = areas.get(slug)
                  return (
                    <Section
                      key={slug}
                      id={`area-${slug}`}
                      title={
                        <span className="inline-flex items-center gap-2">
                          {a && (
                            <DynamicIcon
                              icon={a.icon as DynamicIconName}
                              className="!size-4"
                              stroke={1.75}
                            />
                          )}
                          {a?.name ?? t('Other')}
                        </span>
                      }
                      count={list.length}
                      description={a?.description}
                      action={
                        slug === 'other' ? undefined : (
                          <button
                            type="button"
                            onClick={() => patch({ area: slug })}
                            className="whitespace-nowrap text-sm text-text-secondary hover:text-text-primary cursor-pointer"
                          >
                            {t('Only this area')}
                          </button>
                        )
                      }
                    >
                      {renderGrid(list)}
                    </Section>
                  )
                })}
              </div>
            ) : (
              renderGrid(filtered)
            )}
          </div>
        </div>
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        eyebrow={
          selected ? selected.areas.map((a) => areas.get(a)?.name ?? a).join(' · ') : undefined
        }
        title={selected?.title ?? ''}
      >
        {selected && (
          <WorkDetails
            item={selected}
            areas={areas}
            kiwixUrl={kiwixUrl}
            busyKey={busyKey}
            onDownload={(file) => handleDownload(selected, file)}
            onRemove={(file) => handleRemove(selected, file)}
            onSubject={(subject) => {
              setSelectedId(null)
              patch({ subject, area: null, q: '' })
            }}
          />
        )}
      </Drawer>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        eyebrow={t('Library')}
        title={t('Filters')}
        side="left"
        width="max-w-sm"
        footer={
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFilters({ ...EMPTY_FILTERS, q: filters.q, sort: filters.sort })}
              className="text-sm text-text-secondary hover:text-text-primary cursor-pointer"
            >
              {t('Clear all')}
            </button>
            <StyledButton onClick={() => setFiltersOpen(false)}>
              {filtered.length === 1
                ? t('Show 1 work')
                : t('Show {{count}} works', { count: filtered.length })}
            </StyledButton>
          </div>
        }
      >
        {filterPanel}
      </Drawer>
    </AppLayout>
  )
}
