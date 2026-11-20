/**
 * The system update's target tag ends up in a `sed` run on the host by the sidecar (with the Docker socket).
 * Both ends validate it with the same rule: the admin before writing the request (app/utils/image_tag.ts) and the
 * sidecar before touching compose.yml (is_valid_image_tag in install/sidecar-updater/update-watcher.sh).
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { isValidImageTag } from '../../app/utils/image_tag.js'

const WATCHER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../install/sidecar-updater/update-watcher.sh'
)

const VALID = ['latest', '1.35.2', 'v1.35.2', 'v1.35.2-rc.1', 'v2.0.0-beta.3']
const INVALID = [
  '',
  'v1.35',
  'main',
  'v1.35.2|x',
  'v1.35.2&& rm -rf /',
  'v1.35.2\\1',
  'v1.35.2 x',
  'v1.35.2\nimage: evil/image',
  'latest; reboot',
  '1.2.3$(id)',
]

/** Runs only the watcher's is_valid_image_tag function (the script's main loop is not executed). */
function watcherAccepts(tag: string): boolean {
  const r = spawnSync(
    'bash',
    [
      '-c',
      'source <(sed -n "/^is_valid_image_tag()/,/^}/p" "$1") && is_valid_image_tag "$2"',
      '_',
      WATCHER,
      tag,
    ],
    { encoding: 'utf8' }
  )
  assert.equal(r.error, undefined)
  return r.status === 0
}

test('the watcher validates the tag before rewriting compose.yml', () => {
  const script = readFileSync(WATCHER, 'utf8')
  assert.match(script, /^is_valid_image_tag\(\) \{/m, 'is_valid_image_tag is defined')
  const check = script.indexOf('is_valid_image_tag "$target_tag"')
  const sed = script.indexOf('sed -i "s|\\(image: ')
  assert.ok(check > 0, 'perform_update validates the tag')
  assert.ok(sed > check, 'the validation comes before the sed')
})

for (const tag of VALID) {
  test(`accepted on both ends: ${JSON.stringify(tag)}`, () => {
    assert.equal(isValidImageTag(tag), true)
    assert.equal(watcherAccepts(tag), true)
  })
}

for (const tag of INVALID) {
  test(`refused on both ends: ${JSON.stringify(tag)}`, () => {
    assert.equal(isValidImageTag(tag), false)
    assert.equal(watcherAccepts(tag), false)
  })
}

test('non-strings and oversized tags are refused by the admin', () => {
  assert.equal(isValidImageTag(undefined), false)
  assert.equal(isValidImageTag(123), false)
  assert.equal(isValidImageTag(`v1.0.0-${'a'.repeat(200)}`), false)
})
