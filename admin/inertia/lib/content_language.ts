/**
 * Content-language metadata for catalog packages (the `language` field of the
 * collection manifests). Pure so it can be unit-tested without React.
 */
export type ContentLanguageInfo = {
  /** Text inside the badge. */
  short: string
  /** English i18n key for the tooltip; translated by the caller. */
  label: string
  kind: 'portuguese' | 'english' | 'multilingual' | 'other'
}

export function contentLanguageInfo(code?: string | null): ContentLanguageInfo | null {
  const c = (code ?? '').trim().toLowerCase()
  if (!c) return null
  if (c === 'pt' || c === 'pt-br' || c === 'por') {
    return { short: 'PT', label: 'Content in Portuguese', kind: 'portuguese' }
  }
  if (c === 'en' || c === 'eng') {
    return { short: 'EN', label: 'Content in English', kind: 'english' }
  }
  if (c === 'mul') {
    return {
      short: 'MULTI',
      label: 'Multilingual content (includes Portuguese)',
      kind: 'multilingual',
    }
  }
  return { short: c.toUpperCase(), label: 'Content language', kind: 'other' }
}
