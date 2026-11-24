import { useState } from 'react'
import StyledButton from '~/components/StyledButton'
import StyledTable from '~/components/StyledTable'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import ActiveDownloads from '~/components/ActiveDownloads'
import Alert from '~/components/Alert'
import type { ContentUpdateCheckResult, ResourceUpdateInfo } from '../../../types/collections'
import api from '~/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '~/context/notification_context'
import { formatBytes } from '~/lib/util'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '~/lib/format'

export default function ContentUpdatesSection() {
  const { addNotification } = useNotifications()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [checkResult, setCheckResult] = useState<ContentUpdateCheckResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set())
  const [isApplyingAll, setIsApplyingAll] = useState(false)

  const handleCheck = async () => {
    setIsChecking(true)
    try {
      const result = await api.checkForContentUpdates()
      if (result) {
        setCheckResult(result)
      }
    } catch {
      setCheckResult({
        updates: [],
        checked_at: new Date().toISOString(),
        error: t('Failed to check for content updates'),
      })
    } finally {
      setIsChecking(false)
    }
  }

  const handleApply = async (update: ResourceUpdateInfo) => {
    setApplyingIds((prev) => new Set(prev).add(update.resource_id))
    try {
      const result = await api.applyContentUpdate(update)
      if (result?.success) {
        addNotification({
          type: 'success',
          message: t('Update started for {{id}}', { id: update.resource_id }),
        })
        // Remove from the updates list
        setCheckResult((prev) =>
          prev
            ? { ...prev, updates: prev.updates.filter((u) => u.resource_id !== update.resource_id) }
            : prev
        )
        // Force Active Downloads to refetch now — small updates finish before the next
        // idle poll fires, so without this the user wouldn't see them.
        queryClient.invalidateQueries({ queryKey: ['download-jobs'] })
      } else {
        addNotification({ type: 'error', message: result?.error || t('Failed to start update') })
      }
    } catch {
      addNotification({
        type: 'error',
        message: t('Failed to start update for {{id}}', { id: update.resource_id }),
      })
    } finally {
      setApplyingIds((prev) => {
        const next = new Set(prev)
        next.delete(update.resource_id)
        return next
      })
    }
  }

  const handleApplyAll = async () => {
    if (!checkResult?.updates.length) return
    setIsApplyingAll(true)
    try {
      const result = await api.applyAllContentUpdates(checkResult.updates)
      if (result?.results) {
        const succeeded = result.results.filter((r) => r.success).length
        const failed = result.results.filter((r) => !r.success).length
        if (succeeded > 0) {
          addNotification({
            type: 'success',
            message:
              succeeded === 1
                ? t('Started 1 update')
                : t('Started {{count}} updates', { count: succeeded }),
          })
        }
        if (failed > 0) {
          addNotification({
            type: 'error',
            message:
              failed === 1
                ? t('1 update could not be started')
                : t('{{count}} updates could not be started', { count: failed }),
          })
        }
        // Remove successful updates from the list
        const successIds = new Set(
          result.results.filter((r) => r.success).map((r) => r.resource_id)
        )
        setCheckResult((prev) =>
          prev
            ? { ...prev, updates: prev.updates.filter((u) => !successIds.has(u.resource_id)) }
            : prev
        )
        if (successIds.size > 0) {
          queryClient.invalidateQueries({ queryKey: ['download-jobs'] })
        }
      }
    } catch {
      addNotification({ type: 'error', message: t('Failed to apply updates') })
    } finally {
      setIsApplyingAll(false)
    }
  }

  return (
    <div className="mt-8">
      <StyledSectionHeader title={t('Manual Content Updates')} />

      <div className="bg-surface-primary rounded-xl border overflow-hidden p-6">
        <div className="flex items-center justify-between">
          <p className="text-desert-stone-dark">
            {t('Check if newer versions of your installed ZIM files and maps are available.')}
          </p>
          <StyledButton
            variant="primary"
            icon="IconRefresh"
            onClick={handleCheck}
            loading={isChecking}
          >
            {t('Check for Content Updates')}
          </StyledButton>
        </div>

        {checkResult?.error && (
          <Alert
            type="warning"
            title={t('Update Check Issue')}
            message={checkResult.error}
            variant="bordered"
            className="my-4"
          />
        )}

        {checkResult && !checkResult.error && checkResult.updates.length === 0 && (
          <Alert
            type="success"
            title={t('All Content Up to Date')}
            message={t('All your installed content is running the latest available version.')}
            variant="bordered"
            className="my-4"
          />
        )}

        {checkResult && checkResult.updates.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-desert-stone-dark">
                {checkResult.updates.length === 1
                  ? t('1 update available')
                  : t('{{count}} updates available', { count: checkResult.updates.length })}
              </p>
              <StyledButton
                variant="primary"
                size="sm"
                icon="IconDownload"
                onClick={handleApplyAll}
                loading={isApplyingAll}
              >
                {t('Update All ({{count}})', { count: checkResult.updates.length })}
              </StyledButton>
            </div>
            <StyledTable
              data={checkResult.updates}
              columns={[
                {
                  accessor: 'resource_id',
                  title: t('Title'),
                  render: (record) => (
                    <span className="font-medium text-desert-green">{record.resource_id}</span>
                  ),
                },
                {
                  accessor: 'resource_type',
                  title: t('Type'),
                  render: (record) => (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        record.resource_type === 'zim'
                          ? 'bg-surface-secondary text-text-primary'
                          : 'bg-desert-olive-lighter text-desert-olive-dark'
                      }`}
                    >
                      {record.resource_type === 'zim' ? 'ZIM' : t('Map')}
                    </span>
                  ),
                },
                {
                  accessor: 'size_bytes',
                  title: t('Size'),
                  render: (record) => (
                    <span className="text-desert-stone-dark">
                      {record.size_bytes ? formatBytes(record.size_bytes, 1) : '—'}
                    </span>
                  ),
                },
                {
                  accessor: 'installed_version',
                  title: t('Version'),
                  render: (record) => (
                    <span className="text-desert-stone-dark">
                      {record.installed_version} → {record.latest_version}
                    </span>
                  ),
                },
                {
                  accessor: 'resource_id',
                  title: '',
                  render: (record) => (
                    <StyledButton
                      variant="secondary"
                      size="sm"
                      icon="IconDownload"
                      onClick={() => handleApply(record)}
                      loading={applyingIds.has(record.resource_id)}
                    >
                      {t('Update')}
                    </StyledButton>
                  ),
                },
              ]}
            />
          </div>
        )}

        {checkResult?.checked_at && (
          <p className="text-xs text-desert-stone mt-3">
            {t('Last checked: {{date}}', { date: formatDateTime(checkResult.checked_at) })}
          </p>
        )}
      </div>

      <ActiveDownloads withHeader />
    </div>
  )
}
