import StyledSectionHeader from '~/components/StyledSectionHeader'
import Switch from '~/components/inputs/Switch'
import api from '~/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '~/context/notification_context'
import { useAppAutoUpdateStatus } from '~/hooks/use_app_auto_update_status'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '~/lib/format'

export default function AppAutoUpdateSection() {
  const { addNotification } = useNotifications()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: status, isLoading } = useAppAutoUpdateStatus()

  const enabled = status?.enabled ?? false

  const toggleMutation = useMutation({
    mutationFn: (value: boolean) => api.updateSetting('appAutoUpdate.enabled', value),
    onSuccess: (_data, value) => {
      queryClient.invalidateQueries({ queryKey: ['app-auto-update-status'] })
      addNotification({
        type: 'success',
        message: value ? t('App automatic updates enabled.') : t('App automatic updates disabled.'),
      })
    },
    onError: () => {
      addNotification({ type: 'error', message: t('Failed to update app auto-update setting.') })
    },
  })

  return (
    <>
      <StyledSectionHeader title={t('Automatic App Updates')} className="mt-8" />
      <div className="bg-surface-primary rounded-xl border overflow-hidden mt-6 p-6">
        <Switch
          checked={enabled}
          onChange={(value) => toggleMutation.mutate(value)}
          disabled={toggleMutation.isPending || isLoading}
          label={t('Enable Automatic App Updates')}
          description={t(
            "Automatically install minor and patch updates for apps you've opted in (toggle each app in Supply Depot). Major versions always require a manual update. Uses the same update window and cool-off period as the core schedule above."
          )}
        />

        {enabled && status && (
          <div className="mt-6 pt-4 border-t border-desert-stone-light text-sm">
            <p className="text-desert-stone mb-3">
              <span className="font-medium">{t('Update window:')} </span>
              {status.withinWindow
                ? t('{{start}}–{{end}} (currently inside); cool-off {{hours}}h', {
                    start: status.windowStart,
                    end: status.windowEnd,
                    hours: status.cooloffHours,
                  })
                : t('{{start}}–{{end}} (currently outside); cool-off {{hours}}h', {
                    start: status.windowStart,
                    end: status.windowEnd,
                    hours: status.cooloffHours,
                  })}
              .
              {status.lastResult && (
                <>
                  {' '}
                  <span className="font-medium">{t('Last run:')} </span>
                  {status.lastResult}
                  {status.lastAttemptAt ? ` (${formatDateTime(status.lastAttemptAt)})` : ''}
                </>
              )}
            </p>

            {status.apps.length === 0 ? (
              <p className="text-desert-stone-dark">
                {t(
                  'No apps are opted in yet. Enable auto-update on individual apps from the Supply Depot.'
                )}
              </p>
            ) : (
              <ul className="space-y-2">
                {status.apps.map((app) => (
                  <li
                    key={app.service_name}
                    className="flex items-start justify-between gap-4 rounded-md bg-surface-secondary px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-text-primary">
                        {app.friendly_name || app.service_name}
                      </p>
                      <p className="text-desert-stone">
                        {app.current_version}
                        {app.available_update_version
                          ? ` → ${app.available_update_version}`
                          : ` ${t('(up to date)')}`}
                      </p>
                      {app.auto_disabled_reason && (
                        <p className="text-desert-red mt-0.5">{app.auto_disabled_reason}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        app.eligible ? 'text-desert-green' : 'text-desert-stone'
                      }`}
                    >
                      {app.reason}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  )
}
