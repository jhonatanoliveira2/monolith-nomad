/**
 * The manifest to use between the one cached from GitHub and the one shipped in the image: the higher
 * `spec_version` (ISO dates, so string order is date order); the cached one on a tie or when the
 * bundled one is missing. An image built from newer content than the branch it fetches from (before a
 * push, a fork, a dev branch) would otherwise swap its own catalog for an older one as soon as it is
 * online. A newer manifest on GitHub still wins, so published fixes keep reaching installs.
 */
export function newestSpec<T>(cached: T | null, bundled: T | null): T | null {
  if (!bundled) return cached
  if (!cached) return bundled
  const version = (spec: T) => String((spec as { spec_version?: unknown }).spec_version ?? '')
  return version(bundled) > version(cached) ? bundled : cached
}
