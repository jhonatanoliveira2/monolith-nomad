/**
 * Relevance floors per embedding profile. Scores live on each model's own scale: the nomic-tuned 0.62
 * dropped every passage for 3 of 12 survival questions once the index moved to EmbeddingGemma
 * (e2e test of 25/11/2026), so each profile carries its own presets.
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EMBEDDING_PROFILES,
  relevancePresets,
  remapRelevanceFloor,
} from '../../app/utils/embedding_profile.js'
import { RAG_MIN_FINAL_SCORE } from '../../constants/ollama.js'

const gemma = EMBEDDING_PROFILES['embeddinggemma']
const nomic = EMBEDDING_PROFILES['nomic-v1.5']

test('nomic keeps the calibrated floors; EmbeddingGemma gets its own, below the weakest measured hit', () => {
  assert.equal(nomic.relevanceFloors.balanced, RAG_MIN_FINAL_SCORE)
  assert.ok(gemma.relevanceFloors.balanced < 0.576)
  assert.ok(gemma.relevanceFloors.strict < 0.576)
})

test('every profile orders its floors lenient < balanced < strict', () => {
  for (const p of Object.values(EMBEDDING_PROFILES)) {
    const f = p.relevanceFloors
    assert.ok(
      0 < f.lenient && f.lenient < f.balanced && f.balanced < f.strict && f.strict < 1,
      p.id
    )
  }
})

test('presets keep off at 0 and use the profile scale for the rest', () => {
  const presets = relevancePresets(gemma)
  assert.deepEqual(
    presets.map((p) => p.key),
    ['off', 'lenient', 'balanced', 'strict']
  )
  assert.equal(presets[0].value, 0)
  assert.equal(presets.find((p) => p.key === 'balanced')!.value, gemma.relevanceFloors.balanced)
  assert.equal(presets.find((p) => p.key === 'balanced')!.label, 'Balanced (recommended)')
})

test('a stored preset moves to the same preset of the new profile', () => {
  assert.equal(remapRelevanceFloor(0.62, nomic, gemma), gemma.relevanceFloors.balanced)
  assert.equal(remapRelevanceFloor(0.66, nomic, gemma), gemma.relevanceFloors.strict)
  assert.equal(remapRelevanceFloor(gemma.relevanceFloors.lenient, gemma, nomic), 0.55)
})

test('off, custom values and an unchanged profile are left alone', () => {
  assert.equal(remapRelevanceFloor(0, nomic, gemma), null)
  assert.equal(remapRelevanceFloor(0.6, nomic, gemma), null)
  assert.equal(remapRelevanceFloor(0.62, nomic, nomic), null)
})
