import PageHeader from '~/components/nd/PageHeader'
import { Head } from '@inertiajs/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import StyledTable from '~/components/StyledTable'
import SettingsLayout from '~/layouts/SettingsLayout'
import api from '~/lib/api'
import StyledButton from '~/components/StyledButton'
import { useModals } from '~/context/modal_context'
import StyledModal from '~/components/StyledModal'
import useServiceInstalledStatus from '~/hooks/useServiceInstalledStatus'
import Alert from '~/components/Alert'
import { useNotifications } from '~/context/notification_context'
import ZimUploader from '~/components/ZimUploader'
import { ZimFileWithMetadata } from '../../../../types/zim'
import { SERVICE_NAMES } from '../../../../constants/service_names'
import { formatBytes } from '~/lib/util'
import { IconArrowDown, IconArrowUp, IconArrowsSort } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

type SortKey = 'name' | 'size'
type SortDirection = 'asc' | 'desc'

export default function ZimPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { openModal, closeAllModals } = useModals()
  const { addNotification } = useNotifications()
  const { isInstalled } = useServiceInstalledStatus(SERVICE_NAMES.KIWIX)
  const [sortKey, setSortKey] = useState<SortKey>('size')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showUploader, setShowUploader] = useState(false)
  const { data, isLoading } = useQuery<ZimFileWithMetadata[]>({
    queryKey: ['zim-files'],
    queryFn: getFiles,
    refetchOnWindowFocus: false,
  })

  async function getFiles() {
    const res = await api.listZimFiles()
    return res?.data.files ?? []
  }

  const sortedData = useMemo(() => {
    if (!data) return []
    const copy = [...data]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'size') {
        const aSize = a.size_bytes ?? 0
        const bSize = b.size_bytes ?? 0
        cmp = aSize - bSize
      } else {
        const aName = (a.title || a.name).toLowerCase()
        const bName = (b.title || b.name).toLowerCase()
        cmp = aName.localeCompare(bName)
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return copy
  }, [data, sortKey, sortDirection])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection(key === 'size' ? 'desc' : 'asc')
    }
  }

  function renderSortHeader(label: string, key: SortKey) {
    const active = sortKey === key
    const Icon = !active ? IconArrowsSort : sortDirection === 'asc' ? IconArrowUp : IconArrowDown
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="flex items-center gap-1 font-semibold text-text-primary hover:text-desert-orange"
      >
        {label}
        <Icon className="size-4" />
      </button>
    )
  }

  async function confirmDeleteFile(file: ZimFileWithMetadata) {
    openModal(
      <StyledModal
        title={t('Confirm Delete?')}
        onConfirm={() => {
          deleteFileMutation.mutateAsync(file)
          closeAllModals()
        }}
        onCancel={closeAllModals}
        open={true}
        confirmText={t('Delete')}
        cancelText={t('Cancel')}
        confirmVariant="danger"
      >
        <p className="text-text-secondary">
          {t('Are you sure you want to delete {{name}}? This action cannot be undone.', {
            name: file.name,
          })}
        </p>
      </StyledModal>,
      'confirm-delete-file-modal'
    )
  }

  const deleteFileMutation = useMutation({
    mutationFn: async (file: ZimFileWithMetadata) =>
      api.deleteZimFile(file.name.replace('.zim', '')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zim-files'] })
    },
  })

  const rescanMutation = useMutation({
    mutationFn: async () => api.rescanZimLibrary(),
    onSuccess: (result) => {
      // catchInternal returns undefined on error (and shows its own error toast)
      if (!result) return
      queryClient.invalidateQueries({ queryKey: ['zim-files'] })
      addNotification({
        type: 'success',
        message:
          result.added > 0
            ? result.added === 1
              ? t('Found 1 new book. Library now has {{total}}.', { total: result.after })
              : t('Found {{count}} new books. Library now has {{total}}.', {
                  count: result.added,
                  total: result.after,
                })
            : result.after === 1
              ? t('Library is up to date (1 book).')
              : t('Library is up to date ({{count}} books).', { count: result.after }),
      })
    },
  })

  return (
    <SettingsLayout>
      <Head title={t('Content Manager')} />
      <div className="w-full">
        <div className="nd-page">
          <PageHeader
            eyebrow={t('Content')}
            title={t('Content Manager')}
            description={t('Manage your stored content files.')}
            actions={
              <>
                <StyledButton
                  variant="secondary"
                  icon={showUploader ? 'IconX' : 'IconUpload'}
                  onClick={() => setShowUploader((v) => !v)}
                >
                  {showUploader ? t('Hide Uploader') : t('Upload ZIM File')}
                </StyledButton>
                {isInstalled && (
                  <StyledButton
                    variant="secondary"
                    icon={'IconRefresh'}
                    loading={rescanMutation.isPending}
                    title={t(
                      'Rebuild the Kiwix library index from the files on disk. Use this after manually adding ZIM files outside of monolith-nomad.'
                    )}
                    onClick={() => rescanMutation.mutate()}
                  >
                    {t('Rescan Library')}
                  </StyledButton>
                )}
              </>
            }
          />
          {showUploader && (
            <div className="mt-6">
              <p className="text-text-muted text-sm mb-3">
                {t(
                  'Upload a ZIM file from your browser. Files up to 20 GB are supported. For best results upload from the same machine or over a stable LAN connection. Larger files should be copied directly to the storage volume.'
                )}
              </p>
              <ZimUploader
                existingFilenames={data?.map((f) => f.name) ?? []}
                onUploadComplete={(added) => {
                  queryClient.invalidateQueries({ queryKey: ['zim-files'] })
                  queryClient.invalidateQueries({ queryKey: ['wikipedia-state'] })
                  queryClient.invalidateQueries({ queryKey: ['curated-categories'] })
                  setShowUploader(false)
                  addNotification({
                    type: 'success',
                    message:
                      added > 0
                        ? added === 1
                          ? t('Upload complete. 1 new book added to the library.')
                          : t('Upload complete. {{count}} new books added to the library.', {
                              count: added,
                            })
                        : t('Upload complete. Library is up to date.'),
                  })
                }}
              />
            </div>
          )}
          {!isInstalled && (
            <Alert
              title={t(
                'The Kiwix application is not installed. Please install it to view downloaded ZIM files'
              )}
              type="warning"
              variant="solid"
              className="!mt-6"
            />
          )}
          <StyledTable<ZimFileWithMetadata & { actions?: any }>
            className="font-semibold mt-4"
            rowLines={true}
            loading={isLoading}
            compact
            columns={[
              {
                accessor: 'title',
                title: renderSortHeader(t('Title'), 'name'),
                render: (record) => (
                  <span className="font-medium">{record.title || record.name}</span>
                ),
              },
              {
                accessor: 'summary',
                title: t('Summary'),
                render: (record) => (
                  <span className="text-text-secondary text-sm line-clamp-2">
                    {record.summary || '—'}
                  </span>
                ),
              },
              {
                accessor: 'size_bytes',
                title: renderSortHeader(t('Size'), 'size'),
                render: (record) => (
                  <span className="text-text-secondary tabular-nums">
                    {record.size_bytes ? formatBytes(record.size_bytes, 1) : '—'}
                  </span>
                ),
              },
              {
                accessor: 'actions',
                title: t('Actions'),
                render: (record) => (
                  <div className="flex space-x-2">
                    <StyledButton
                      variant="danger"
                      icon={'IconTrash'}
                      onClick={() => {
                        confirmDeleteFile(record)
                      }}
                    >
                      {t('Delete')}
                    </StyledButton>
                  </div>
                ),
              },
            ]}
            data={sortedData}
          />
        </div>
      </div>
    </SettingsLayout>
  )
}
