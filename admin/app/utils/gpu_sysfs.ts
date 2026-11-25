import { readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

/** One DRM card as the kernel describes it under /sys/class/drm. */
export interface DrmGpu {
  /** PCI bus address without the domain, lowercase, e.g. "0a:00.0". */
  busAddress: string
  /** PCI vendor id without the 0x prefix, e.g. "1002". */
  vendorId: string
  /** PCI device id without the 0x prefix, e.g. "7590". */
  deviceId: string
  /** Real VRAM in MiB, or null when the driver doesn't publish it. */
  vramMiB: number | null
}

const CARD_ENTRY = /^card\d+$/

/** "0000:0A:00.0" and "0a:00.0" are the same device; compare without domain or case. */
function normalizeBusAddress(addr: string): string {
  const s = addr.trim().toLowerCase()
  const m = s.match(/([0-9a-f]{2}:[0-9a-f]{2}\.[0-7])$/)
  return m ? m[1] : s
}

async function readTrimmed(file: string): Promise<string | null> {
  try {
    const raw = await readFile(file, 'utf8')
    return raw.trim()
  } catch {
    return null
  }
}

/**
 * List the GPUs the kernel knows about, with the VRAM their driver reports.
 *
 * Why this exists: si.graphics() on Linux reads `vram` from lspci, and lspci
 * has no VRAM figure at all — systeminformation takes the size of the first
 * PCI memory region instead. On an AMD card that region is the CPU's window
 * into VRAM, so it equals the real VRAM only with Resizable BAR on; with it off
 * an RX 9060 XT 16 GB reports 256 or 512 MB. amdgpu publishes the true size in
 * `mem_info_vram_total`, and sysfs is visible inside the admin container
 * without any extra mount, so this is authoritative whether or not Ollama is
 * installed.
 *
 * The NVIDIA proprietary driver and i915 don't publish the file; those cards
 * come back with vramMiB null and callers keep whatever else they had.
 *
 * Never throws: a missing or unreadable sysfs (non-Linux, locked-down
 * container) yields an empty list.
 */
export async function readDrmGpus(sysRoot = '/sys'): Promise<DrmGpu[]> {
  let entries: string[]
  try {
    entries = await readdir(path.join(sysRoot, 'class/drm'))
  } catch {
    return []
  }

  const gpus: DrmGpu[] = []
  const seen = new Set<string>()
  for (const entry of entries.filter((e) => CARD_ENTRY.test(e)).sort()) {
    const deviceDir = path.join(sysRoot, 'class/drm', entry, 'device')
    let resolved: string
    try {
      resolved = await realpath(deviceDir)
    } catch {
      continue
    }
    const busAddress = normalizeBusAddress(path.basename(resolved))
    if (seen.has(busAddress)) continue
    seen.add(busAddress)

    const [vendor, device, vramRaw] = await Promise.all([
      readTrimmed(path.join(deviceDir, 'vendor')),
      readTrimmed(path.join(deviceDir, 'device')),
      readTrimmed(path.join(deviceDir, 'mem_info_vram_total')),
    ])
    const vramBytes = vramRaw !== null && /^\d+$/.test(vramRaw) ? Number(vramRaw) : 0
    gpus.push({
      busAddress,
      vendorId: (vendor ?? '').replace(/^0x/i, '').toLowerCase(),
      deviceId: (device ?? '').replace(/^0x/i, '').toLowerCase(),
      vramMiB: vramBytes > 0 ? Math.round(vramBytes / (1024 * 1024)) : null,
    })
  }
  return gpus
}

/**
 * Overwrite each controller's lspci-derived `vram` with the driver's figure
 * from sysfs, matched by PCI bus address. Mutates in place.
 *
 * Returns the controllers that were corrected, so the caller can exempt them
 * from heuristics that exist only to second-guess lspci (an APU whose real
 * carve-out is 128 MiB must not be nulled as a "bogus BAR reading").
 */
export function applyDrmVram<T extends { busAddress?: string; vram?: number | null }>(
  controllers: T[],
  drmGpus: DrmGpu[]
): Set<T> {
  const byBus = new Map(drmGpus.map((g) => [g.busAddress, g]))
  const corrected = new Set<T>()
  for (const c of controllers) {
    if (!c.busAddress) continue
    const drm = byBus.get(normalizeBusAddress(c.busAddress))
    if (drm?.vramMiB) {
      c.vram = drm.vramMiB
      corrected.add(c)
    }
  }
  return corrected
}

/** Live counters amdgpu publishes for one card; any field the driver omits is null. */
export interface DrmGpuTelemetry {
  busAddress: string
  vendorId: string
  deviceId: string
  /** Shader engine busy time over the driver's last sample, 0–100. */
  busyPercent: number | null
  vramUsedMiB: number | null
  vramTotalMiB: number | null
  /** System memory the GPU has mapped (GTT): grows when a model spills out of VRAM. */
  gttUsedMiB: number | null
  /** Edge temperature in °C (hwmon temp1). */
  temperatureC: number | null
  /** Average board power in W (hwmon power1_average). */
  powerW: number | null
  /** Current shader clock in MHz (hwmon freq1). */
  shaderClockMHz: number | null
}

const toMiB = (raw: string | null) =>
  raw !== null && /^\d+$/.test(raw) ? Math.round(Number(raw) / (1024 * 1024)) : null
const toNumber = (raw: string | null) => (raw !== null && /^-?\d+$/.test(raw) ? Number(raw) : null)

/**
 * Sample the live GPU counters from sysfs (amdgpu: gpu_busy_percent, mem_info_*, hwmon). Read
 * straight from the files, so it works inside the admin container with no extra mount and costs a
 * few small reads, cheap enough to poll every couple of seconds. Never throws.
 */
export async function readDrmGpuTelemetry(sysRoot = '/sys'): Promise<DrmGpuTelemetry[]> {
  const gpus = await readDrmGpus(sysRoot)
  let entries: string[]
  try {
    const all = await readdir(path.join(sysRoot, 'class/drm'))
    entries = all.filter((e) => CARD_ENTRY.test(e))
  } catch {
    return []
  }
  const out: DrmGpuTelemetry[] = []
  for (const entry of entries.sort()) {
    const deviceDir = path.join(sysRoot, 'class/drm', entry, 'device')
    let resolved: string
    try {
      resolved = await realpath(deviceDir)
    } catch {
      continue
    }
    const busAddress = normalizeBusAddress(path.basename(resolved))
    const base = gpus.find((g) => g.busAddress === busAddress)
    if (!base || out.some((g) => g.busAddress === busAddress)) continue

    let hwmonDir: string | null = null
    try {
      const hwmons = await readdir(path.join(deviceDir, 'hwmon'))
      const hw = hwmons.sort()[0]
      if (hw) hwmonDir = path.join(deviceDir, 'hwmon', hw)
    } catch {}

    const [busy, vramUsed, vramTotal, gttUsed, temp, power, freq] = await Promise.all([
      readTrimmed(path.join(deviceDir, 'gpu_busy_percent')),
      readTrimmed(path.join(deviceDir, 'mem_info_vram_used')),
      readTrimmed(path.join(deviceDir, 'mem_info_vram_total')),
      readTrimmed(path.join(deviceDir, 'mem_info_gtt_used')),
      hwmonDir ? readTrimmed(path.join(hwmonDir, 'temp1_input')) : Promise.resolve(null),
      hwmonDir ? readTrimmed(path.join(hwmonDir, 'power1_average')) : Promise.resolve(null),
      hwmonDir ? readTrimmed(path.join(hwmonDir, 'freq1_input')) : Promise.resolve(null),
    ])
    const tempMilli = toNumber(temp)
    const powerMicro = toNumber(power)
    const freqHz = toNumber(freq)
    out.push({
      busAddress,
      vendorId: base.vendorId,
      deviceId: base.deviceId,
      busyPercent: toNumber(busy),
      vramUsedMiB: toMiB(vramUsed),
      vramTotalMiB: toMiB(vramTotal),
      gttUsedMiB: toMiB(gttUsed),
      temperatureC: tempMilli !== null ? Math.round(tempMilli / 100) / 10 : null,
      powerW: powerMicro !== null ? Math.round(powerMicro / 100_000) / 10 : null,
      shaderClockMHz: freqHz !== null ? Math.round(freqHz / 1_000_000) : null,
    })
  }
  return out
}
