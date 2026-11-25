/**
 * Survival knowledge map (collections/survival.json) and the pure rules the survival agent applies to
 * it: scenario classification, location, which library works fit a scenario, and the instructions the
 * model answers under. No I/O here, so every rule is unit-tested directly.
 *
 * The map organises knowledge; it is never a source of facts. Answers come from the documents
 * retrieved for the question, and the regional characteristics are the ones defined in the request of
 * 2026-11-24 (each region carries its `source`).
 */
import { BRAZIL_REGIONS, BRAZIL_STATES, type BrazilRegionId } from '../../constants/brazil.js'

export type SurvivalLevel = {
  level: number
  name: string
  scope: string
  duration: string
  infrastructure: string
  recovery: string
  examples: string[]
}
export type SurvivalPhase = { id: string; name: string; keywords: string[] }
export type SurvivalTopic = { id: string; name: string; keywords: string[]; keywords_en: string[] }
export type SurvivalHazard = {
  id: string
  name: string
  keywords: string[]
  keywords_en: string[]
  /** Typical gravity range [min, max] when the question gives no scope. */
  levels: [number, number]
}
export type SurvivalRegion = {
  id: BrazilRegionId
  name: string
  features: string
  hazards: string[]
  biomes: string[]
  source: string
}
export type SurvivalWork = {
  /** Library item id or ZIM id; matched as the prefix of an indexed file name. */
  match: string
  kind: 'library' | 'zim'
  hazards: string[]
  topics: string[]
  phases: string[]
  regions: string[]
  levels: [number, number]
}
export type SurvivalSpec = {
  spec_version: string
  levels: SurvivalLevel[]
  phases: SurvivalPhase[]
  topics: SurvivalTopic[]
  hazards: SurvivalHazard[]
  scope_words: { level: number; keywords: string[] }[]
  regions: SurvivalRegion[]
  works: SurvivalWork[]
}

export type SurvivalEnvironment = 'urbano' | 'rural'

/** Where the user is, as far as they told us (settings or the question itself). */
export type SurvivalLocation = {
  /** ISO 3166-2 code, e.g. BR-AM */
  state: string | null
  region: BrazilRegionId | null
  environment: SurvivalEnvironment | null
  place: string | null
  /** Where the state/region came from. */
  source: 'question' | 'settings' | 'none'
}

export type ScenarioClassification = {
  hazards: string[]
  topics: string[]
  level: number
  phase: string
  /** How the level was decided: from scope words in the question, or the hazard's typical range. */
  levelBasis: 'scope' | 'hazard' | 'default'
  method: 'heuristic' | 'model'
  rationale?: string
}

/** Lower-case, accents removed, so "Inundação", "inundacao" and "INUNDAÇÃO" compare equal. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Whole-word (or word-prefix, for keywords ending in a stem like "transbord") match of a folded
 * keyword in folded text. Plain substring matching would read "frio" inside "frigorífico".
 */
