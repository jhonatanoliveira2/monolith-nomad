import logger from '@adonisjs/core/services/logger'
import { DrugReferenceService } from '#services/drug_reference_service'

/**
 * True when the offline FDA drug dataset is installed or installing. Reads the two-phase ingest
 * status: ready (fully installed) or an active phase (downloading/downloaded/ingesting), so the entry
 * appears the moment the user opts in and persists through the long install. rowCount > 0 covers a
 * populated table whose job history was pruned. Never throws: a status read failure hides the entry
 * (fail-closed) instead of failing the page.
 *
 * Used by the dashboard tiles (HomeController) and, cached, by the global navigation (config/inertia.ts).
 */
export async function isDrugReferenceInstalled(): Promise<boolean> {
  try {
    const status = await new DrugReferenceService().getIngestStatus()
    const installing =
      status.phase === 'downloading' ||
      status.phase === 'downloaded' ||
      status.phase === 'ingesting'
    return status.phase === 'ready' || installing || status.rowCount > 0
  } catch (err) {
    logger.error(
      `[drug-reference] install check failed: ${err instanceof Error ? err.message : String(err)}`
    )
    return false
  }
}

let cache: { value: boolean; expiresAt: number } | null = null

/** Same answer, cached for a minute: it is read on every page render for the navigation. */
export async function isDrugReferenceInstalledCached(): Promise<boolean> {
  const now = Date.now()
  if (cache && now < cache.expiresAt) return cache.value
  const value = await isDrugReferenceInstalled()
  cache = { value, expiresAt: now + 60_000 }
  return value
}
