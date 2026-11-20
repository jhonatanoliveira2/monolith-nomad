import { Head } from '@inertiajs/react'
import { useState } from 'react'
import SettingsLayout from '~/layouts/SettingsLayout'
import StyledButton from '~/components/StyledButton'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import Alert from '~/components/Alert'
import Input from '~/components/inputs/Input'
import { useNotifications } from '~/context/NotificationContext'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '~/lib/api'
import { useTranslation } from 'react-i18next'

export default function AdvancedPage(props: {
  advanced: {
    internetStatusTestUrl: string
    internetStatusTestUrlEnvOverride: boolean
    serviceLogsUrl: string
  }
}) {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const { internetStatusTestUrlEnvOverride } = props.advanced

  const [internetStatusTestUrl, setInternetStatusTestUrl] = useState(
    props.advanced.internetStatusTestUrl ?? ''
  )
  const [testUrlError, setTestUrlError] = useState<string | null>(null)

  const [serviceLogsUrl, setServiceLogsUrl] = useState(props.advanced.serviceLogsUrl ?? '')
  const [serviceLogsUrlError, setServiceLogsUrlError] = useState<string | null>(null)

  // Mirror the backend validation (admin/app/validators/settings.ts) for instant
  // feedback. The backend remains the source of truth and returns 422 on failure.
  function validateTestUrl(value: string): string | null {
    if (value.trim() === '') return null // empty clears the setting
    try {
      const url = new URL(value)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return t('Test URL must use http or https.')
      }
    } catch {
      return t('Test URL must be a valid URL (e.g. "https://example.com").')
    }
    return null
  }

  const updateTestUrlMutation = useMutation({
    mutationFn: async (value: string) => {
      return await api.updateSetting('system.internetStatusTestUrl', value)
    },
    onSuccess: () => {
      addNotification({ message: t('Setting updated successfully.'), type: 'success' })
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        t('There was an error updating the setting. Please try again.')
      setTestUrlError(msg)
      addNotification({ message: msg, type: 'error' })
    },
  })

  function handleSaveTestUrl() {
    const trimmed = internetStatusTestUrl.trim()
    const validationError = validateTestUrl(trimmed)
    if (validationError) {
      setTestUrlError(validationError)
      return
    }
    setTestUrlError(null)
    updateTestUrlMutation.mutate(trimmed)
  }

  // Mirrors the backend's `ui.serviceLogsUrl` validation
  // (admin/app/validators/settings.ts). A bare host is accepted — normalizeCustomUrl
  // prepends http:// before it reaches an href.
  function validateServiceLogsUrl(value: string): string | null {
    if (value.trim() === '') return null // empty clears the override
    const trimmed = value.trim()
    const isHttpUrl = /^https?:\/\//i.test(trimmed)
    if (!isHttpUrl && /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      return t('Service logs URL must use http or https.')
    }
    try {
      const url = new URL(isHttpUrl ? trimmed : `http://${trimmed}`)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return t('Service logs URL must use http or https.')
      }
    } catch {
      return t('Service logs URL must be a valid URL (e.g. "https://logs.example.com").')
    }
    return null
  }

  const updateServiceLogsUrlMutation = useMutation({
    mutationFn: async (value: string) => {
      return await api.updateSetting('ui.serviceLogsUrl', value)
    },
    onSuccess: () => {
      // The sidebar reads this setting through useSystemSetting; refresh it so the
      // link picks up the new address without a page reload.
      queryClient.invalidateQueries({ queryKey: ['system-setting', 'ui.serviceLogsUrl'] })
      addNotification({ message: t('Setting updated successfully.'), type: 'success' })
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        t('There was an error updating the setting. Please try again.')
      setServiceLogsUrlError(msg)
      addNotification({ message: msg, type: 'error' })
    },
  })

  function handleSaveServiceLogsUrl() {
    const trimmed = serviceLogsUrl.trim()
    const validationError = validateServiceLogsUrl(trimmed)
    if (validationError) {
      setServiceLogsUrlError(validationError)
      return
    }
    setServiceLogsUrlError(null)
    updateServiceLogsUrlMutation.mutate(trimmed)
  }

  return (
    <SettingsLayout>
      <Head title={t('Advanced Settings')} />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6">
          <h1 className="text-4xl font-semibold mb-4">{t('Advanced')}</h1>
          <p className="text-text-muted mb-4">
            {t('Advanced configuration for operators. These settings are optional — the defaults work for most deployments.')}
          </p>

          <StyledSectionHeader title={t('Connectivity')} className="mt-8 mb-4" />
          <div className="bg-surface-primary rounded-lg border-2 border-border-subtle p-6">
            <p className="text-sm text-text-secondary mb-4">
              {t(
                "monolith-nomad periodically checks whether it can reach the internet. By default it probes Cloudflare's utility endpoint with a few fallbacks. Set a custom endpoint below if your network blocks the defaults. Leave blank to use the built-in defaults."
              )}
            </p>

            {internetStatusTestUrlEnvOverride && (
              <Alert
                type="info"
                variant="bordered"
                title={t('Managed by environment variable')}
                message={t('The INTERNET_STATUS_TEST_URL environment variable is set and takes precedence over this setting. Remove it to manage the test URL here.')}
                className="!mb-4"
              />
            )}

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  name="internetStatusTestUrl"
                  label={t('Internet Status Test URL')}
                  helpText={t('A single http(s) URL used to check connectivity. Any HTTP response counts as online.')}
                  placeholder="https://1.1.1.1/cdn-cgi/trace"
                  value={internetStatusTestUrl}
                  disabled={internetStatusTestUrlEnvOverride}
                  error={Boolean(testUrlError)}
                  onChange={(e) => {
                    setInternetStatusTestUrl(e.target.value)
                    setTestUrlError(null)
                  }}
                />
                {testUrlError && <p className="text-sm text-desert-red-dark mt-1">{testUrlError}</p>}
              </div>
              <StyledButton
                variant="primary"
                onClick={handleSaveTestUrl}
                loading={updateTestUrlMutation.isPending}
                disabled={updateTestUrlMutation.isPending || internetStatusTestUrlEnvOverride}
                className="mb-0.5"
              >
                {t('Save')}
              </StyledButton>
            </div>
          </div>

          <StyledSectionHeader title={t('Reverse Proxy')} className="mt-8 mb-4" />
          <div className="bg-surface-primary rounded-lg border-2 border-border-subtle p-6">
            <p className="text-sm text-text-secondary mb-4">
              {t(
                'If you reach monolith-nomad through a reverse proxy or a local DNS name, enter the address of the “Service Logs & Metrics” page here. Leave blank to use the default (port 9999 on this server).'
              )}
            </p>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  name="serviceLogsUrl"
                  label={t('Service Logs & Metrics URL')}
                  helpText={t('Where the Dozzle container is reachable, e.g. https://logs.example.com or logs.lan')}
                  placeholder="https://logs.example.com"
                  value={serviceLogsUrl}
                  error={Boolean(serviceLogsUrlError)}
                  onChange={(e) => {
                    setServiceLogsUrl(e.target.value)
                    setServiceLogsUrlError(null)
                  }}
                />
                {serviceLogsUrlError && (
                  <p className="text-sm text-desert-red-dark mt-1">{serviceLogsUrlError}</p>
                )}
              </div>
              <StyledButton
                variant="primary"
                onClick={handleSaveServiceLogsUrl}
                loading={updateServiceLogsUrlMutation.isPending}
                disabled={updateServiceLogsUrlMutation.isPending}
                className="mb-0.5"
              >
                {t('Save')}
              </StyledButton>
            </div>
          </div>
        </main>
      </div>
    </SettingsLayout>
  )
}