export function hasKeyword(foldedText: string, keyword: string): boolean {
  const k = fold(keyword).trim()
  if (!k) return false
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}`, 'i').test(foldedText)
}

/** Whole-word match of a folded phrase: place names must not match inside other words. */
function hasWord(foldedText: string, phrase: string): boolean {
  const k = fold(phrase)
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return !!k && new RegExp(`(^|[^a-z0-9])${k}($|[^a-z0-9])`).test(foldedText)
}

/**
 * City names that are also common words ("ceia de Natal", "todos os santos", "uma salva de palmas",
 * "boa vista do mar"): only read as the city after "em", the way a place is named in a question.
 */
const AMBIGUOUS_CITIES = new Set(['natal', 'santos', 'palmas', 'vitoria', 'salvador', 'boa vista'])

/** "Pará" folds to the preposition "para": the state only counts when written with its accent. */
const ACCENT_ONLY_STATES = new Set(['BR-PA'])

/** "Norte" and "Sul" are also city zones ("zona norte"): only as the region of the country. */
const COUNTRY_REGION_FORMS: Partial<Record<BrazilRegionId, string[]>> = {
  norte: ['regiao norte', 'norte do brasil', 'norte do pais'],
  sul: ['regiao sul', 'sul do brasil', 'sul do pais'],
}

function countMatches(foldedText: string, keywords: string[]): number {
  return keywords.reduce((n, k) => n + (hasKeyword(foldedText, k) ? 1 : 0), 0)
}

/** Capitals and other large cities named in questions, mapped to their state. */
const CITY_STATE: Record<string, string> = {
  'manaus': 'BR-AM',
  'belem': 'BR-PA',
  'santarem': 'BR-PA',
  'porto velho': 'BR-RO',
  'rio branco': 'BR-AC',
  'macapa': 'BR-AP',
  'boa vista': 'BR-RR',
  'palmas': 'BR-TO',
  'sao luis': 'BR-MA',
  'teresina': 'BR-PI',
  'fortaleza': 'BR-CE',
  'natal': 'BR-RN',
  'joao pessoa': 'BR-PB',
  'recife': 'BR-PE',
  'petrolina': 'BR-PE',
  'maceio': 'BR-AL',
  'aracaju': 'BR-SE',
  'salvador': 'BR-BA',
  'feira de santana': 'BR-BA',
  'belo horizonte': 'BR-MG',
  'juiz de fora': 'BR-MG',
  'vitoria': 'BR-ES',
  'rio de janeiro': 'BR-RJ',
  'petropolis': 'BR-RJ',
  'sao paulo': 'BR-SP',
  'campinas': 'BR-SP',
  'santos': 'BR-SP',
  'curitiba': 'BR-PR',
  'florianopolis': 'BR-SC',
  'blumenau': 'BR-SC',
  'porto alegre': 'BR-RS',
  'canoas': 'BR-RS',
  'campo grande': 'BR-MS',
  'corumba': 'BR-MS',
  'cuiaba': 'BR-MT',
  'goiania': 'BR-GO',
  'brasilia': 'BR-DF',
}

/**
 * State or region named in the question: a city above, a state name or "UF" abbreviation as a whole
 * word, or a region/biome term ("Nordeste", "semiárido", "Pantanal"). Returns null when nothing is
 * named; the caller then falls back to the user's settings.
 */
export function detectLocation(
  question: string,
  spec: Pick<SurvivalSpec, 'regions'>
): { state: string | null; region: BrazilRegionId | null } | null {
  const q = fold(question)
  for (const [city, code] of Object.entries(CITY_STATE)) {
    if (AMBIGUOUS_CITIES.has(city) ? hasWord(q, `em ${city}`) : hasWord(q, city)) {
      return { state: code, region: BRAZIL_STATES.find((s) => s.code === code)?.region ?? null }
    }
  }
  // Longest names first, so "Mato Grosso do Sul" wins over "Mato Grosso"
  const byName = [...BRAZIL_STATES].sort((a, b) => b.name.length - a.name.length)
  const lower = question.normalize('NFC').toLowerCase()
  for (const s of byName) {
    const found = ACCENT_ONLY_STATES.has(s.code)
      ? new RegExp(`(^|[^\\p{L}\\d])${s.name.toLowerCase()}($|[^\\p{L}\\d])`, 'u').test(lower)
      : hasWord(q, s.name)
    if (found) return { state: s.code, region: s.region }
  }
  for (const r of BRAZIL_REGIONS) {
    const forms = COUNTRY_REGION_FORMS[r.id] ?? [r.name]
    if (forms.some((form) => hasWord(q, form))) return { state: null, region: r.id }
  }
  for (const r of spec.regions) {
    if (r.biomes.some((b) => hasKeyword(q, b))) return { state: null, region: r.id }
  }
  return null
}

/** Settings first, overridden by a location named in the question. */
export function resolveLocation(
  question: string,
  spec: Pick<SurvivalSpec, 'regions'>,
  settings: { state?: string | null; environment?: string | null; place?: string | null }
): SurvivalLocation {
  const environment =
    settings.environment === 'urbano' || settings.environment === 'rural'
      ? settings.environment
      : null
  const place = settings.place?.trim() || null
  const named = detectLocation(question, spec)
  if (named) return { ...named, environment, place, source: 'question' }
  const state = BRAZIL_STATES.find((s) => s.code === settings.state) ?? null
  if (state) {
    return { state: state.code, region: state.region, environment, place, source: 'settings' }
  }
  return { state: null, region: null, environment, place, source: 'none' }
}

/**
 * Deterministic classification: hazards and topics by keyword hits, the level from scope words (the
 * largest scope mentioned) or else the lowest typical level of the main hazard, the phase from time
 * words (preparation when nothing is said: most questions are asked before or between events).
 */
export function classifyScenario(question: string, spec: SurvivalSpec): ScenarioClassification {
  const q = fold(question)
  const hazards = spec.hazards
    .map((h) => ({ id: h.id, hits: countMatches(q, [...h.keywords, ...h.keywords_en]), h }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
  const topics = spec.topics
    .map((t) => ({ id: t.id, hits: countMatches(q, [...t.keywords, ...t.keywords_en]) }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((x) => x.id)

  const scope = spec.scope_words
    .filter((s) => s.keywords.some((k) => hasKeyword(q, k)))
    .map((s) => s.level)
  let level: number
  let levelBasis: ScenarioClassification['levelBasis']
  if (scope.length > 0) {
    level = Math.max(...scope)
    levelBasis = 'scope'
    // A hazard that cannot be smaller than its range (an asteroid is never a household event)
    if (hazards[0] && level < hazards[0].h.levels[0]) level = hazards[0].h.levels[0]
  } else if (hazards[0]) {
    level = hazards[0].h.levels[0]
    levelBasis = 'hazard'
  } else {
    level = 1
    levelBasis = 'default'
  }

  const phaseHits = spec.phases
    .map((p) => ({ id: p.id, hits: countMatches(q, p.keywords) }))
    .filter((p) => p.hits > 0)
    .sort((a, b) => b.hits - a.hits)
  const phase = phaseHits[0]?.id ?? 'preparacao'

  return {
    hazards: hazards.slice(0, 3).map((x) => x.id),
    topics: topics.slice(0, 4),
    level: Math.min(6, Math.max(1, level)),
    phase,
    levelBasis,
    method: 'heuristic',
  }
}

/** JSON schema for the model's refinement: closed lists, so it cannot invent a category. */
export function classificationSchema(spec: SurvivalSpec) {
  return {
    type: 'object',
    properties: {
      level: { type: 'integer', minimum: 1, maximum: 6 },
      hazards: {
        type: 'array',
        items: { type: 'string', enum: spec.hazards.map((h) => h.id) },
        maxItems: 3,
      },
      phase: { type: 'string', enum: spec.phases.map((p) => p.id) },
      rationale: { type: 'string', maxLength: 300 },
    },
    required: ['level', 'hazards', 'phase', 'rationale'],
  } as const
}

/**
 * Accept the model's classification only when it is well-formed against the closed lists; anything
 * else keeps the heuristic. Topics always come from the heuristic (the model is not asked).
 */
export function mergeModelClassification(
  heuristic: ScenarioClassification,
  raw: unknown,
  spec: SurvivalSpec
): ScenarioClassification {
  if (!raw || typeof raw !== 'object') return heuristic
  const r = raw as Record<string, unknown>
  const level = typeof r.level === 'number' && Number.isInteger(r.level) ? r.level : Number.NaN
  const hazardIds = new Set(spec.hazards.map((h) => h.id))
  const hazards = Array.isArray(r.hazards)
    ? r.hazards.filter((h): h is string => typeof h === 'string' && hazardIds.has(h)).slice(0, 3)
    : []
  const phase =
    typeof r.phase === 'string' && spec.phases.some((p) => p.id === r.phase) ? r.phase : null
  if (!(level >= 1 && level <= 6) || !phase) return heuristic
  return {
    hazards: hazards.length > 0 ? hazards : heuristic.hazards,
    topics: heuristic.topics,
    level,
    phase,
    levelBasis: heuristic.levelBasis,
    method: 'model',
    rationale: typeof r.rationale === 'string' ? r.rationale.slice(0, 300) : undefined,
  }
}

/**
 * Library works and ZIMs relevant to a scenario, best first: hazard overlap counts most, then topic
 * and phase, then region (a work for the user's region, or a national/global one), and the work must
 * cover the scenario's level.
 */
export function rankWorks(
  spec: SurvivalSpec,
  scenario: Pick<ScenarioClassification, 'hazards' | 'topics' | 'phase' | 'level'>,
  region: BrazilRegionId | null
): SurvivalWork[] {
  return spec.works
    .map((w) => {
      const hazard = w.hazards.filter((h) => scenario.hazards.includes(h)).length
      const topic = w.topics.filter((t) => scenario.topics.includes(t)).length
      const phase = w.phases.includes(scenario.phase) ? 1 : 0
      const regional = region && w.regions.includes(region) ? 1 : 0
      const levelOk = scenario.level >= w.levels[0] && scenario.level <= w.levels[1]
      const score = hazard * 4 + topic * 2 + phase + regional + (levelOk ? 1 : -2)
      return { w, score, relevant: hazard > 0 || topic > 0 }
    })
    .filter((x) => x.relevant)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.w)
}

/** A work matches an indexed file when the file name starts with its id (library and ZIM names do). */
export function workMatchesFile(work: Pick<SurvivalWork, 'match'>, fileName: string): boolean {
  return fileName.toLowerCase().startsWith(work.match.toLowerCase())
}

/** Edition date of an indexed file: the version after the last "_" (2026, 2026-10), or null. */
export function fileEditionDate(fileName: string): string | null {
  const m = /_(\d{4}(?:-\d{2})?)[a-z]?\.(zim|pdf|epub)$/i.exec(fileName)
  return m ? m[1] : null
}

/** Terms appended to a retrieval query for English-language archives (most ZIMs are English). */
export function englishRetrievalTerms(
  spec: SurvivalSpec,
  scenario: Pick<ScenarioClassification, 'hazards' | 'topics'>
): string {
  const terms = [
    ...scenario.hazards.flatMap((id) => spec.hazards.find((h) => h.id === id)?.keywords_en ?? []),
    ...scenario.topics
      .flatMap((id) => spec.topics.find((t) => t.id === id)?.keywords_en ?? [])
      .slice(0, 4),
  ]
  return [...new Set(terms)].join(' ')
}

export type KnowledgeBaseDates = { newest: string | null; oldest: string | null; works: number }

/**
 * The survival agent's instructions. Everything regional the model is told comes from the map (which
 * says where it came from), and it is told plainly that it is offline.
 */
export function buildSurvivalSystemPrompt(input: {
  spec: SurvivalSpec
  scenario: ScenarioClassification
  location: SurvivalLocation
  knowledge: KnowledgeBaseDates
  today: string
}): string {
  const { spec, scenario, location, knowledge } = input
  const level = spec.levels.find((l) => l.level === scenario.level)
  const hazards = scenario.hazards
    .map((id) => spec.hazards.find((h) => h.id === id)?.name)
    .filter(Boolean)
  const phase = spec.phases.find((p) => p.id === scenario.phase)
  const region = location.region ? spec.regions.find((r) => r.id === location.region) : null
  const state = location.state ? BRAZIL_STATES.find((s) => s.code === location.state) : null

  const where = [
    location.place,
    state ? `${state.name} (${state.uf})` : null,
    region ? `região ${region.name}` : null,
    location.environment ? `ambiente ${location.environment}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const lines = [
    'Você é o assistente de preparação e resposta a emergências do monolith-nomad. Roda 100% offline, no computador do usuário. Responda em português do Brasil, com clareza e calma.',
    '',
    'LIMITES QUE VOCÊ DEVE DEIXAR CLAROS',
    `- Você não tem alertas meteorológicos, notícias nem avisos de risco em tempo real. Hoje é ${input.today}; a base de conhecimento instalada vai de ${knowledge.oldest ?? 'data desconhecida'} a ${knowledge.newest ?? 'data desconhecida'} (${knowledge.works} obra(s) de sobrevivência encontradas). Se a pergunta depender da situação atual (nível de rio, previsão, rotas abertas), diga isso e oriente a buscar a Defesa Civil local.`,
    '- Em perigo imediato à vida, comece pela ação de segurança mais urgente e pelos números de emergência que aparecerem nas fontes.',
    '',
    'CENÁRIO (classificação automática, pode estar errada)',
    `- Nível de gravidade: ${scenario.level} — ${level?.name ?? ''} (${level?.scope ?? ''}).`,
    `- Ameaça(s): ${hazards.length ? hazards.join('; ') : 'não identificada'}.`,
    `- Fase: ${phase?.name ?? scenario.phase}.`,
    where
      ? `- Localização: ${where}${location.source === 'settings' ? ' (das configurações)' : ''}.`
      : '- Localização: não informada. Se a resposta depender da região, pergunte ou dê orientações gerais avisando que são gerais.',
  ]
  if (region) {
    lines.push(
      `- Características da região (mapa do app, ${region.source}; use para orientar, não como fato citável): ${region.features}.`
    )
  }
  lines.push(
    '',
    'COMO RESPONDER',
    '1. Baseie-se nos trechos da biblioteca recebidos. Cite cada informação vinda deles com a obra e a página ou capítulo, no formato [Contexto N, obra, p. X].',
    '2. Separe claramente: **Documentado nas fontes** (com citação), **Recomendação geral** (conhecimento comum, sem fonte na biblioteca) e **Incertezas e limites**. Nunca apresente recomendação geral como se estivesse nas fontes.',
    '3. Não invente dados regionais, estatísticas, previsões, telefones, doses ou procedimentos. Se a biblioteca não cobre algo, diga que não encontrou na biblioteca.',
    '4. Quando a pessoa pedir um plano ou uma lista, organize pelas fases que se aplicam: sinais de alerta, preparação, primeiras horas, 24 a 72 horas, semanas ou meses, recuperação. Priorize vida, água, abrigo e saúde, nessa ordem, e adapte ao nível de gravidade e à localização.',
    '5. Considere o comportamento humano: medo, estresse, decisões em grupo, cooperação, liderança, conflitos e saúde mental, quando fizer diferença.',
    '6. Comparando cenários ou regiões, mostre as diferenças lado a lado (tabela quando ajudar).',
    '7. Só oriente procedimentos seguros e legais. Não ensine a fabricar armas, explosivos ou a ferir pessoas.',
    '',
    'Use markdown: títulos curtos, listas e tabelas quando ajudarem.'
  )
  return lines.join('\n')
}

