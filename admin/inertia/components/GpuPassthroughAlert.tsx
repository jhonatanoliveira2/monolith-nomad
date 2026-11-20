import { useState } from 'react'
import Alert from '~/components/Alert'
import StyledModal from '~/components/StyledModal'
import Input from '~/components/inputs/Input'
import { useNotifications } from '~/context/NotificationContext'
import { useModals } from '~/context/ModalContext'
import api from '~/lib/api'
import type { GpuHealthStatus } from '../../types/system'
import { useTranslation } from 'react-i18next'

const DISMISS_KEY = 'nomad:gpu-banner-dismissed'
const HSA_OVERRIDE_PATTERN = /^\d{1,2}\.\d{1,2}\.\d{1,2}$/

/**
 * Banner for gpuHealth.status === 'passthrough_failed'.
 *
 * NVIDIA, and AMD whose container differs from what a reinstall would create, get
 * the one-click reinstall. AMD whose container already matches gets an HSA override
 * prompt instead: reinstalling it rebuilds the same CPU-bound container (#1344).
 */
export default function GpuPassthroughAlert({
  gpuHealth,
  assistantName,
  className,
}: {
  gpuHealth: GpuHealthStatus | undefined
  assistantName: string
  className?: string
}) {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const { openModal, closeAllModals } = useModals()
  const [reinstalling, setReinstalling] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true'
    } catch {
      return false
    }
  })

  if (gpuHealth?.status !== 'passthrough_failed' || dismissed) return null

  const isAmd = gpuHealth.gpuVendor === 'amd'
  const needsHsaOverride = isAmd && gpuHealth.amdReinstallWouldChange === false

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, 'true')
    } catch {}
  }

  const reinstall = async () => {
    setReinstalling(true)
    try {
      const response = await api.forceReinstallService('nomad_ollama')
      if (!response || !response.success) {
        throw new Error(response?.message || t('Force reinstall failed'))
      }
      addNotification({
        message: t('{{name}} is being reinstalled with GPU support. This page will reload shortly.', { name: assistantName }),
        type: 'success',
      })
      try {
        localStorage.removeItem(DISMISS_KEY)
      } catch {}
      setTimeout(() => window.location.reload(), 5000)
    } catch (error) {
      addNotification({
        message: t('Failed to reinstall: {{error}}', { error: error instanceof Error ? error.message : t('Unknown error') }),
        type: 'error',
      })
      setReinstalling(false)
    }
  }

  const openReinstallModal = () => {
    openModal(
      <StyledModal
        title={t('Reinstall {{name}}?', { name: assistantName })}
        onConfirm={() => {
          closeAllModals()
          reinstall()
        }}
        onCancel={closeAllModals}
        open={true}
        confirmText={t('Reinstall')}
        cancelText={t('Cancel')}
      >
        <p className="text-text-primary">
          {t('This will recreate the {{name}} container with GPU support enabled. Your downloaded models will be preserved. The service will be briefly unavailable during reinstall.', { name: assistantName })}
        </p>
      </StyledModal>,
      'gpu-health-force-reinstall-modal'
    )
  }

  const openHsaOverrideModal = () => {
    openModal(
      <HsaOverrideModal
        gpuHealth={gpuHealth}
        assistantName={assistantName}
        onCancel={closeAllModals}
        onSaved={() => {
          closeAllModals()
          reinstall()
        }}
      />,
      'gpu-health-hsa-override-modal'
    )
  }

  const message = needsHsaOverride
    ? gpuHealth.amdGfxTarget
      ? t("Your system has an AMD GPU, but {{name}} is running on CPU only. Reinstalling won't fix this: the GPU ({{target}}) isn't on ROCm's supported list and needs a GFX version override.", { name: assistantName, target: gpuHealth.amdGfxTarget })
      : t("Your system has an AMD GPU, but {{name}} is running on CPU only. Reinstalling won't fix this: the GPU isn't on ROCm's supported list and needs a GFX version override.", { name: assistantName })
    : isAmd
      ? t("Your system has an AMD GPU, but {{name}} can't access it. AI is running on CPU only, which is significantly slower.", { name: assistantName })
      : t("Your system has an NVIDIA GPU, but {{name}} can't access it. AI is running on CPU only, which is significantly slower.", { name: assistantName })

  return (
    <Alert
      type="warning"
      variant="bordered"
      title={t('GPU Not Accessible to {{name}}', { name: assistantName })}
      message={message}
      className={className}
      dismissible={true}
      onDismiss={handleDismiss}
      buttonProps={{
        children: needsHsaOverride
          ? t('Fix: Set GFX Override')
          : t('Fix: Reinstall {{name}}', { name: assistantName }),
        icon: needsHsaOverride ? 'IconTool' : 'IconRefresh',
        variant: 'action',
        size: 'sm',
        onClick: needsHsaOverride ? openHsaOverrideModal : openReinstallModal,
        loading: reinstalling,
        disabled: reinstalling,
      }}
    />
  )
}

function HsaOverrideModal({
  gpuHealth,
  assistantName,
  onCancel,
  onSaved,
}: {
  gpuHealth: GpuHealthStatus
  assistantName: string
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const [value, setValue] = useState(gpuHealth.suggestedHsaOverride ?? '')
  const [saving, setSaving] = useState(false)
  const valid = HSA_OVERRIDE_PATTERN.test(value.trim())

  const save = async () => {
    setSaving(true)
    try {
      const response = await api.updateSetting('ai.amdHsaOverride', value.trim())
      // catchInternal already notified on a request failure and returned undefined.
      if (!response) {
        setSaving(false)
        return
      }
      if (!response.success) throw new Error(response.message)
      onSaved()
    } catch (error) {
      addNotification({
        message: t('Failed to save the GFX override: {{error}}', { error: error instanceof Error ? error.message : t('Unknown error') }),
        type: 'error',
      })
      setSaving(false)
    }
  }

  return (
    <StyledModal
      title={t('Set AMD GFX Override')}
      onConfirm={save}
      onCancel={onCancel}
      open={true}
      confirmText={t('Save and Reinstall')}
      cancelText={t('Cancel')}
      confirmLoading={saving}
      confirmDisabled={!valid || saving}
    >
      <div className="space-y-4 text-text-primary">
        <p>
          {t('ROCm ships GPU kernels for a fixed list of AMD chips. Integrated Radeon GPUs outside that list run on CPU unless ROCm treats them as a supported chip, set through HSA_OVERRIDE_GFX_VERSION.')}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Radeon 780M / 760M (gfx1103): 11.0.0</li>
          <li>{t('Radeon 680M / 660M and other RDNA 2 iGPUs (gfx1031 to gfx1036): 10.3.0')}</li>
        </ul>
        <p className="text-sm text-text-secondary">
          {t('Detected GPU: {{gpu}}. Current override: {{override}}.', {
            gpu: gpuHealth.amdGfxTarget ?? t('not reported by Ollama'),
            override: gpuHealth.currentHsaOverride ?? t('none'),
          })}
          {gpuHealth.suggestedHsaOverride
            ? ` ${t('Recommended for this GPU: {{value}}.', { value: gpuHealth.suggestedHsaOverride })}`
            : ''}
        </p>
        <Input
          name="amdHsaOverride"
          label={t('GFX version override')}
          placeholder="11.0.0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={value.trim() !== '' && !valid}
          helpText={t('Saving recreates the {{name}} container with this override. Downloaded models are preserved.', { name: assistantName })}
        />
      </div>
    </StyledModal>
  )
}
