/**
 * Interface translations (i18next). Brazilian Portuguese is the default language; English is the source.
 *
 * Convention: the KEY is the English source text, e.g. t('Settings'), t('Downloaded {{size}} of {{total}}', {...}).
 * A missing translation therefore shows the English text (already interpolated), never a raw key. Catalogs are
 * flat JSON files under inertia/locales/<locale>/*.json; all files of a locale are merged, so each area of the
 * UI can keep its own file. Adding a language = adding a folder (see inertia/locales/README.md).
 *
 * Bundled with the app (no network): this is an offline-first server.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const SUPPORTED_LOCALES = [
  { code: 'pt-BR', label: 'Português (Brasil)', short: 'PT' },
  { code: 'en', label: 'English', short: 'EN' },
] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]['code']
export const DEFAULT_LOCALE: Locale = 'pt-BR'
const STORAGE_KEY = 'nomad:locale'

type Catalog = Record<string, string>
const files = import.meta.glob<Catalog>('../locales/*/*.json', { eager: true, import: 'default' })

const resources: Record<string, { translation: Catalog }> = {}
for (const [file, catalog] of Object.entries(files)) {
  const locale = file.split('/').at(-2)!
  resources[locale] ??= { translation: {} }
  Object.assign(resources[locale].translation, catalog)
}

function isLocale(value: unknown): value is Locale {
  return SUPPORTED_LOCALES.some((l) => l.code === value)
}

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {}
  return DEFAULT_LOCALE
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale(),
  fallbackLng: 'en',
  // keys are natural English sentences: '.' and ':' are text, not separators
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false }, // React already escapes
  returnEmptyString: false,
  react: { useSuspense: false },
})

function applyDocumentLanguage(locale: string) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  // mirrored for the server (documentation pages are rendered there): app/utils/locale.ts
  document.cookie = `nomad_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`
}
applyDocumentLanguage(i18n.language)

export function setLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {}
  applyDocumentLanguage(locale)
  return i18n.changeLanguage(locale)
}

export function currentLocale(): Locale {
  return isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
}

/** For code outside React components (module-level helpers, notifications). Components use useTranslation(). */
export const t = i18n.t.bind(i18n)

export default i18n
