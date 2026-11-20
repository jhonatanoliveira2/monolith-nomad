#!/usr/bin/env node
/**
 * Runs the unit specs with the runner each one needs (tests/unit mixes two kinds):
 *
 *   node scripts/run_tests.mjs unit   plain `node --test` specs (pure functions, no services): fast, no setup
 *   node scripts/run_tests.mjs app    specs that need the booted AdonisJS app (`node ace test`): the Japa specs
 *                                     and the node:test specs listed in APP_NODE_SPECS. Booting the app needs
 *                                     MySQL (migrated) and Redis; scripts/test-in-docker.sh provides both.
 *
 * Extra arguments are passed to the underlying runner. Exit code: the runner's.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ADMIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const UNIT_DIR = path.join(ADMIN, 'tests/unit')

/** node:test specs whose imports need a booted app (services that import AdonisJS services at module scope). */
export const APP_NODE_SPECS = ['app_auto_update.spec.ts', 'content_auto_update.spec.ts']

export function classify(name, source) {
  if (/from ['"]@japa\/runner['"]/.test(source)) return 'app'
  if (APP_NODE_SPECS.includes(name)) return 'app'
  return 'unit'
}

function specs(kind) {
  return readdirSync(UNIT_DIR)
    .filter((f) => f.endsWith('.spec.ts'))
    .filter((f) => classify(f, readFileSync(path.join(UNIT_DIR, f), 'utf8')) === kind)
    .sort()
    .map((f) => `tests/unit/${f}`)
}

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { cwd: ADMIN, stdio: 'inherit', env: { ...process.env, ...env } })
  if (r.error) throw r.error
  return r.status ?? 1
}

const [kind, ...extra] = process.argv.slice(2)
if (kind === 'unit') {
  process.exit(
    run(process.execPath, [
      '--env-file=.env.test',
      '--import',
      'ts-node-maintained/register/esm',
      '--test',
      '--test-reporter=spec',
      ...extra,
      ...specs('unit'),
    ])
  )
} else if (kind === 'app') {
  const files = specs('app').flatMap((f) => ['--files', f])
  process.exit(
    run(process.execPath, ['ace', 'test', 'unit', ...files, ...extra], { NODE_ENV: 'test' })
  )
} else if (kind === 'list') {
  for (const k of ['unit', 'app']) console.log(`${k}:\n  ${specs(k).join('\n  ')}`)
} else {
  console.error('usage: node scripts/run_tests.mjs unit|app|list [runner args]')
  process.exit(2)
}
