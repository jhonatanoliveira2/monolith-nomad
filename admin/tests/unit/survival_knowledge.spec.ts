/**
 * Survival agent rules over the real knowledge map (collections/survival.json): scenario level,
 * hazard, phase, location and which works answer it. The two cases from the request of 2026-11-24
 * (a flood in Manaus, a long drought in the Northeast semi-arid) must come out different.
 *
 * Pure functions only:  npm run test:unit
 */
import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  buildSurvivalSystemPrompt,
  classifyScenario,
  detectLocation,
  englishRetrievalTerms,
  fileEditionDate,
  fold,
  hasKeyword,
  mergeModelClassification,
  rankWorks,
  resolveLocation,
  workMatchesFile,
  type SurvivalSpec,
} from '../../app/utils/survival_knowledge.js'

const spec: SurvivalSpec = JSON.parse(
  readFileSync(new URL('../../../collections/survival.json', import.meta.url), 'utf8')
)

test('the map has six levels, six phases and the twelve topics of the request', () => {
  assert.deepEqual(
    spec.levels.map((l) => l.level),
    [1, 2, 3, 4, 5, 6]
  )
  assert.equal(spec.phases.length, 6)
  assert.equal(spec.topics.length, 12)
  assert.deepEqual(spec.regions.map((r) => r.id).sort(), [
    'centro-oeste',
    'nordeste',
    'norte',
    'sudeste',
    'sul',
  ])
  for (const w of spec.works) {
    for (const h of w.hazards)
      assert.ok(
        spec.hazards.some((x) => x.id === h),
        `${w.match}: ${h}`
      )
    for (const t of w.topics)
      assert.ok(
        spec.topics.some((x) => x.id === t),
        `${w.match}: ${t}`
      )
  }
})

test('hasKeyword matches words, not fragments, ignoring accents', () => {
  assert.equal(hasKeyword(fold('Está muito frio hoje'), 'frio'), true)
  assert.equal(hasKeyword(fold('o frigorífico parou'), 'frio'), false)
  assert.equal(hasKeyword(fold('INUNDAÇÃO no bairro'), 'inundação'), true)
  assert.equal(hasKeyword(fold('o rio transbordou'), 'transbord'), true)
})

test('Manaus flood: inundação, Norte/AM, family scope', () => {
  const q = 'Como preparar minha família para uma enchente na região de Manaus?'
  const c = classifyScenario(q, spec)
  assert.equal(c.hazards[0], 'inundacao')
  assert.equal(c.phase, 'preparacao')
  assert.equal(c.level, 3) // "região" is the widest scope mentioned
  assert.deepEqual(detectLocation(q, spec), { state: 'BR-AM', region: 'norte' })
})

test('semi-arid drought: seca, Nordeste, weeks-to-months phase', () => {
  const q = 'Como sobreviver a uma seca prolongada no semiárido nordestino durante meses?'
  const c = classifyScenario(q, spec)
  assert.equal(c.hazards[0], 'seca')
  assert.equal(c.phase, 'semanas-meses')
  assert.equal(detectLocation(q, spec)?.region, 'nordeste')
  const works = rankWorks(spec, c, 'nordeste').map((w) => w.match)
  assert.ok(
    works.indexOf('ms-plano-seca-estiagem') >= 0 && works.indexOf('ms-plano-seca-estiagem') < 3
  )
  assert.ok(!works.slice(0, 3).includes('mma-caderno-inundacoes'))
})

test('the two cases rank different works first', () => {
  const flood = classifyScenario('enchente em Manaus, o rio está subindo', spec)
  const drought = classifyScenario('seca no sertão, açude secando', spec)
  assert.notEqual(
    rankWorks(spec, flood, 'norte')[0].match,
    rankWorks(spec, drought, 'nordeste')[0].match
  )
})

test('levels: household, national, civilisational', () => {
  assert.equal(classifyScenario('Faltou luz em casa, o que faço com a geladeira?', spec).level, 1)
  assert.equal(
    classifyScenario('E se houver um apagão no país inteiro por semanas?', spec).level,
    4
  )
  assert.equal(classifyScenario('Como sobreviver a um inverno nuclear?', spec).level, 6)
  // an asteroid is never a household event, even "em casa"
  assert.ok(classifyScenario('impacto de asteroide, o que guardar em casa?', spec).level >= 5)
})

test('phase from time words', () => {
  assert.equal(
    classifyScenario('A água está entrando agora em casa', spec).phase,
    'primeiras-horas'
  )
  assert.equal(
    classifyScenario('Depois da enchente, como limpar a casa?', spec).phase,
    'recuperacao'
  )
  assert.equal(
    classifyScenario('quais os sinais de que a encosta vai deslizar?', spec).phase,
    'riscos'
  )
})

