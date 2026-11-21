import * as assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'

import { applyDrmVram, readDrmGpus, type DrmGpu } from '../../app/utils/gpu_sysfs.js'

const roots: string[] = []
after(async () => {
  await Promise.all(roots.map((r) => rm(r, { recursive: true, force: true })))
})

/**
 * Build a fake sysfs tree with the real layout: /sys/class/drm/cardN is a
 * symlink whose `device` link resolves to the PCI device directory, so the bus
 * address is only knowable by resolving it.
 */
async function fakeSys(
  cards: Array<{ card: string; bdf: string; vendor: string; device: string; vram?: string }>,
  extraEntries: string[] = []
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'gpu-sysfs-'))
  roots.push(root)
  await mkdir(path.join(root, 'class/drm'), { recursive: true })
  for (const c of cards) {
    const pciDir = path.join(root, 'devices/pci0000:00', c.bdf)
    const drmDir = path.join(pciDir, 'drm', c.card)
    await mkdir(drmDir, { recursive: true })
    await writeFile(path.join(pciDir, 'vendor'), `${c.vendor}\n`)
    await writeFile(path.join(pciDir, 'device'), `${c.device}\n`)
    if (c.vram !== undefined)
      await writeFile(path.join(pciDir, 'mem_info_vram_total'), `${c.vram}\n`)
    await symlink(pciDir, path.join(drmDir, 'device'))
    await symlink(drmDir, path.join(root, 'class/drm', c.card))
  }
  for (const e of extraEntries) {
    await mkdir(path.join(root, 'class/drm', e), { recursive: true })
  }
  return root
}

test('reads the real VRAM of an amdgpu card from sysfs', async () => {
  // The reported case: an RX 9060 XT 16 GB that lspci showed as 512 MB, its BAR0
  // aperture with Resizable BAR off.
  const root = await fakeSys(
    [
      {
        card: 'card1',
        bdf: '0000:0a:00.0',
        vendor: '0x1002',
        device: '0x7590',
        vram: '17095983104',
      },
    ],
    ['card1-DP-1', 'card1-HDMI-A-1', 'renderD128', 'version']
  )
  assert.deepEqual(await readDrmGpus(root), [
    { busAddress: '0a:00.0', vendorId: '1002', deviceId: '7590', vramMiB: 16304 },
  ])
})

test('a card without mem_info_vram_total reports null VRAM', async () => {
  // The NVIDIA proprietary driver and i915 do not expose the file.
  const root = await fakeSys([
    { card: 'card0', bdf: '0000:01:00.0', vendor: '0x10de', device: '0x2d05' },
  ])
  assert.deepEqual(await readDrmGpus(root), [
    { busAddress: '01:00.0', vendorId: '10de', deviceId: '2d05', vramMiB: null },
  ])
})

test('garbage or zero VRAM is ignored', async () => {
  const root = await fakeSys([
    { card: 'card0', bdf: '0000:03:00.0', vendor: '0x1002', device: '0x744c', vram: 'nope' },
    { card: 'card1', bdf: '0000:04:00.0', vendor: '0x1002', device: '0x744c', vram: '0' },
  ])
  const gpus = await readDrmGpus(root)
  assert.deepEqual(
    gpus.map((g) => g.vramMiB),
    [null, null]
  )
})

test('a missing sysfs tree yields an empty list instead of throwing', async () => {
  assert.deepEqual(await readDrmGpus('/nonexistent-sysfs-root'), [])
})

test('applyDrmVram replaces the lspci BAR reading on the matching bus address', () => {
  const controllers = [
    {
      model: 'Device 7590',
      vendor: 'Advanced Micro Devices, Inc. [AMD/ATI]',
      busAddress: '0a:00.0',
      vram: 512 as number | null,
      vramDynamic: false,
    },
    {
      model: 'Raphael',
      vendor: 'Advanced Micro Devices, Inc. [AMD/ATI]',
      busAddress: '10:00.0',
      vram: 256 as number | null,
      vramDynamic: false,
    },
  ]
  const drm: DrmGpu[] = [
    { busAddress: '0a:00.0', vendorId: '1002', deviceId: '7590', vramMiB: 16304 },
  ]
  const corrected = applyDrmVram(controllers, drm)
  assert.equal(controllers[0].vram, 16304)
  assert.equal(controllers[1].vram, 256, 'unmatched controller untouched')
  assert.deepEqual([...corrected], [controllers[0]])
})

test('applyDrmVram matches bus addresses that carry a PCI domain or different case', () => {
  const controllers = [{ busAddress: '0000:0A:00.0', vram: 512 as number | null }]
  applyDrmVram(controllers, [
    { busAddress: '0a:00.0', vendorId: '1002', deviceId: '7590', vramMiB: 8176 },
  ])
  assert.equal(controllers[0].vram, 8176)
})

test('applyDrmVram leaves the reading alone when sysfs has no VRAM for the card', () => {
  const controllers = [{ busAddress: '01:00.0', vram: 32 as number | null }]
  const corrected = applyDrmVram(controllers, [
    { busAddress: '01:00.0', vendorId: '10de', deviceId: '2d05', vramMiB: null },
  ])
  assert.equal(controllers[0].vram, 32)
  assert.equal(corrected.size, 0)
})

test('applyDrmVram tolerates controllers without a bus address', () => {
  const controllers = [
    { busAddress: undefined, vram: 512 as number | null },
    { vram: 1 as number | null },
  ]
  applyDrmVram(controllers, [
    { busAddress: '0a:00.0', vendorId: '1002', deviceId: '7590', vramMiB: 16304 },
  ])
  assert.deepEqual(
    controllers.map((c) => c.vram),
    [512, 1]
  )
})
