import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { findReplacedWikipediaFiles, zimFilenameStem } from '../../app/utils/zim_filename.js'

test('zimFilenameStem strips YYYY-MM date suffix', () => {
  assert.equal(zimFilenameStem('wikipedia_en_all_nopic_2026-02.zim'), 'wikipedia_en_all_nopic')
})

test('zimFilenameStem strips YYYY-MM-DD date suffix', () => {
  assert.equal(zimFilenameStem('wikipedia_en_all_nopic_2026-02-15.zim'), 'wikipedia_en_all_nopic')
})

test('zimFilenameStem returns input unchanged when no date suffix present', () => {
  assert.equal(
    zimFilenameStem('wikipedia_en_my_custom_extract.zim'),
    'wikipedia_en_my_custom_extract.zim'
  )
})

test('findReplacedWikipediaFiles cleans up older version of same variant', () => {
  assert.deepEqual(
    findReplacedWikipediaFiles('wikipedia_en_all_nopic_2026-04.zim', [
      'wikipedia_en_all_nopic_2026-02.zim',
      'wikipedia_en_all_nopic_2026-04.zim',
    ]),
    ['wikipedia_en_all_nopic_2026-02.zim']
  )
})

test('findReplacedWikipediaFiles preserves co-existing distinct corpora — the #884 regression case', () => {
  assert.deepEqual(
    findReplacedWikipediaFiles('wikipedia_en_medicine_nopic_2026-04.zim', [
      'wikipedia_en_simple_all_nopic_2026-02.zim',
      'wikipedia_en_medicine_nopic_2026-04.zim',
    ]),
    []
  )
})

test('findReplacedWikipediaFiles preserves all unrelated variants when a new variant lands', () => {
  assert.deepEqual(
    findReplacedWikipediaFiles('wikipedia_en_all_nopic_2026-04.zim', [
      'wikipedia_en_simple_all_nopic_2026-02.zim',
      'wikipedia_en_medicine_nopic_2026-04.zim',
      'wikipedia_en_wikivoyage_2026-02.zim',
      'wikipedia_en_climate_change_2025-08.zim',
      'wikipedia_en_all_nopic_2026-04.zim',
    ]),
    []
  )
})

test('findReplacedWikipediaFiles ignores files without wikipedia_en_ prefix', () => {
  assert.deepEqual(
    findReplacedWikipediaFiles('wikipedia_en_all_nopic_2026-04.zim', [
      'wiktionary_en_all_2026-02.zim',
      'gutenberg_en_all_2026-01.zim',
      'wikipedia_en_all_nopic_2026-04.zim',
    ]),
    []
  )
})

test('findReplacedWikipediaFiles preserves manually-named files without a date suffix', () => {
  assert.deepEqual(
    findReplacedWikipediaFiles('wikipedia_en_all_nopic_2026-04.zim', [
      'wikipedia_en_my_custom_extract.zim',
      'wikipedia_en_all_nopic_2026-04.zim',
    ]),
    []
  )
})

test('isWikipediaSelectorFile matches selector options across release dates only', async () => {
  const { isWikipediaSelectorFile } = await import('../../app/utils/zim_filename.js')
  const options = [
    'https://download.kiwix.org/zim/wikipedia/wikipedia_en_all_maxi_2026-01.zim',
    'https://download.kiwix.org/zim/wikipedia/wikipedia_en_top_mini_2026-01.zim',
    null,
  ]
  assert.equal(isWikipediaSelectorFile('wikipedia_en_all_maxi_2026-05.zim', options), true)
  assert.equal(isWikipediaSelectorFile('wikipedia_en_top_mini_2026-01.zim', options), true)
  assert.equal(isWikipediaSelectorFile('wikipedia_en_medicine_maxi_2026-01.zim', options), false)
  assert.equal(isWikipediaSelectorFile('wikipedia_en_simple_all_nopic_2026-01.zim', options), false)
  assert.equal(isWikipediaSelectorFile('wikipedia_en_all_maxi_2026-05.zim', []), false)
})

test('findReplacedWikipediaFiles cleans up older releases of a Portuguese Wikipedia too', () => {
  // The selector now offers wikipedia_pt_* (Brazilian catalog). The old `wikipedia_en_` prefix check
  // left every superseded pt release on disk forever.
  assert.deepEqual(
    findReplacedWikipediaFiles('wikipedia_pt_all_nopic_2026-11.zim', [
      'wikipedia_pt_all_nopic_2026-05.zim',
      'wikipedia_pt_all_nopic_2026-11.zim',
      'wikipedia_pt_medicine_maxi_2026-10.zim',
      'wikipedia_en_all_nopic_2026-05.zim',
    ]),
    ['wikipedia_pt_all_nopic_2026-05.zim']
  )
})

test('isWikipediaSelectorFile recognises Portuguese selector options and not pt themed corpora', async () => {
  const { isWikipediaSelectorFile } = await import('../../app/utils/zim_filename.js')
  const options = ['https://download.kiwix.org/zim/wikipedia/wikipedia_pt_top_mini_2026-10.zim']
  assert.equal(isWikipediaSelectorFile('wikipedia_pt_top_mini_2027-01.zim', options), true)
  assert.equal(isWikipediaSelectorFile('wikipedia_pt_medicine_maxi_2026-10.zim', options), false)
})

test('isWikipediaZimUrl matches Wikipedia ZIMs in any language and nothing else', async () => {
  const { isWikipediaZimUrl } = await import('../../app/utils/zim_filename.js')
  for (const u of [
    'https://download.kiwix.org/zim/wikipedia/wikipedia_en_all_nopic_2026-06.zim',
    'https://download.kiwix.org/zim/wikipedia/wikipedia_pt_top_mini_2026-10.zim',
    'https://lb.download.kiwix.org/zim/wikipedia/wikipedia_pt_all_maxi_2026-05.zim',
  ]) {
    assert.equal(isWikipediaZimUrl(u), true, u)
  }
  for (const u of [
    'https://download.kiwix.org/zim/wikibooks/wikibooks_pt_all_maxi_2026-10.zim',
    'https://download.kiwix.org/zim/other/vikidia_pt_all_maxi_2026-09.zim',
    'https://example.org/notwikipedia_pt_all.zim',
    '',
  ]) {
    assert.equal(isWikipediaZimUrl(u), false, u)
  }
})
