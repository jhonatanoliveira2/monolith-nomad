/**
 * Where this distribution (monolith-nomad) lives: source repository, container images and update channel.
 *
 * Everything the app fetches from "the project" — release checks, the admin image tag applied on update,
 * curated catalogs (collections/*.json), the bundled mini Wikipedia ZIM — is derived from here, so installs
 * follow this fork and never pull the upstream project's code or images by accident.
 *
 * Every value can be overridden with an environment variable (set on the `admin` service in compose.yml)
 * so another fork only changes configuration, not code.
 *
 * Technical identifiers are intentionally unchanged (image base names `project-nomad*`, `/opt/project-nomad`,
 * `nomad_*` containers): renaming them would orphan containers and break the update path of existing installs.
 */
const read = (key: string): string => (process.env[key] || '').trim()

export const PROJECT_NAME = 'monolith-nomad'

/** owner/name on GitHub */
export const GITHUB_REPO = read('NOMAD_GITHUB_REPO') || 'jhonatanoliveira2/monolith-nomad'
export const GITHUB_BRANCH = read('NOMAD_GITHUB_BRANCH') || 'main'
/** Registry namespace of this project's images (ghcr requires lower case). */
export const IMAGE_NAMESPACE = (
  read('NOMAD_IMAGE_NAMESPACE') || 'ghcr.io/jhonatanoliveira2'
).toLowerCase()

export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`
export const GITHUB_RAW_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/refs/heads/${GITHUB_BRANCH}`
export const GITHUB_RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`

/** The admin/core image; the release tag is appended by the updater. */
export const NOMAD_IMAGE_REPO = `${IMAGE_NAMESPACE}/project-nomad`
export const NOMAD_TRANSLATE_IMAGE = `${IMAGE_NAMESPACE}/project-nomad-translate`

/**
 * Content still hosted by the upstream project (data, not code). This fork does not mirror it; it is listed
 * in THIRD_PARTY_NOTICES.md as an external dependency.
 * - project-nomad-maps: the curated regional .pmtiles files and the map base assets.
 */
export const UPSTREAM_MAPS_REPO = 'Crosstalk-Solutions/project-nomad-maps'

/**
 * Online services run by the upstream project. Off unless configured: this distribution does not send data
 * to, or depend on, servers it does not operate.
 * - BENCHMARK_LEADERBOARD_URL: community leaderboard (submit + stats). Upstream: https://benchmark.projectnomad.us
 * - RELEASE_NOTES_SUBSCRIBE_URL: e-mail list for release notes. Upstream:
 *   https://api.projectnomad.us/api/v1/lists/release-notes/subscribe
 * - NOMAD_API_URL (start/env.ts): curated AI model list; without it the bundled fallback list is used.
 */
export const BENCHMARK_LEADERBOARD_URL = read('BENCHMARK_LEADERBOARD_URL').replace(/\/+$/, '')
export const RELEASE_NOTES_SUBSCRIBE_URL = read('RELEASE_NOTES_SUBSCRIBE_URL')
