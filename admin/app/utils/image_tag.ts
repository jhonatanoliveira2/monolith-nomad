/**
 * Docker image tags the system updater accepts: `latest`, or a release version (`1.35.2`, `v1.35.2`,
 * `v1.35.2-rc.1`). The tag is written to the sidecar's request file and interpolated into a `sed` that rewrites
 * compose.yml on the host (with the Docker socket), so anything else (`|`, `&`, `\`, spaces, newlines) is refused.
 *
 * The sidecar applies the same rule (install/sidecar-updater/update-watcher.sh, is_valid_image_tag); both are
 * checked against the same cases in tests/unit/image_tag.spec.ts.
 */
export const IMAGE_TAG_RE = /^(latest|v?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?)$/

export function isValidImageTag(tag: unknown): tag is string {
  return typeof tag === 'string' && tag.length <= 128 && IMAGE_TAG_RE.test(tag)
}
