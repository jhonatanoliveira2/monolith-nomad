/**
 * Locale-aware formatting for dates, times and numbers, following the interface language (pt-BR by default:
 * 20/11/2026, 14:05, 1.234,5). Use these instead of toLocaleString()/toLocaleDateString() without arguments
 * (which follow the browser) or a hard-coded 'en-US'.
 *
 * Pure module: the app binds it to the interface language in format.ts; tests pass a fixed locale.
 */

type DateInput = Date | string | number | null | undefined

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function createFormatters(getLocale: () => string) {
  /** 20/11/2026 */
  function formatDate(
    value: DateInput,
    options: Intl.DateTimeFormatOptions = { dateStyle: 'short' }
  ): string {
    const d = toDate(value)
    return d ? new Intl.DateTimeFormat(getLocale(), options).format(d) : ''
  }

  /** 20/11/2026, 14:05 */
  function formatDateTime(
    value: DateInput,
    options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' }
  ): string {
    const d = toDate(value)
    return d ? new Intl.DateTimeFormat(getLocale(), options).format(d) : ''
  }

  /** 14:05 (24 h in pt-BR) */
  function formatTime(
    value: DateInput,
    options: Intl.DateTimeFormatOptions = { timeStyle: 'short' }
  ): string {
    const d = toDate(value)
    return d ? new Intl.DateTimeFormat(getLocale(), options).format(d) : ''
  }

  /** 1.234,5 */
  function formatNumber(
    value: number | null | undefined,
    options?: Intl.NumberFormatOptions
  ): string {
    if (value === null || value === undefined || Number.isNaN(value)) return ''
    return new Intl.NumberFormat(getLocale(), options).format(value)
  }

  /** há 5 minutos / em 2 horas */
  function formatRelative(value: DateInput, now: Date = new Date()): string {
    const d = toDate(value)
    if (!d) return ''
    const seconds = Math.round((d.getTime() - now.getTime()) / 1000)
    const abs = Math.abs(seconds)
    const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' })
    if (abs < 60) return rtf.format(seconds, 'second')
    if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
    if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
    return rtf.format(Math.round(seconds / 86400), 'day')
  }

  return { formatDate, formatDateTime, formatTime, formatNumber, formatRelative }
}
