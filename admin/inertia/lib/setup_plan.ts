/**
 * Setup wizard (Configuração Rápida) planning logic: download profiles per content category, the
 * Portuguese-first language rule and the totals shown before installing. Pure, unit-tested in
 * tests/unit/setup_plan.spec.ts.
 *
 * Profiles map to the category's tiers in the manifest (collections/kiwix-categories.json):
 *   Essential = first tier, Standard = second, Complete = last; each includes the previous ones.
 * Portuguese first: Portuguese and multilingual resources are included by default; English (and any
 * other language) is an opt-in, per category or per resource. Sizes come from the manifest's
 * `size_mb`; nothing is estimated here.
 */
import type { SpecCategory, SpecResource, SpecTier } from '../../types/collections.js'
import { BRAZIL_REGIONS, BRAZIL_STATES } from '../../constants/brazil.js'

export type SetupProfile = 'essential' | 'standard' | 'complete' | 'custom'
export const PROFILES: Exclude<SetupProfile, 'custom'>[] = ['essential', 'standard', 'complete']

export type CategorySelection = {
  profile: SetupProfile
  /** Include every English/other-language resource of the chosen profile */
  english: boolean
  /** Non-Portuguese resources enabled one by one (profile mode) */
  extra: string[]
  /** Explicit resource ids (custom mode) */
  custom: string[]
}

export type LanguageGroup = 'pt' | 'en' | 'other'

/** `pt`/`pt-BR` and multilingual builds (which include Portuguese) count as Portuguese. */
export function languageGroup(language?: string | null): LanguageGroup {
  const l = (language ?? '').trim().toLowerCase()
  if (l === 'pt' || l === 'pt-br' || l === 'por' || l === 'mul') return 'pt'
  if (l === 'en' || l === 'eng') return 'en'
  return l ? 'other' : 'pt'
}

export const bytesOf = (r: Pick<SpecResource, 'size_mb'>) => (r.size_mb ?? 0) * 1024 * 1024

function resolveTier(tier: SpecTier, all: SpecTier[], seen = new Set<string>()): SpecResource[] {
  if (seen.has(tier.slug)) return []
  seen.add(tier.slug)
  const base = tier.includesTier ? all.find((t) => t.slug === tier.includesTier) : undefined
  return [...(base ? resolveTier(base, all, seen) : []), ...tier.resources]
}

function dedupe(resources: SpecResource[]): SpecResource[] {
  const seen = new Set<string>()
  return resources.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
}

/** The manifest tier behind a profile (custom has none). */
export function profileTier(category: SpecCategory, profile: SetupProfile): SpecTier | null {
  const tiers = category.tiers
  if (!tiers.length || profile === 'custom') return null
  if (profile === 'essential') return tiers[0]
  if (profile === 'standard') return tiers[Math.min(1, tiers.length - 1)]
  return tiers[tiers.length - 1]
}

/** Every resource of the category, once, with the profile that first includes it. */
export function categoryResources(
  category: SpecCategory
): { resource: SpecResource; profile: Exclude<SetupProfile, 'custom'> }[] {
  const out: { resource: SpecResource; profile: Exclude<SetupProfile, 'custom'> }[] = []
  const seen = new Set<string>()
  for (const profile of PROFILES) {
    const tier = profileTier(category, profile)
    if (!tier) continue
    for (const r of resolveTier(tier, category.tiers)) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      out.push({ resource: r, profile })
    }
  }
  return out
}

/** Resources a selection installs (before removing what is already on disk). */
export function selectedResources(category: SpecCategory, sel: CategorySelection): SpecResource[] {
  if (sel.profile === 'custom') {
    const ids = new Set(sel.custom)
    return categoryResources(category)
      .map((x) => x.resource)
      .filter((r) => ids.has(r.id))
  }
  const tier = profileTier(category, sel.profile)
  if (!tier) return []
  const extra = new Set(sel.extra)
  return dedupe(resolveTier(tier, category.tiers)).filter(
    (r) => languageGroup(r.language) === 'pt' || sel.english || extra.has(r.id)
  )
}

