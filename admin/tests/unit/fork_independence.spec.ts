/**
 * Guard: installer, images and updates point at this distribution (monolith-nomad), never at the upstream
 * project's repository or images. A merge from upstream that brings a hard-coded upstream URL back fails here.
 *
 * Allowed upstream references are content dependencies only (constants/project.ts: UPSTREAM_MAPS_REPO).
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
const UPSTREAM = /crosstalk-solutions\/project-nomad(?!-maps)/i

test('project constants default to this fork and can be overridden by environment', async () => {
  const keys = [
    'NOMAD_GITHUB_REPO',
    'NOMAD_GITHUB_BRANCH',
    'NOMAD_IMAGE_NAMESPACE',
    'BENCHMARK_LEADERBOARD_URL',
    'RELEASE_NOTES_SUBSCRIBE_URL',
  ]
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
  for (const k of keys) delete process.env[k]
  try {
    const p = await import(
      // a query string makes Node evaluate the module again, with the environment set above
      // @ts-ignore TS cannot resolve a specifier with a query string
      '../../constants/project.js?defaults'
    )
    assert.equal(p.GITHUB_REPO, 'jhonatanoliveira2/monolith-nomad')
    assert.equal(p.NOMAD_IMAGE_REPO, 'ghcr.io/jhonatanoliveira2/project-nomad')
    assert.equal(
      p.GITHUB_RELEASES_API_URL,
      'https://api.github.com/repos/jhonatanoliveira2/monolith-nomad/releases'
    )
    assert.equal(
      p.GITHUB_RAW_BASE_URL,
      'https://raw.githubusercontent.com/jhonatanoliveira2/monolith-nomad/refs/heads/main'
    )
    assert.equal(p.BENCHMARK_LEADERBOARD_URL, '', 'upstream leaderboard off by default')
    assert.equal(p.RELEASE_NOTES_SUBSCRIBE_URL, '', 'upstream mailing list off by default')

    process.env.NOMAD_GITHUB_REPO = 'someone/other-fork'
    process.env.NOMAD_IMAGE_NAMESPACE = 'GHCR.IO/Someone'
    const o = await import(
      // a query string makes Node evaluate the module again, with the environment set above
      // @ts-ignore TS cannot resolve a specifier with a query string
      '../../constants/project.js?override'
    )
    assert.equal(
      o.GITHUB_RELEASES_API_URL,
      'https://api.github.com/repos/someone/other-fork/releases'
    )
    assert.equal(
      o.NOMAD_IMAGE_REPO,
      'ghcr.io/someone/project-nomad',
      'image namespace is lower-cased for ghcr'
    )
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
})

test('the update path (releases + admin image) never uses the upstream project', () => {
  for (const f of [
    'admin/app/services/auto_update_service.ts',
    'admin/app/services/system_service.ts',
  ]) {
    assert.doesNotMatch(read(f), UPSTREAM, `${f} must use constants/project.ts`)
  }
  assert.doesNotMatch(read('admin/app/services/collection_manifest_service.ts'), UPSTREAM)
  assert.doesNotMatch(read('admin/app/services/docker_service.ts'), UPSTREAM)
})

test('installer scripts download from this repository', () => {
  for (const f of [
    'install/install_nomad.sh',
    'install/run_updater_fixes.sh',
    'install/migrate-disk-collector.sh',
  ]) {
    assert.doesNotMatch(read(f), UPSTREAM, f)
  }
  const installer = read('install/install_nomad.sh')
  assert.match(
    installer,
    /NOMAD_GITHUB_REPO="\$\{NOMAD_GITHUB_REPO:-jhonatanoliveira2\/monolith-nomad\}"/
  )
  assert.match(
    installer,
    /MANAGEMENT_COMPOSE_FILE_URL="\$\{NOMAD_RAW_BASE_URL\}\/install\/management_compose\.yaml"/
  )
})

test('compose and updater use this distribution’s images', () => {
  const compose = read('install/management_compose.yaml')
  const images = [...compose.matchAll(/^\s+image:\s*(\S+)/gm)].map((m) => m[1])
  const own = images.filter((i) => i.includes('project-nomad'))
  assert.deepEqual(own, [
    'ghcr.io/jhonatanoliveira2/project-nomad:latest',
    'ghcr.io/jhonatanoliveira2/project-nomad-sidecar-updater:latest',
    'ghcr.io/jhonatanoliveira2/project-nomad-disk-collector:latest',
  ])
  const watcher = read('install/sidecar-updater/update-watcher.sh')
  assert.doesNotMatch(watcher, /crosstalk/i)
  assert.match(watcher, /NOMAD_IMAGE_REPO:-ghcr\.io\/jhonatanoliveira2\/project-nomad\}/)
})

test('CI publishes images to the repository owner’s namespace', () => {
  for (const wf of [
    'build-primary-image',
    'build-sidecar-updater',
    'build-disk-collector',
    'build-translate-proxy',
  ]) {
    const s = read(`.github/workflows/${wf}.yml`)
    assert.doesNotMatch(s, /crosstalk/i, wf)
    assert.match(s, /IMAGE_NS=ghcr\.io\/\$\{GITHUB_REPOSITORY_OWNER,,\}/, wf)
  }
})

test('the image is not labelled as the upstream project’s official image', () => {
  const docker = read('Dockerfile')
  assert.doesNotMatch(docker, /Official Docker image/i)
  assert.match(
    docker,
    /org\.opencontainers\.image\.source="https:\/\/github\.com\/jhonatanoliveira2\/monolith-nomad"/
  )
})

test('workflow expressions are not nested: ${{ }} inside a string literal of another ${{ }} is never expanded', () => {
  const dir = path.join(ROOT, '.github/workflows')
  for (const name of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    readFileSync(path.join(dir, name), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        assert.doesNotMatch(
          line,
          /\$\{\{(?:(?!\}\}).)*\$\{\{/,
          `${name}:${i + 1} nests an expression`
        )
      })
  }
})
