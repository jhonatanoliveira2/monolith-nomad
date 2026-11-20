/**
 * Interface language on the server side (documentation pages are rendered by the server, which cannot see the
 * browser's localStorage). The browser mirrors the chosen language into the `nomad_locale` cookie
 * (inertia/lib/i18n.ts); without it the default is Brazilian Portuguese.
 */
export const SUPPORTED_LOCALES = ['pt-BR', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'pt-BR'
export const LOCALE_COOKIE = 'nomad_locale'

export function resolveLocale(value: unknown): Locale {
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE
}

/** Documentation files: `<slug>.<locale>.md` when present, `<slug>.md` (English) otherwise. */
export function localizedDocCandidates(slug: string, locale: Locale): string[] {
  const base = slug.replace(/\.md$/, '')
  return locale === 'en' ? [`${base}.md`] : [`${base}.${locale}.md`, `${base}.md`]
}

/** `about.pt-BR.md` → { slug: 'about', locale: 'pt-BR' }; `about.md` → { slug: 'about', locale: null }. */
export function parseDocFilename(filename: string): { slug: string; locale: Locale | null } {
  const name = filename.replace(/\.md$/, '')
  for (const l of SUPPORTED_LOCALES) {
    if (name.endsWith(`.${l}`)) return { slug: name.slice(0, -(l.length + 1)), locale: l }
  }
  return { slug: name, locale: null }
}

const DOC_TITLES: Record<Locale, Record<string, string>> = {
  'pt-BR': {
    'home': 'Início',
    'getting-started': 'Primeiros Passos',
    'use-cases': 'Casos de Uso',
    'supply-depot-apps': 'Apps do Depósito',
    'drug-reference': 'Bulário',
    'community-add-ons': 'Complementos da Comunidade',
    'updates': 'Atualizações',
    'faq': 'Perguntas Frequentes',
    'about': 'Sobre',
    'release-notes': 'Notas de Versão',
    'api-reference': 'Referência da API',
  },
  'en': {
    'faq': 'FAQ',
    'community-add-ons': 'Community Add-Ons',
  },
}

export function docTitle(slug: string, locale: Locale): string | null {
  return DOC_TITLES[locale][slug] ?? null
}
