import PageHeader from '~/components/nd/PageHeader'
import { Head } from '@inertiajs/react'
import SettingsLayout from '~/layouts/SettingsLayout'
import { SystemInformationResponse } from '../../../types/system'
import { formatBytes } from '~/lib/util'
import { getAllDiskDisplayItems } from '~/hooks/use_disk_display_data'
import CircularGauge from '~/components/systeminfo/CircularGauge'
import HorizontalBarChart from '~/components/HorizontalBarChart'
import InfoCard from '~/components/systeminfo/InfoCard'
import Alert from '~/components/Alert'
import GpuPassthroughAlert from '~/components/GpuPassthroughAlert'
import { useSystemInfo } from '~/hooks/use_system_info'
import StatusCard from '~/components/systeminfo/StatusCard'
import {
  IconCpu,
  IconDatabase,
  IconServer,
  IconDeviceDesktop,
  IconComponents,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '~/lib/format'

export default function SettingsPage(props: {
  system: { info: SystemInformationResponse | undefined }
}) {
  const { t } = useTranslation()
  const { data: info } = useSystemInfo({
    initialData: props.system.info,
  })

  // Use (total - available) to reflect actual memory pressure.
  // mem.used includes reclaimable buff/cache on Linux, which inflates the number.
  const memoryUsed =
    info?.mem.total && info?.mem.available != null
      ? info.mem.total - info.mem.available
      : info?.mem.used || 0
  const memoryUsagePercent = info?.mem.total ? ((memoryUsed / info.mem.total) * 100).toFixed(1) : 0

  const swapUsagePercent = info?.mem.swaptotal
    ? ((info.mem.swapused / info.mem.swaptotal) * 100).toFixed(1)
    : 0

  const uptimeSeconds = info?.uptime.uptime || 0
  const uptimeDays = Math.floor(uptimeSeconds / 86400)
  const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600)
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60)
  const uptimeDisplay =
    uptimeDays > 0
      ? `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`
      : uptimeHours > 0
        ? `${uptimeHours}h ${uptimeMinutes}m`
        : `${uptimeMinutes}m`

  // Build storage display items - fall back to fsSize when disk array is empty
  const storageItems = getAllDiskDisplayItems(info?.disk, info?.fsSize)

  return (
    <SettingsLayout>
      <Head title={t('System Information')} />
      <div className="w-full">
        <div className="nd-page">
          <PageHeader
            eyebrow={t('System')}
            title={t('System Information')}
            description={t(
              'Real-time monitoring and diagnostics • Last updated: {{date}} • Refreshing data every 30 seconds',
              { date: formatDateTime(new Date()) }
            )}
          />
          {Number(memoryUsagePercent) > 90 && (
            <div className="mb-6">
              <Alert
                type="error"
                title={t('Very High Memory Usage Detected')}
                message={t('System memory usage exceeds 90%. Performance degradation may occur.')}
                variant="bordered"
              />
            </div>
          )}
          <section className="mb-12">
            <h2 className="text-xl font-medium text-text-primary mb-5 flex items-center gap-3">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
              {t('Resource Usage')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-desert-white rounded-xl p-6 border border-desert-stone-light ">
                <CircularGauge
                  value={info?.currentLoad.currentLoad || 0}
                  label={t('CPU Usage')}
                  scale="usage"
                  size="lg"
                  variant="cpu"
                  subtext={t('{{count}} cores', { count: info?.cpu.cores || 0 })}
                  icon={<IconCpu className="w-8 h-8" />}
                />
              </div>
              <div className="bg-desert-white rounded-xl p-6 border border-desert-stone-light ">
                <CircularGauge
                  value={Number(memoryUsagePercent)}
                  label={t('Memory Usage')}
                  scale="usage"
                  size="lg"
                  variant="memory"
                  subtext={`${formatBytes(memoryUsed)} / ${formatBytes(info?.mem.total || 0)}`}
                  icon={<IconDatabase className="w-8 h-8" />}
                />
              </div>
              <div className="bg-desert-white rounded-xl p-6 border border-desert-stone-light ">
                <CircularGauge
                  value={Number(swapUsagePercent)}
                  label={t('Swap Usage')}
                  scale="usage"
                  size="lg"
                  variant="disk"
                  subtext={`${formatBytes(info?.mem.swapused || 0)} / ${formatBytes(info?.mem.swaptotal || 0)}`}
                  icon={<IconServer className="w-8 h-8" />}
                />
              </div>
            </div>
          </section>
          <section className="mb-12">
            <h2 className="text-xl font-medium text-text-primary mb-5 flex items-center gap-3">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
              {t('System Details')}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <InfoCard
                title={t('Operating System')}
                icon={<IconDeviceDesktop className="w-6 h-6" />}
                variant="elevated"
                data={[
                  { label: t('Distribution'), value: info?.os.distro },
                  { label: t('Kernel Version'), value: info?.os.kernel },
                  { label: t('Architecture'), value: info?.os.arch },
                  { label: t('Hostname'), value: info?.os.hostname },
                  { label: t('Platform'), value: info?.os.platform },
                ]}
              />
              <InfoCard
                title={t('Processor')}
                icon={<IconCpu className="w-6 h-6" />}
                variant="elevated"
                data={[
                  { label: t('Manufacturer'), value: info?.cpu.manufacturer },
                  { label: t('Brand'), value: info?.cpu.brand },
                  { label: t('Cores'), value: info?.cpu.cores },
                  { label: t('Physical Cores'), value: info?.cpu.physicalCores },
                  {
                    label: t('Virtualization'),
                    value: info?.cpu.virtualization ? t('Enabled') : t('Disabled'),
                  },
                ]}
              />
              {info?.gpuHealth?.status === 'unsupported' && (
                <div className="lg:col-span-2">
                  <Alert
                    type="info"
                    title={t('No GPU acceleration available')}
                    message={
                      info.gpuHealth.gpuVendor === 'intel'
                        ? t(
                            'An Intel GPU is present, but monolith-nomad can only accelerate the AI Assistant on NVIDIA (CUDA) and AMD (ROCm) hardware. Inference will run on the CPU, so expect lower throughput than the hardware suggests.'
                          )
                        : t(
                            'A GPU is present, but monolith-nomad can only accelerate the AI Assistant on NVIDIA (CUDA) and AMD (ROCm) hardware. Inference will run on the CPU, so expect lower throughput than the hardware suggests.'
                          )
                    }
                    variant="bordered"
                  />
                </div>
              )}
              {info?.gpuHealth?.status === 'passthrough_failed' && (
                <div className="lg:col-span-2">
                  <GpuPassthroughAlert
                    gpuHealth={info.gpuHealth}
                    assistantName={t('AI Assistant')}
                  />
                </div>
              )}
              {info?.graphics?.controllers && info.graphics.controllers.length > 0 && (
                <InfoCard
                  title={t('Graphics')}
                  icon={<IconComponents className="w-6 h-6" />}
                  variant="elevated"
                  data={info.graphics.controllers
                    .map((gpu, i) => {
                      const prefix = info.graphics.controllers.length > 1 ? `GPU ${i + 1} ` : ''
                      return [
                        { label: `${prefix}${t('Model')}`, value: gpu.model },
                        { label: `${prefix}${t('Vendor')}`, value: gpu.vendor },
                        { label: `${prefix}VRAM`, value: gpu.vram ? `${gpu.vram} MB` : t('N/A') },
                      ]
                    })
                    .flat()}
                />
              )}
            </div>
          </section>
          <section className="mb-12">
            <h2 className="text-xl font-medium text-text-primary mb-5 flex items-center gap-3">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
              {t('Memory Allocation')}
            </h2>
            <div className="nd-card p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="text-center">
                  <div className="nd-display text-4xl text-text-primary mb-2">
                    {formatBytes(info?.mem.total || 0)}
                  </div>
                  <div className="nd-eyebrow">{t('Total RAM')}</div>
                </div>
                <div className="text-center">
                  <div className="nd-display text-4xl text-text-primary mb-2">
                    {formatBytes(memoryUsed)}
                  </div>
                  <div className="nd-eyebrow">{t('Used RAM')}</div>
                </div>
                <div className="text-center">
                  <div className="nd-display text-4xl text-text-primary mb-2">
                    {formatBytes(info?.mem.available || 0)}
                  </div>
                  <div className="nd-eyebrow">{t('Available RAM')}</div>
                </div>
              </div>
              {/* same usage scale as the dashboard meters: neutral, orange from 70 %, red from 90 % */}
              <div className="flex items-center gap-4">
                <div
                  className="relative h-2 flex-1 overflow-hidden rounded-full bg-led-off"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Number(memoryUsagePercent)}
                  aria-label={t('Memory usage')}
                >
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${
                      Number(memoryUsagePercent) >= 90
                        ? 'bg-desert-red'
                        : Number(memoryUsagePercent) >= 70
                          ? 'bg-desert-orange'
                          : 'bg-led'
                    }`}
                    style={{ width: `${memoryUsagePercent}%` }}
                  />
                </div>
                <span className="nd-mono text-sm text-text-primary shrink-0">
                  {t('{{percent}}% Utilized', { percent: memoryUsagePercent })}
                </span>
              </div>
            </div>
          </section>
          <section className="mb-12">
            <h2 className="text-xl font-medium text-text-primary mb-5 flex items-center gap-3">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
              {t('Storage Devices')}
            </h2>

            <div className="nd-card p-8">
              {storageItems.length > 0 ? (
                <HorizontalBarChart
                  items={storageItems}
                  progressiveBarColor={true}
                  statuses={[
                    {
                      label: t('Normal'),
                      min_threshold: 0,
                      color_class: 'bg-desert-olive',
                    },
                    {
                      label: t('Warning - Usage High'),
                      min_threshold: 75,
                      color_class: 'bg-desert-orange',
                    },
                    {
                      label: t('Critical - Disk Almost Full'),
                      min_threshold: 90,
                      color_class: 'bg-desert-red',
                    },
                  ]}
                />
              ) : (
                <div className="text-center text-desert-stone-dark py-8">
                  {t('No storage devices detected')}
                </div>
              )}
            </div>
          </section>
          <section>
            <h2 className="text-xl font-medium text-text-primary mb-5 flex items-center gap-3">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
              {t('System Status')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatusCard title={t('System Uptime')} value={uptimeDisplay} />
              <StatusCard title={t('CPU Cores')} value={info?.cpu.cores || 0} />
              <StatusCard title={t('Storage Devices')} value={storageItems.length} />
            </div>
          </section>
        </div>
      </div>
    </SettingsLayout>
  )
}
