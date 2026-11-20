/**
 * Locale-aware formatters (inertia/lib/format_core.ts): Brazilian formats by default, following the interface
 * language, and an empty string for missing or invalid input instead of "Invalid Date" / "NaN".
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFormatters } from '../../inertia/lib/format_core.js'

// local wall-clock time, so the expectations do not depend on the machine's time zone
const AT = new Date(2026, 10, 20, 14, 5)
const pt = createFormatters(() => 'pt-BR')

test('pt-BR dates, times and numbers use the Brazilian formats', () => {
  assert.equal(pt.formatDate(AT), '20/11/2026')
  assert.equal(pt.formatTime(AT), '14:05')
  assert.equal(pt.formatDateTime(AT), '20/11/2026, 14:05')
  assert.equal(pt.formatNumber(1234.5), '1.234,5')
})

test('dates are accepted as Date, ISO string or epoch milliseconds', () => {
  assert.equal(pt.formatDate(AT.toISOString()), '20/11/2026')
  assert.equal(pt.formatDate(AT.getTime()), '20/11/2026')
})

test('custom Intl options are passed through', () => {
  assert.equal(pt.formatDate(AT, { month: 'long' }), 'novembro')
  assert.equal(pt.formatNumber(0.25, { style: 'percent' }), '25%')
})

test('missing or invalid input gives an empty string', () => {
  for (const value of [null, undefined, '', 'not a date', Number.NaN]) {
    assert.equal(pt.formatDate(value), '')
    assert.equal(pt.formatDateTime(value), '')
    assert.equal(pt.formatTime(value), '')
    assert.equal(pt.formatRelative(value), '')
  }
  assert.equal(pt.formatNumber(null), '')
  assert.equal(pt.formatNumber(undefined), '')
  assert.equal(pt.formatNumber(Number.NaN), '')
  assert.equal(pt.formatNumber(0), '0')
})

test('relative time picks seconds, minutes, hours or days', () => {
  const now = AT
  const ago = (ms: number) => new Date(now.getTime() - ms)
  assert.equal(pt.formatRelative(now, now), 'agora')
  assert.equal(pt.formatRelative(ago(30_000), now), 'há 30 segundos')
  assert.equal(pt.formatRelative(ago(5 * 60_000), now), 'há 5 minutos')
  assert.equal(pt.formatRelative(new Date(now.getTime() + 2 * 3_600_000), now), 'em 2 horas')
  assert.equal(pt.formatRelative(ago(86_400_000), now), 'ontem')
  assert.equal(pt.formatRelative(ago(3 * 86_400_000), now), 'há 3 dias')
})

test('the locale is read at call time, so a language switch applies immediately', () => {
  let locale = 'pt-BR'
  const f = createFormatters(() => locale)
  assert.equal(f.formatNumber(1234.5), '1.234,5')
  locale = 'en'
  assert.equal(f.formatNumber(1234.5), '1,234.5')
  assert.equal(f.formatDate(AT), '11/20/26')
})
