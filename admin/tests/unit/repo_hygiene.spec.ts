/**
 * Repository hygiene for this distribution: supply chain of the workflows, no secrets or identity of the
 * original project in the release pipeline, personal session files kept out of git, and the Apache-2.0 §4(b)
 * notice of modified files kept complete. Git-dependent checks are skipped when git or the base commit is not
 * available (e.g. a tarball or a shallow clone).
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
/** The upstream commit this distribution is based on (Project N.O.M.A.D. 1.35.2-rc.1). */
const BASE = 'f633b36'

function git(...args: string[]) {
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
}
const hasBase = git('cat-file', '-e', `${BASE}^{commit}`).status === 0

const workflows = readdirSync(path.join(ROOT, '.github/workflows')).filter((f) =>
  /\.ya?ml$/.test(f)
)

test('every GitHub Action is pinned to a full commit SHA (tags can be moved)', () => {
  const unpinned: string[] = []
  for (const name of workflows) {
    read(`.github/workflows/${name}`)
      .split('\n')
      .forEach((line, i) => {
        const m = /^\s*-?\s*uses:\s*([^\s#]+)/.exec(line)
        if (!m || m[1].startsWith('./')) return
        if (!/@[0-9a-f]{40}$/.test(m[1])) unpinned.push(`${name}:${i + 1} ${m[1]}`)
        else if (!/#\s*v\d+\.\d+\.\d+/.test(line))
          unpinned.push(`${name}:${i + 1} missing "# vX.Y.Z" comment`)
      })
  }
  assert.deepEqual(unpinned, [])
})

test('the release workflow uses no secret, bot identity or service of the original project', () => {
  const release = read('.github/workflows/release.yml')
  for (const forbidden of [
    'COSMISTACKBOT_ACCESS_TOKEN',
    'DEPLOYMENT_AUTHORIZED_USERS',
    'cosmistack',
    'NOMAD_API_KEY',
    'projectnomad.us',
    'x-access-token:',
  ]) {
    assert.ok(!release.includes(forbidden), `release.yml still mentions ${forbidden}`)
  }
  // only the repository owner may release: compared in the shell, with the values passed through env
  assert.match(release, /ACTOR: \$\{\{ github\.triggering_actor \}\}/)
  assert.match(release, /OWNER: \$\{\{ github\.repository_owner \}\}/)
  assert.match(release, /"\$ACTOR" == "\$OWNER"/, 'only the owner may release')
  assert.match(release, /secrets\.GITHUB_TOKEN/)
  assert.match(release, /^permissions:/m, 'explicit token permissions')
  // expressions reach shell steps through env:, never interpolated into the script text
  const lines = release.split('\n')
  lines.forEach((line, i) => {
    const run = /^(\s*)(?:- )?run:\s*(.*)$/.exec(line)
    if (!run) return
    const script = [run[2]]
    for (let j = i + 1; j < lines.length; j++) {
      const indent = /^(\s*)\S/.exec(lines[j])?.[1].length
      if (indent !== undefined && indent <= run[1].length) break
      script.push(lines[j])
    }
    assert.doesNotMatch(
      script.join('\n'),
      /\$\{\{/,
      `expression interpolated into the run script at line ${i + 1}`
    )
  })
  assert.match(
    release,
    /git pull --ff-only origin main/,
    'no merge commit on top of the release commit'
  )
  assert.match(release, /git push origin HEAD:main/, 'explicit ref on push')
  assert.ok(
    release.indexOf('gh auth setup-git') < release.indexOf('git pull'),
    'credentials are set up before the first git operation that may need them'
  )
})

test('personal session files are ignored by git; the test environment file is not', (t) => {
  if (git('rev-parse', '--git-dir').status !== 0) return t.skip('not a git checkout')
  for (const file of ['CLAUDE.md', 'ORIGINAL_PROMPT.md', 'SESSION_CONTEXT.md']) {
    assert.equal(git('check-ignore', '-q', file).status, 0, `${file} must be ignored`)
  }
  assert.notEqual(
    git('check-ignore', '-q', 'admin/.env.test').status,
    0,
    'admin/.env.test must be committable'
  )
})

test('THIRD_PARTY_NOTICES states the §4(b) modification notice and the logo source licence', () => {
  const notices = read('THIRD_PARTY_NOTICES.md')
  assert.match(notices, /MODIFICATIONS\.md/)
  assert.match(notices, /f633b36/)
  assert.match(
    notices,
    /PD-textlogo/,
    'licence of the Wikimedia Commons file the logo is derived from'
  )
  assert.match(notices, /derivad/i)
})

test('MODIFICATIONS.md lists every file changed since the upstream base commit (§4(b))', (t) => {
  if (!hasBase) return t.skip(`base commit ${BASE} not available`)
  const tracked = git('diff', '--name-only', '--no-renames', BASE, '--', '.')
  const untracked = git('ls-files', '--others', '--exclude-standard')
  assert.equal(tracked.status, 0)
  const expected = new Set(
    [...tracked.stdout.split('\n'), ...untracked.stdout.split('\n')]
      .map((f) => f.trim())
      .filter((f) => f && f !== 'MODIFICATIONS.md')
  )
  const listed = new Set(
    [...read('MODIFICATIONS.md').matchAll(/^\| [A-Za-z]+ \| `([^`]+)` \|$/gm)].map((m) => m[1])
  )
  const missing = [...expected].filter((f) => !listed.has(f)).sort()
  const stale = [...listed].filter((f) => !expected.has(f)).sort()
  assert.deepEqual(
    { missing, stale },
    { missing: [], stale: [] },
    'regenerate with: bash scripts/list-modifications.sh > MODIFICATIONS.md'
  )
})

test('every release ships the installer files, and the README installs from the latest release', () => {
  const releaserc = JSON.parse(read('.releaserc.json')) as { plugins: unknown[] }
  const github = releaserc.plugins.find(
    (p) => Array.isArray(p) && p[0] === '@semantic-release/github'
  ) as [string, { assets: { path: string }[] }] | undefined
  assert.ok(github, '@semantic-release/github configured with assets')
  const assets = github[1].assets.map((a) => a.path)
  for (const file of [
    'install/install_nomad.sh',
    'install/uninstall_nomad.sh',
    'install/management_compose.yaml',
  ]) {
    assert.ok(assets.includes(file), `${file} attached to every release`)
  }
  const readme = read('README.md')
  assert.match(readme, /releases\/latest\/download\/install_nomad\.sh/)
  assert.doesNotMatch(
    readme,
    /refs\/heads\/main\/install\//,
    'no install command from a moving branch'
  )
})

test('the GitHub release body is capped below the API limit (125,000 characters)', async () => {
  // same engine as @semantic-release/github (lodash template)
  const { default: template } = await import('lodash/template.js')
  const releaserc = JSON.parse(read('.releaserc.json')) as { plugins: unknown[] }
  const github = releaserc.plugins.find(
    (p) => Array.isArray(p) && p[0] === '@semantic-release/github'
  ) as [string, { releaseBodyTemplate?: string }]
  const body = github[1].releaseBodyTemplate
  assert.ok(body, 'releaseBodyTemplate set (the default is the raw notes)')
  const render = (notes: string) => template(body)({ nextRelease: { notes } })
  // the first release of the fork had 888 upstream commits in its notes (HttpError: body is too long)
  const huge = render('* fix: something\n'.repeat(20_000))
  assert.ok(huge.length < 125_000, `body has ${huge.length} characters`)
  assert.match(huge, /CHANGELOG\.md/)
  assert.equal(render('* fix: short notes'), '* fix: short notes')
})
