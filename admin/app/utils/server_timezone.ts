import { isValidTimezone } from '../../constants/brazil.js'

/** The zone the container started with (TZ from the compose file, set by the installer). */
const BOOT_TZ = process.env.TZ

/**
 * Apply the user's time zone (KV `regional.timezone`) to this process: Node re-reads `process.env.TZ`
 * on assignment, so logs, schedules and the auto-update windows follow it without a restart. An empty
 * value restores the zone the container started with. Returns the zone now in effect.
 */
export function applyServerTimezone(tz: unknown): string | undefined {
  if (isValidTimezone(tz)) {
    process.env.TZ = tz
  } else if (tz === null || tz === undefined || tz === '') {
    if (BOOT_TZ) process.env.TZ = BOOT_TZ
    else delete process.env.TZ
  }
  return process.env.TZ
}