test('resolveLocation: the question overrides settings', () => {
  const settings = { state: 'BR-SP', environment: 'urbano', place: 'Campinas' }
  const fromQuestion = resolveLocation('cheia em Porto Alegre', spec, settings)
  assert.equal(fromQuestion.state, 'BR-RS')
  assert.equal(fromQuestion.source, 'question')
  const fromSettings = resolveLocation('como guardar água?', spec, settings)
  assert.deepEqual(fromSettings, {
    state: 'BR-SP',
    region: 'sudeste',
    environment: 'urbano',
    place: 'Campinas',
    source: 'settings',
  })
  assert.equal(resolveLocation('oi', spec, {}).source, 'none')
  // "Mato Grosso do Sul" is not read as "Mato Grosso"
  assert.equal(detectLocation('queimadas no Mato Grosso do Sul', spec)?.state, 'BR-MS')
})

test('mergeModelClassification keeps the heuristic unless the model answer is valid', () => {
  const h = classifyScenario('enchente no bairro', spec)
  assert.equal(
    mergeModelClassification(h, { level: 9, hazards: ['inundacao'], phase: 'preparacao' }, spec),
    h
  )
  assert.equal(mergeModelClassification(h, 'nope', spec), h)
  const m = mergeModelClassification(
    h,
    { level: 2, hazards: ['inundacao', 'inventado'], phase: 'primeiras-horas', rationale: 'ok' },
    spec
  )
  assert.equal(m.method, 'model')
  assert.deepEqual(m.hazards, ['inundacao'])
  assert.equal(m.phase, 'primeiras-horas')
})

test('work and file matching, edition dates, English terms', () => {
  assert.equal(
    workMatchesFile({ match: 'ms-plano-seca-estiagem' }, 'ms-plano-seca-estiagem-pdf_2026.pdf'),
    true
  )
  assert.equal(workMatchesFile({ match: 'ready.gov_en' }, 'ready.gov_en_all_2026-10.zim'), true)
  assert.equal(fileEditionDate('ready.gov_en_all_2026-10.zim'), '2026-10')
  assert.equal(fileEditionDate('ms-guia-inundacao-pdf_2017.pdf'), '2017')
  assert.equal(fileEditionDate('upload.pdf'), null)
  assert.match(englishRetrievalTerms(spec, { hazards: ['inundacao'], topics: ['agua'] }), /flood/)
})

test('the system prompt states the offline limits, the scenario and the region source', () => {
  const scenario = classifyScenario('enchente em Manaus', spec)
  const location = resolveLocation('enchente em Manaus', spec, { environment: 'urbano' })
  const prompt = buildSurvivalSystemPrompt({
    spec,
    scenario,
    location,
    today: '24/11/2026',
    knowledge: { newest: '2026', oldest: '2015', works: 7 },
  })
  assert.match(prompt, /não tem alertas meteorológicos/)
  assert.match(prompt, /2015 a 2026/)
  assert.match(prompt, /Amazonas \(AM\)/)
  assert.match(prompt, /pedido de 24\/11\/2026/)
  assert.match(prompt, /Documentado nas fontes/)
})

// ---- Place names that are also common words (e2e test of 25/11/2026) ----

test('detectLocation: the preposition "para" is not the state of Pará', () => {
  const q = 'Estamos no semiárido nordestino, zona rural. Como garantir água segura para a família?'
  assert.deepEqual(detectLocation(q, spec), { state: null, region: 'nordeste' })
  assert.equal(detectLocation('cheia dos rios no Pará', spec)?.state, 'BR-PA')
  assert.equal(detectLocation('vou para o Paraná', spec)?.state, 'BR-PR')
})

test('detectLocation: ambiguous city names count only after "em"', () => {
  assert.equal(detectLocation('como guardar comida para a ceia de Natal?', spec), null)
  assert.equal(detectLocation('enchente em Natal', spec)?.state, 'BR-RN')
  assert.equal(detectLocation('uma salva de palmas para a equipe', spec), null)
  assert.equal(detectLocation('deslizamento em Santos', spec)?.state, 'BR-SP')
})

test('detectLocation: names match whole words, and a city zone is not a region', () => {
  assert.equal(detectLocation('moro na zona norte e falta luz', spec), null)
  assert.equal(detectLocation('sulfato de alumínio na água', spec), null)
  assert.equal(detectLocation('seca na região Sul', spec)?.region, 'sul')
  assert.equal(detectLocation('chuvas no Nordeste', spec)?.region, 'nordeste')
})
