/**
 * Logger loaded on first use instead of at module scope.
 *
 * `@adonisjs/core/services/logger` awaits the booted application when it is imported, so any module that
 * imports it at the top cannot be loaded by plain `node --test` unit tests. The download stack
 * (downloads.ts, smart_download.ts and helpers) resolves the logger lazily through this module: inside the
 * app it is the AdonisJS (pino) logger, outside a booted app it falls back to the console.
 */
export type DownloadLogger = {
  debug: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string, ...args: unknown[]) => void
}

const consoleLogger: DownloadLogger = {
  debug: () => {},
  info: (message, ...args) => console.info(message, ...args),
  warn: (message, ...args) => console.warn(message, ...args),
  error: (message, ...args) => console.error(message, ...args),
}

let cached: DownloadLogger | null = null

export async function getLogger(): Promise<DownloadLogger> {
  if (cached) return cached
  try {
    const mod = await import('@adonisjs/core/services/logger')
    cached = (mod.default as unknown as DownloadLogger | undefined) ?? consoleLogger
  } catch {
    cached = consoleLogger
  }
  return cached
}

/** Tests: force a logger (or reset with null). */
export function setLoggerForTests(logger: DownloadLogger | null) {
  cached = logger
}
