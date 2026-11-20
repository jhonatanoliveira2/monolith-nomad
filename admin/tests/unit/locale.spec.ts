import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEFAULT_LOCALE,
  docTitle,
  localizedDocCandidates,
  parseDocFilename,
  resolveLocale,
} from '../../app/utils/locale.js'

test('the server defaults to Brazilian Portuguese and only accepts supported locales', () => {
  assert.equal(DEFAULT_LOCALE, 'pt-BR')
  assert.equal(resolveLocale(undefined), 'pt-BR')
  assert.equal(resolveLocale(''), 'pt-BR')
  assert.equal(resolveLocale('en'), 'en')
  assert.equal(resolveLocale('pt-BR'), 'pt-BR')
  assert.equal(resolveLocale('fr'), 'pt-BR', 'unknown locale falls back to the default')
  assert.equal(resolveLocale('../../etc'), 'pt-BR')
})

test('documentation prefers the translation and falls back to the English original', () => {
  assert.deepEqual(localizedDocCandidates('faq', 'pt-BR'), ['faq.pt-BR.md', 'faq.md'])
  assert.deepEqual(localizedDocCandidates('faq.md', 'pt-BR'), ['faq.pt-BR.md', 'faq.md'])
  assert.deepEqual(localizedDocCandidates('faq', 'en'), ['faq.md'])
})

test('translated doc files are grouped under their slug', () => {
  assert.deepEqual(parseDocFilename('getting-started.pt-BR.md'), {
    slug: 'getting-started',
    locale: 'pt-BR',
  })
  assert.deepEqual(parseDocFilename('getting-started.md'), {
    slug: 'getting-started',
    locale: null,
  })
  assert.deepEqual(parseDocFilename('release-notes.en.md'), { slug: 'release-notes', locale: 'en' })
})

test('doc titles are translated for pt-BR and keep the special English casing', () => {
  assert.equal(docTitle('faq', 'pt-BR'), 'Perguntas Frequentes')
  assert.equal(docTitle('getting-started', 'pt-BR'), 'Primeiros Passos')
  assert.equal(docTitle('faq', 'en'), 'FAQ')
  assert.equal(docTitle('getting-started', 'en'), null, 'English titles are derived from the slug')
})
