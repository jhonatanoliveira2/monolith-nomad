import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { newestSpec } from '../../app/utils/manifest_version.js'

const spec = (v: string) => ({ spec_version: v, items: [v] })

test('a bundled manifest newer than the cached one wins (image built ahead of the branch it fetches)', () => {
  assert.deepEqual(newestSpec(spec('2026-11-21'), spec('2026-11-24')), spec('2026-11-24'))
})

test('a newer manifest from GitHub still wins over the bundled copy', () => {
  assert.deepEqual(newestSpec(spec('2026-12-01'), spec('2026-11-24')), spec('2026-12-01'))
})

test('a tie keeps the cached manifest', () => {
  const cached = { spec_version: '2026-11-24', from: 'cache' }
  assert.equal(newestSpec(cached, { spec_version: '2026-11-24', from: 'image' }), cached)
})

test('either side may be missing', () => {
  assert.deepEqual(newestSpec(null, spec('2026-11-24')), spec('2026-11-24'))
  assert.deepEqual(newestSpec(spec('2026-11-21'), null), spec('2026-11-21'))
  assert.equal(newestSpec(null, null), null)
})
