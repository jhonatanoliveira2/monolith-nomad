/**
 * Locale-aware formatting for dates, times and numbers, following the interface language (pt-BR by default:
 * 20/11/2026, 14:05, 1.234,5). Use these instead of toLocaleString()/toLocaleDateString() without arguments
 * (which follow the browser) or a hard-coded 'en-US'. Implementation: format_core.ts.
 */
import { currentLocale } from './i18n'
import { createFormatters } from './format_core'

export const { formatDate, formatDateTime, formatTime, formatNumber, formatRelative } =
  createFormatters(currentLocale)