export type ProfileSummary = {
  /** Resources included with the current language rule */
  count: number
  bytes: number
  /** Resources left out because they are not in Portuguese */
  foreignCount: number
  foreignBytes: number
  languages: string[]
}

/** What a profile brings, Portuguese-only or with the other languages (`english`). */
export function profileSummary(
  category: SpecCategory,
  profile: Exclude<SetupProfile, 'custom'>,
  english: boolean
): ProfileSummary {
  const tier = profileTier(category, profile)
  const all = tier ? dedupe(resolveTier(tier, category.tiers)) : []
  const included = all.filter((r) => english || languageGroup(r.language) === 'pt')
  const foreign = all.filter((r) => languageGroup(r.language) !== 'pt')
  return {
    count: included.length,
    bytes: included.reduce((s, r) => s + bytesOf(r), 0),
    foreignCount: english ? 0 : foreign.length,
    foreignBytes: english ? 0 : foreign.reduce((s, r) => s + bytesOf(r), 0),
    languages: [...new Set(included.map((r) => (r.language ?? 'pt').toLowerCase()))].sort(),
  }
}

export type ContentPlan = {
  /** Per category: the resource ids to queue (not installed, not downloading) */
  byCategory: { slug: string; tierSlug: string; resourceIds: string[]; bytes: number }[]
  /** Resources already on disk or downloading that the selection includes */
  skipped: number
  bytes: number
}

/**
 * The download plan: what each category selection adds, without duplicates across categories and
 * without what is already installed or downloading.
 */
export function contentPlan(
  categories: SpecCategory[],
  selections: Record<string, CategorySelection>,
  installedIds: Set<string>,
  downloadingIds: Set<string>
): ContentPlan {
  const queued = new Set<string>()
  const byCategory: ContentPlan['byCategory'] = []
  let skipped = 0
  for (const category of categories) {
    const sel = selections[category.slug]
    if (!sel) continue
    const ids: string[] = []
    let bytes = 0
    for (const r of selectedResources(category, sel)) {
      if (installedIds.has(r.id) || downloadingIds.has(r.id)) {
        skipped++
        continue
      }
      if (queued.has(r.id)) continue
      queued.add(r.id)
      ids.push(r.id)
      bytes += bytesOf(r)
    }
    if (ids.length === 0) continue
    const tier =
      profileTier(category, sel.profile === 'custom' ? 'complete' : sel.profile) ??
      category.tiers[0]
    byCategory.push({ slug: category.slug, tierSlug: tier.slug, resourceIds: ids, bytes })
  }
  return { byCategory, skipped, bytes: byCategory.reduce((s, c) => s + c.bytes, 0) }
}

export const DEFAULT_SELECTION: CategorySelection = {
  profile: 'essential',
  english: false,
  extra: [],
  custom: [],
}

export type MapScope = 'none' | 'country' | 'regions' | 'states'

