/**
 * Server messages (always English) are translated at display time: exact catalog lookup, PATTERNS for messages
 * with values baked in, recursive translation of nested `error` groups and of a trailing HTTP-client error.
 * Uses a real i18next instance with the real pt-BR catalogs, configured like inertia/lib/i18n.ts.
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import i18next from 'i18next'
import { createServerMessageTranslator, PATTERNS } from '../../inertia/lib/server_messages_core.js'

const LOCALES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../inertia/locales')

function catalog(locale: string): Record<string, string> {
  const dir = path.join(LOCALES, locale)
  return Object.assign(
    {},
    ...readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')))
  )
}

const ptBR = catalog('pt-BR')

async function translatorFor(lng: string) {
  const i18n = i18next.createInstance()
  await i18n.init({
    resources: { 'pt-BR': { translation: ptBR } },
    lng,
    fallbackLng: 'en',
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  })
  return createServerMessageTranslator({
    exists: (key) => i18n.exists(key),
    t: (key, values) => i18n.t(key, values ?? {}) as string,
  })
}

const tr = await translatorFor('pt-BR')

test('static server messages are looked up as-is', () => {
  const [key, value] = Object.entries(ptBR).find(([k]) => !k.includes('{{'))!
  assert.equal(tr(key), value)
})

test('messages with a value baked in are mapped back to their template key', () => {
  assert.equal(
    tr('Service nomad_kiwix_server not found'),
    'Serviço nomad_kiwix_server não encontrado'
  )
})

test('the more specific pattern wins over a shorter prefix', () => {
  assert.equal(
    tr('Service nomad_ollama not found or not installed'),
    'Serviço nomad_ollama não encontrado ou não instalado'
  )
})

test('a nested `error` group is translated recursively', () => {
  assert.equal(
    tr('Reconfigure failed and was rolled back: Service nomad_kolibri not found'),
    'A reconfiguração falhou e foi desfeita: Serviço nomad_kolibri não encontrado'
  )
})

test('a trailing HTTP-client error is translated and the prefix kept', () => {
  assert.equal(
    tr('Something went sideways: Request failed with status code 502'),
    'Something went sideways: A requisição falhou com o código 502'
  )
})

test('unknown messages are returned unchanged', () => {
  assert.equal(
    tr('A brand new message the catalog does not know'),
    'A brand new message the catalog does not know'
  )
})

test('null, undefined and empty input give an empty string; other values are stringified', () => {
  assert.equal(tr(null), '')
  assert.equal(tr(undefined), '')
  assert.equal(tr(''), '')
  assert.equal(tr(42), '42')
})

test('in English the template is interpolated with the original values', async () => {
  const en = await translatorFor('en')
  assert.equal(en('Service nomad_kiwix_server not found'), 'Service nomad_kiwix_server not found')
  assert.equal(
    en('Reconfigure failed and was rolled back: Service x not found'),
    'Reconfigure failed and was rolled back: Service x not found'
  )
})

test('every pattern is anchored and its template key has a pt-BR translation', () => {
  const missing = PATTERNS.filter(({ key }) => !ptBR[key]).map(({ key }) => key)
  assert.deepEqual(
    missing,
    [],
    `pattern keys missing from inertia/locales/pt-BR:\n${missing.join('\n')}`
  )
  for (const { re } of PATTERNS) {
    assert.ok(re.source.startsWith('^') && re.source.endsWith('$'), `pattern not anchored: ${re}`)
  }
})

test('every named group in a pattern is used as a placeholder in its key', () => {
  for (const { re, key } of PATTERNS) {
    for (const [, group] of re.source.matchAll(/\(\?<(\w+)>/g)) {
      assert.ok(key.includes(`{{${group}}}`), `group "${group}" of ${re} is not used in "${key}"`)
    }
  }
})
