import { Head, Link } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  IconBook2,
  IconBooks,
  IconDownload,
  IconExternalLink,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { AxiosError } from 'axios'
import AppLayout from '~/layouts/AppLayout'
import DynamicIcon, { DynamicIconName } from '~/components/DynamicIcon'
import LanguageBadge from '~/components/LanguageBadge'
import LoadingSpinner from '~/components/LoadingSpinner'
import StyledButton from '~/components/StyledButton'
import { useNotifications } from '~/context/notification_context'
import { getServiceLink } from '~/lib/navigation'
import { formatBytes } from '~/lib/util'
import api from '~/lib/api'
import { SERVICE_NAMES } from '../../../constants/service_names'
import type {
  LibraryArea,
  LibraryFileWithStatus,
  LibraryItemWithStatus,
  LibraryLevel,
} from '../../../types/library'

const LEVELS: { id: LibraryLevel; label: string }[] = [
  { id: 'iniciante', label: 'Beginner' },
  { id: 'intermediario', label: 'Intermediate' },
  { id: 'avancado', label: 'Advanced' },
]
const FORMATS = ['pdf', 'epub', 'zim'] as const

function fileSize(file: LibraryFileWithStatus): number | undefined {
  return 'size_bytes' in file ? file.size_bytes : file.zim_size_bytes
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
        active
          ? 'bg-desert-green text-white border-desert-green'
          : 'bg-desert-white text-text-secondary border-desert-stone-light hover:border-desert-green'
      }`}
    >
      {children}
    </button>
  )
}

function FileRow({
  item,
  file,
  kiwixUrl,
  busy,
  onDownload,
  onRemove,
}: {
  item: LibraryItemWithStatus
  file: LibraryFileWithStatus
  kiwixUrl: string | null
  busy: boolean
  onDownload: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const size = fileSize(file)
  const isDoc = file.format !== 'zim'
  const installed = file.status === 'installed' || file.status === 'update_available'
  return (
    <div className="flex flex-wrap items-center gap-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border border-desert-stone-light text-text-secondary">
        {file.format}
      </span>
      {size ? <span className="text-xs text-text-muted">{formatBytes(size, 1)}</span> : null}
      {isDoc && 'sha256' in file && !file.sha256 ? (
        <span
          className="text-xs text-text-muted"
          title={t('Continuously rebuilt by the publisher: the format is checked instead of a fixed hash')}
        >
          {t('continuous edition')}
        </span>
      ) : null}
      <div className="flex flex-wrap gap-2 ml-auto">
        {file.status === 'downloading' && (
          <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
            <IconLoader2 size={14} className="animate-spin" /> {t('Downloading...')}
          </span>
        )}
        {(file.status === 'available' || file.status === 'update_available') && (
          <StyledButton size="sm" variant="primary" onClick={onDownload} disabled={busy} loading={busy}>
            {file.status === 'update_available' ? (
              <span className="inline-flex items-center gap-1">
                <IconRefresh size={14} /> {t('Update')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <IconDownload size={14} /> {t('Download')}
              </span>
            )}
          </StyledButton>
        )}
        {installed && isDoc && file.filename && (
          <Link href={`/library/read/${file.filename}`}>
            <StyledButton size="sm" variant="secondary">
              <span className="inline-flex items-center gap-1">
                <IconBook2 size={14} /> {t('Read')}
              </span>
            </StyledButton>
          </Link>
        )}
        {installed && !isDoc && kiwixUrl && (
          <a href={kiwixUrl} target="_blank" rel="noreferrer">
            <StyledButton size="sm" variant="secondary">
              <span className="inline-flex items-center gap-1">
                <IconExternalLink size={14} /> {t('Open in Kiwix')}
              </span>
            </StyledButton>
          </a>
        )}
        {installed && isDoc && (
          <StyledButton
            size="sm"
            variant="ghost"
            onClick={onRemove}
            disabled={busy}
            aria-label={t('Remove {{format}} of {{title}}', {
              format: file.format.toUpperCase(),
              title: item.title,
            })}
          >
            <IconTrash size={14} />
          </StyledButton>
        )}
      </div>
    </div>
  )
}

function ItemCard({
  item,
  areas,
  kiwixUrl,
  busyKey,
  onDownload,
  onRemove,
}: {
  item: LibraryItemWithStatus
  areas: Map<string, LibraryArea>
  kiwixUrl: string | null
  busyKey: string | null
  onDownload: (item: LibraryItemWithStatus, file: LibraryFileWithStatus) => void
  onRemove: (item: LibraryItemWithStatus, file: LibraryFileWithStatus) => void
}) {
  const { t } = useTranslation()
  return (
    <article className="rounded-lg border border-desert-stone-light bg-desert-white p-4 flex flex-col gap-2 shadow-sm">
      <h3 className="text-base font-semibold text-text-primary leading-snug">
        {item.title}
        <LanguageBadge language={item.language} />
      </h3>
      <p className="text-sm text-text-secondary">
        {item.authors.join(', ')} · {item.publisher}
      </p>
      <p className="text-xs text-text-muted">
        {item.edition} · {item.year}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {item.levels.map((l) => (
          <span
            key={l}
            className="text-[11px] px-2 py-0.5 rounded-full bg-desert-green/10 text-desert-green border border-desert-green/30"
          >
            {t(LEVELS.find((x) => x.id === l)?.label ?? l)}
          </span>
        ))}
        {item.areas.map((a) => (
          <span
            key={a}
            className="text-[11px] px-2 py-0.5 rounded-full border border-desert-stone-light text-text-secondary"
          >
            {areas.get(a)?.name ?? a}
          </span>
        ))}
      </div>
      <p className="text-sm text-text-primary">{item.description}</p>
      <p className="text-xs text-text-muted">
        <span className="font-medium">{t('Subjects')}:</span> {item.subjects.join(' · ')}
      </p>
      {item.notes && <p className="text-xs text-desert-orange-dark">{item.notes}</p>}
      <p className="text-xs text-text-muted">
        <a href={item.license.url} target="_blank" rel="noreferrer" className="underline">
          {item.license.name}
        </a>
        {' · '}
        <a href={item.source_url} target="_blank" rel="noreferrer" className="underline">
          {t('Official source')}
        </a>
      </p>
      <div className="mt-1 divide-y divide-desert-stone-light/60 border-t border-desert-stone-light/60">
        {item.files.map((file) => (
          <FileRow
            key={file.format}
            item={item}
            file={file}
            kiwixUrl={kiwixUrl}
            busy={busyKey === `${item.id}:${file.format}`}
            onDownload={() => onDownload(item, file)}
            onRemove={() => onRemove(item, file)}
          />
        ))}
      </div>
    </article>
  )
}

export default function LibraryPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { addNotification } = useNotifications()
  const [search, setSearch] = useState('')
  const [area, setArea] = useState<string | null>(null)
  const [level, setLevel] = useState<LibraryLevel | null>(null)
  const [format, setFormat] = useState<(typeof FORMATS)[number] | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['library'],
    queryFn: () => api.getLibrary(),
    refetchInterval: (query) =>
      query.state.data?.items.some((i) => i.files.some((f) => f.status === 'downloading')) ? 3000 : false,
  })
  const { data: services } = useQuery({
    queryKey: ['system-services'],
    queryFn: () => api.getSystemServices(),
  })
  const kiwix = services?.find((s) => s.service_name === SERVICE_NAMES.KIWIX && s.installed)
  const kiwixUrl = kiwix ? getServiceLink(kiwix.ui_location ?? '', kiwix.custom_url) : null

  const areas = useMemo(() => new Map((data?.areas ?? []).map((a) => [a.slug, a])), [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.items ?? []).filter((item) => {
      if (area && !item.areas.includes(area)) return false
      if (level && !item.levels.includes(level)) return false
      if (format && !item.files.some((f) => f.format === format)) return false
      if (!q) return true
      return [item.title, item.description, item.publisher, ...item.authors, ...item.subjects]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [data, search, area, level, format])

  // Each work is listed once, under its first area (or under the selected one).
  const sections = useMemo(() => {
    const order = (data?.areas ?? []).map((a) => a.slug)
    const groups = new Map<string, LibraryItemWithStatus[]>()
    for (const item of filtered) {
      const key = area ?? item.areas[0]
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return order.filter((slug) => groups.has(slug)).map((slug) => ({ slug, items: groups.get(slug)! }))
  }, [filtered, data, area])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['library'] })

  const serverError = (error: unknown) =>
    (error instanceof AxiosError && (error.response?.data?.error || error.response?.data?.message)) ||
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
    const question = t('Remove the downloaded {{format}} of "{{title}}"?', {
      format: file.format.toUpperCase(),
      title: item.title,
    })
    if (!window.confirm(question)) return
    setBusyKey(`${item.id}:${file.format}`)
    try {
      await api.removeLibraryFile(item.id, file.format)
    } catch (error) {
      addNotification({ type: 'error', message: serverError(error) })
    } finally {
      setBusyKey(null)
      refresh()
    }
  }

  const installedCount = (data?.items ?? []).filter((i) =>
    i.files.some((f) => f.status === 'installed' || f.status === 'update_available')
  ).length

  return (
    <AppLayout>
      <Head title={t('Library')} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <IconBooks size={28} /> {t('Library')}
          </h1>
          <p className="text-text-secondary mt-1 max-w-3xl">
            {t(
              'Books, manuals and offline reference works in Portuguese, from official sources and with open licenses. Download what you need and read it here, without internet.'
            )}
          </p>
          {data && (
            <p className="text-xs text-text-muted mt-2">
              {t('{{count}} works · {{installed}} downloaded', {
                count: data.items.length,
                installed: installedCount,
              })}
            </p>
          )}
        </header>

        <div className="flex flex-col gap-3 mb-6">
          <label className="relative max-w-md">
            <span className="sr-only">{t('Search the library')}</span>
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search by title, author or subject')}
              className="w-full pl-9 pr-3 py-2 rounded-md border border-desert-stone-light bg-desert-white text-text-primary text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Area')}>
            <Chip active={area === null} onClick={() => setArea(null)}>
              {t('All areas')}
            </Chip>
            {(data?.areas ?? []).map((a) => (
              <Chip key={a.slug} active={area === a.slug} onClick={() => setArea(area === a.slug ? null : a.slug)}>
                {a.name}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('Level')}>
              {LEVELS.map((l) => (
                <Chip key={l.id} active={level === l.id} onClick={() => setLevel(level === l.id ? null : l.id)}>
                  {t(l.label)}
                </Chip>
              ))}
            </div>
            <span className="w-px h-5 bg-desert-stone-light mx-1" aria-hidden="true" />
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('Format')}>
              {FORMATS.map((f) => (
                <Chip key={f} active={format === f} onClick={() => setFormat(format === f ? null : f)}>
                  {f.toUpperCase()}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : !data || data.items.length === 0 ? (
          <p className="text-text-secondary">
            {t('The library catalog could not be loaded. Check the internet connection and try again.')}
          </p>
        ) : sections.length === 0 ? (
          <p className="text-text-secondary">{t('No work matches these filters.')}</p>
        ) : (
          sections.map(({ slug, items }) => {
            const a = areas.get(slug)
            return (
              <section key={slug} className="mb-8" aria-labelledby={`area-${slug}`}>
                <h2
                  id={`area-${slug}`}
                  className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-1"
                >
                  {a && <DynamicIcon icon={a.icon as DynamicIconName} className="h-5 w-5" />}
                  {a?.name ?? slug}
                </h2>
                {a && <p className="text-sm text-text-muted mb-3">{a.description}</p>}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      areas={areas}
                      kiwixUrl={kiwixUrl}
                      busyKey={busyKey}
                      onDownload={handleDownload}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </AppLayout>
  )
}
