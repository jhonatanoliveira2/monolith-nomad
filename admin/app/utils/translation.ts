/**
 * Pure rules of on-demand translation (reader passages, selections): language detection, splitting a
 * passage into cacheable segments and the cache key. No I/O, unit-tested directly.
 *
 * Translation is always of what the reader is looking at, never of a whole document: a request is
 * capped at TRANSLATION_MAX_CHARS, segments are cached individually, and the original file is never
 * touched (the translation lives only in the response and the cache table).
 */
import { createHash } from 'node:crypto'

export const TRANSLATION_LANGUAGES = ['pt', 'en', 'es', 'fr', 'de', 'it'] as const
export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number]

/** About two reader pages. */
export const TRANSLATION_MAX_CHARS = 12_000
/** Segment size: a long paragraph, small enough for a fast model call and a useful cache hit. */
export const SEGMENT_MAX_CHARS = 1_200

const STOPWORDS: Record<TranslationLanguage, string[]> = {
  pt: [
    'de',
    'que',
    'não',
    'para',
    'uma',
    'com',
    'os',
    'as',
    'do',
    'da',
    'em',
    'é',
    'são',
    'mais',
    'pelo',
    'também',
    'você',
    'água',
  ],
  en: [
    'the',
    'and',
    'of',
    'to',
    'is',
    'in',
    'that',
    'it',
    'for',
    'with',
    'are',
    'this',
    'be',
    'or',
    'by',
    'from',
    'water',
    'you',
  ],
  es: [
    'el',
    'los',
    'las',
    'que',
    'del',
    'por',
    'para',
    'con',
    'una',
    'es',
    'son',
    'pero',
    'también',
    'agua',
    'muy',
    'como',
    'se',
    'y',
  ],
  fr: [
    'le',
    'les',
    'des',
    'et',
    'est',
    'une',
    'pour',
    'dans',
    'que',
    'qui',
    'pas',
    'sur',
    'avec',
    'eau',
    'sont',
    'du',
    'au',
    'ce',
  ],
  de: [
    'der',
    'die',
    'und',
    'das',
    'ist',
    'nicht',
    'mit',
    'ein',
    'eine',
    'für',
    'auf',
    'den',
    'sich',
    'auch',
    'wasser',
    'dem',
    'zu',
    'von',
  ],
  it: [
    'il',
    'che',
    'gli',
    'della',
    'per',
    'una',
    'non',
    'sono',
    'con',
    'del',
    'anche',
    'acqua',
    'come',
    'più',
    'questo',
    'di',
    'e',
    'la',
  ],
}

/**
 * Most likely language of a passage by stop-word frequency, or null when there is too little text or
 * no clear winner (then the caller asks the user or lets the model infer). Good enough to pick the
 * source of a translation; not a general-purpose identifier.
 */
export function detectLanguage(text: string): TranslationLanguage | null {
  const words = text
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
  if (words.length < 4) return null
  const scores = TRANSLATION_LANGUAGES.map((lang) => {
    const set = new Set(STOPWORDS[lang])
    return { lang, hits: words.reduce((n, w) => n + (set.has(w) ? 1 : 0), 0) }
  }).sort((a, b) => b.hits - a.hits)
  const [best, second] = scores
  if (best.hits < 2 || best.hits < second.hits * 1.3) return null
  return best.lang
}

export type Segment = {
  text: string
  /** whitespace that followed it in the original */ after: string
}

/**
 * Split a passage into segments of at most `max` characters, on paragraph breaks first, then
 * sentence ends, then spaces, so every segment is a sensible unit to translate and joining
 * `text + after` gives back the original exactly.
 */
export function segmentText(text: string, max = SEGMENT_MAX_CHARS): Segment[] {
  const out: Segment[] = []
  const paragraphs = text.split(/(\n\s*\n)/)
  for (let i = 0; i < paragraphs.length; i += 2) {
    const para = paragraphs[i]
    const breakAfter = paragraphs[i + 1] ?? ''
    if (!para) {
      if (breakAfter && out.length > 0) out[out.length - 1].after += breakAfter
      continue
    }
    const pieces = splitLong(para, max)
    pieces.forEach((piece, idx) => {
      out.push({ ...piece, after: piece.after + (idx === pieces.length - 1 ? breakAfter : '') })
    })
  }
  return out
}

function splitLong(para: string, max: number): Segment[] {
  if (para.length <= max) return [{ text: para, after: '' }]
  const pieces: Segment[] = []
  let rest = para
  while (rest.length > max) {
    const window = rest.slice(0, max)
    let cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '))
    cut = cut > max * 0.4 ? cut + 1 : window.lastIndexOf(' ')
    if (cut <= 0) cut = max
    const head = rest.slice(0, cut)
    const spaces = /^\s*/.exec(rest.slice(cut))![0]
    pieces.push({ text: head, after: spaces })
    rest = rest.slice(cut + spaces.length)
  }
  if (rest) pieces.push({ text: rest, after: '' })
  return pieces
}

/** Cache key of one segment: the same text in the same direction is translated once. */
export function translationCacheKey(source: string, target: string, text: string): string {
  return createHash('sha256').update(`${source}\u0000${target}\u0000${text.trim()}`).digest('hex')
}

/** Segments that are only numbers, symbols or whitespace are kept as they are. */
export function isTranslatable(text: string): boolean {
  return /\p{L}{2,}/u.test(text)
}

export const LANGUAGE_NAMES: Record<TranslationLanguage, string> = {
  pt: 'português do Brasil',
  en: 'inglês',
  es: 'espanhol',
  fr: 'francês',
  de: 'alemão',
  it: 'italiano',
}
