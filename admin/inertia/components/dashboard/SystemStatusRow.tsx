import { useTranslation } from 'react-i18next'
import StatTile from '~/components/nd/StatTile'
import { getPrimaryDiskInfo } from '~/hooks/use_disk_display_data'
import useInternetStatus from '~/hooks/use_internet_status'
import { useSystemInfo } from '~/hooks/use_system_info'
import { formatBytes } from '~/lib/util'

/**
 * The four readings that answer "is the server fine?": connection, CPU, memory and storage. Each tile
 * links to the screen where the detail lives. Usage colours only appear from 70 %.
 */
export default function SystemStatusRow() {
  const { t } = useTranslation()
  const { isOnline } = useInternetStatus()
  const { data: info, isLoading } = useSystemInfo({})

  const cpu = info?.currentLoad?.currentLoad ?? 0
  const memUsed =
    info?.mem.total && info.mem.available != null
      ? info.mem.total - info.mem.available
      : (info?.mem.used ?? 0)
  const memPct = info?.mem.total ? (memUsed / info.mem.total) * 100 : 0
  const disk = getPrimaryDiskInfo(info?.disk, info?.fsSize)
  const diskPct = disk && disk.totalSize > 0 ? (disk.totalUsed / disk.totalSize) * 100 : 0

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label={t('Connection')}
        value={isOnline ? t('Online') : t('Offline')}
        status={isOnline ? 'ok' : 'warn'}
        hint={
          isOnline
            ? t('Downloads and updates available')
            : t('Installed content keeps working offline')
        }
        href="/settings/advanced"
      />
      <StatTile
        label={t('Processor')}
        value={Math.round(cpu)}
        unit="%"
        loading={isLoading && !info}
        meter={{ value: cpu, label: t('Processor usage') }}
        hint={
          info?.cpu
            ? t('{{count}} cores · {{brand}}', {
                count: info.cpu.cores,
                brand: info.cpu.brand,
              })
            : undefined
        }
        href="/settings/system"
      />
      <StatTile
        label={t('Memory')}
        value={Math.round(memPct)}
        unit="%"
        loading={isLoading && !info}
        meter={{ value: memPct, label: t('Memory usage') }}
        hint={
          info?.mem.total
            ? t('{{used}} of {{total}}', {
                used: formatBytes(memUsed, 1),
                total: formatBytes(info.mem.total, 1),
              })
            : undefined
        }
        href="/settings/system"
      />
      <StatTile
        label={t('Storage')}
        value={Math.round(diskPct)}
        unit="%"
        loading={isLoading && !info}
        meter={{ value: diskPct, label: t('Storage usage') }}
        hint={
          disk
            ? t('{{free}} free of {{total}}', {
                free: formatBytes(Math.max(0, disk.totalSize - disk.totalUsed), 1),
                total: formatBytes(disk.totalSize, 1),
              })
            : undefined
        }
        href="/settings/system"
      />
    </div>
  )
}