/** Context block wrapper for the survival agent: cite, unlike the general chat's silent template. */
export function survivalContextTemplate(context: string): string {
  return [
    'Trechos recuperados da biblioteca offline para esta pergunta (escolhidos por busca automática; podem não conter tudo):',
    '',
    '[Biblioteca]',
    context,
    '',
    'Use estes trechos como fonte e cite-os como [Contexto N, obra, página]. O que não estiver neles é recomendação geral e deve ser marcado como tal.',
  ].join('\n')
}

/** Human-readable names of a classified scenario and place, for the card shown above an answer. */
export function scenarioLabels(
  spec: SurvivalSpec,
  scenario: ScenarioClassification,
  location: SurvivalLocation
) {
  return {
    level: spec.levels.find((l) => l.level === scenario.level)?.name ?? String(scenario.level),
    hazards: scenario.hazards
      .map((id) => spec.hazards.find((h) => h.id === id)?.name)
      .filter((n): n is string => !!n),
    phase: spec.phases.find((p) => p.id === scenario.phase)?.name ?? scenario.phase,
    region: location.region
      ? (spec.regions.find((r) => r.id === location.region)?.name ?? null)
      : null,
    state: location.state
      ? (BRAZIL_STATES.find((s) => s.code === location.state)?.name ?? null)
      : null,
  }
}