/** Draft persisted between visits (KV ui.easySetupDraft). */
export type SetupDraft = {
  version: 1
  step: number
  services: string[]
  maps: {
    scope: MapScope
    regions: string[]
    states: string[]
    maxzoom: number
    collections: string[]
  }
  categories: Record<string, CategorySelection>
  wikipedia: string | null
  creatorPacks: string[]
  aiModels: string[]
  ingestPolicy: 'Always' | 'Manual'
  timezone: string
  state: string | null
  /** Survival works of the Library to download (official Brazilian PDFs). Absent in older drafts. */
  survivalLibrary: SurvivalLibraryProfile
  /** Living environment and place, for the survival agent's answers. */
  environment: 'urbano' | 'rural' | null
  place: string | null
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')

/** Parse a stored draft; unknown or broken input gives null (the wizard then starts fresh). */
export function parseDraft(raw: unknown): SetupDraft | null {
  let d: any = raw
  if (typeof raw === 'string') {
    try {
      d = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!d || typeof d !== 'object' || d.version !== 1) return null
  if (!isStringArray(d.services) || !isStringArray(d.creatorPacks) || !isStringArray(d.aiModels))
    return null
  if (!d.maps || !['none', 'country', 'regions', 'states'].includes(d.maps.scope)) return null
  if (!isStringArray(d.maps.regions) || !isStringArray(d.maps.states)) return null
  if (!isStringArray(d.maps.collections ?? [])) return null
  if (!d.categories || typeof d.categories !== 'object') return null
  const categories: Record<string, CategorySelection> = {}
  for (const [slug, sel] of Object.entries<any>(d.categories)) {
    if (!sel || !['essential', 'standard', 'complete', 'custom'].includes(sel.profile)) continue
    categories[slug] = {
      profile: sel.profile,
      english: !!sel.english,
      extra: isStringArray(sel.extra) ? sel.extra : [],
      custom: isStringArray(sel.custom) ? sel.custom : [],
    }
  }
  const zoom = d.maps.maxzoom
  return {
    version: 1,
    step: Number.isInteger(d.step) && d.step >= 1 && d.step <= 4 ? d.step : 1,
    services: d.services,
    maps: {
      scope: d.maps.scope,
      regions: d.maps.regions,
      states: d.maps.states,
      maxzoom: Number.isInteger(zoom) && zoom >= 0 && zoom <= 15 ? zoom : 15,
      collections: d.maps.collections ?? [],
    },
    categories,
    wikipedia: typeof d.wikipedia === 'string' ? d.wikipedia : null,
    creatorPacks: d.creatorPacks,
    aiModels: d.aiModels,
    ingestPolicy: d.ingestPolicy === 'Always' ? 'Always' : 'Manual',
    timezone: typeof d.timezone === 'string' ? d.timezone : 'America/Sao_Paulo',
    state: typeof d.state === 'string' ? d.state : null,
    survivalLibrary: SURVIVAL_LIBRARY_PROFILES.includes(d.survivalLibrary)
      ? d.survivalLibrary
      : DEFAULT_SURVIVAL_LIBRARY,
    environment: d.environment === 'urbano' || d.environment === 'rural' ? d.environment : null,
    place: typeof d.place === 'string' ? d.place.slice(0, 80) : null,
  }
}

// ---- Survival library (collections/library.json, area "sobrevivencia") ----

export type SurvivalLibraryProfile = 'none' | 'essential' | 'standard' | 'complete'
export const SURVIVAL_LIBRARY_PROFILES: SurvivalLibraryProfile[] = [
  'none',
  'essential',
  'standard',
  'complete',
]
/** The whole set is ~130 MB of PDFs, so the complete level is the default. */
export const DEFAULT_SURVIVAL_LIBRARY: SurvivalLibraryProfile = 'complete'

/**
 * Works added at each level (each level includes the previous ones):
 * - essential: what a family uses first — community preparedness by hazard (MMA), safe water at
 *   home, venomous animals, smoke from fires;
 * - standard: Ministry of Health contingency plans and flood guidance, Civil Defence (MDR), water
 *   quality, violence prevention in shelters, regional foods;
 * - complete: clinical protocols for snake and scorpion accidents and the 3-volume surveillance
 *   guide (epidemics), written for health professionals.
 */
export const SURVIVAL_LIBRARY_TIERS: Record<Exclude<SurvivalLibraryProfile, 'none'>, string[]> = {
  essential: [
    'mma-guia-dialogos-eventos-extremos',
    'mma-caderno-inundacoes',
    'mma-caderno-deslizamentos',
    'mma-caderno-secas',
    'mma-caderno-incendios',
    'mma-caderno-ondas-de-calor',
    'ms-agua-tratada-em-casa',
    'ms-guia-animais-peconhentos',
    'ms-queimadas-incendios',
  ],
  standard: [
    'ms-qualidade-da-agua',
    'ms-guia-inundacao',
    'ms-inundacoes-abrigos',
    'ms-inundacoes-ubs',
    'ms-plano-chuvas-intensas',
    'ms-plano-seca-estiagem',
    'ms-plano-barragens',
    'ms-violencias-emergencias-climaticas',
    'mdr-caderno-gird',
    'mdr-guia-alertas',
    'ms-alimentos-regionais',
  ],
  complete: [
    'ms-pcdt-acidentes-ofidicos',
    'ms-pcdt-acidentes-escorpionicos',
    'ms-guia-vigilancia-saude-vol-1',
    'ms-guia-vigilancia-saude-vol-2',
    'ms-guia-vigilancia-saude-vol-3',
  ],
}

export function survivalLibraryIds(profile: SurvivalLibraryProfile): string[] {
  if (profile === 'none') return []
  const order: Exclude<SurvivalLibraryProfile, 'none'>[] = ['essential', 'standard', 'complete']
  return order.slice(0, order.indexOf(profile) + 1).flatMap((tier) => SURVIVAL_LIBRARY_TIERS[tier])
}

type SurvivalItem = {
  id: string
  title: string
  files: { format: string; status: string; size_bytes?: number }[]
}

/**
 * PDFs to queue for a survival level: works present in the manifest whose PDF is not installed or
 * already downloading. Ids missing from the manifest (an older cached copy) are simply skipped.
 */
export function survivalLibraryPlan(items: SurvivalItem[], profile: SurvivalLibraryProfile) {
  const wanted = new Set(survivalLibraryIds(profile))
  const queue: { id: string; title: string; bytes: number }[] = []
  let skipped = 0
  for (const item of items) {
    if (!wanted.has(item.id)) continue
    const pdf = item.files.find((f) => f.format === 'pdf')
    if (!pdf) continue
    if (pdf.status === 'installed' || pdf.status === 'downloading') {
      skipped++
      continue
    }
    queue.push({ id: item.id, title: item.title, bytes: pdf.size_bytes ?? 0 })
  }
  return { queue, skipped, bytes: queue.reduce((n, q) => n + q.bytes, 0) }
}

/** ISO codes for the map extract of a draft (BR, or the BR-XX states of the chosen regions/states). */
export function mapCodes(maps: SetupDraft['maps']): string[] {
  if (maps.scope === 'country') return ['BR']
  if (maps.scope === 'regions') {
    return BRAZIL_STATES.filter((s) => maps.regions.includes(s.region))
      .map((s) => s.code)
      .sort()
  }
  if (maps.scope === 'states') {
    return [...new Set(maps.states)].filter((c) => BRAZIL_STATES.some((s) => s.code === c)).sort()
  }
  return []
}

/** Human label for the extract (shown in Downloads and the Maps Manager), up to 64 characters. */
export function mapLabel(maps: SetupDraft['maps']): string {
  const names = (ids: string[], list: { id?: string; code?: string; name: string }[]) =>
    ids.map((id) => list.find((x) => (x.id ?? x.code) === id)?.name ?? id)
  let label = ''
  if (maps.scope === 'country') label = 'Brasil'
  else if (maps.scope === 'regions') {
    const n = names(maps.regions, [...BRAZIL_REGIONS])
    label = n.length === 1 ? `Região ${n[0]}` : `Regiões ${n.join(', ')}`
  } else if (maps.scope === 'states') {
    // valid states only, once each, in the order the user picked them
    const valid = [...new Set(maps.states)].filter((c) => BRAZIL_STATES.some((s) => s.code === c))
    const n = names(valid, BRAZIL_STATES)
    label = n.length <= 3 ? n.join(', ') : `${n.slice(0, 2).join(', ')} e mais ${n.length - 2}`
  }
  return label.length > 64 ? `${label.slice(0, 63)}…` : label
}

/**
 * File-name prefix the server gives this extract (MapService.buildRegionSlug), to recognise a map
 * that is already on disk. Null when the server would use a hash (several states that are not a region).
 */
export function mapSlug(maps: SetupDraft['maps']): string | null {
  const codes = mapCodes(maps)
  if (codes.length === 0) return null
  if (codes.length === 1) return codes[0].toLowerCase()
  const region = BRAZIL_REGIONS.find((r) => {
    const inRegion = BRAZIL_STATES.filter((s) => s.region === r.id).map((s) => s.code)
    return inRegion.length === codes.length && inRegion.every((c) => codes.includes(c))
  })
  return region ? `br-${region.id}` : null
}
