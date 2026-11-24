/*
|--------------------------------------------------------------------------
| Regional preferences
|--------------------------------------------------------------------------
|
| Applies the time zone chosen in the setup wizard or settings (KV `regional.timezone`) to the web
| server and to the queue workers at boot. Silent when the table does not exist yet (first migration).
|
*/
import KVStore from '#models/kv_store'
import logger from '@adonisjs/core/services/logger'
import { applyServerTimezone } from '../app/utils/server_timezone.js'

try {
  const tz = await KVStore.getValue('regional.timezone')
  if (tz) {
    applyServerTimezone(tz)
    logger.info(`[regional] time zone: ${process.env.TZ}`)
  }
} catch {
  // database not migrated yet, or unreachable: keep the container's TZ
}
