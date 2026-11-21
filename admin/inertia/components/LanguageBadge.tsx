import { useTranslation } from 'react-i18next'
import { contentLanguageInfo } from '~/lib/content_language'

/**
 * Small badge naming the language of a content package (PT, EN, MULTI), so a
 * user can tell a Portuguese ZIM from an English one before downloading it.
 * Renders nothing when the manifest did not declare a language.
 */
export default function LanguageBadge({ language }: { language?: string | null }) {
  const { t } = useTranslation()
  const info = contentLanguageInfo(language)
  if (!info) return null
  const tone =
    info.kind === 'portuguese'
      ? 'bg-desert-green/15 text-desert-green border-desert-green/30'
      : 'bg-desert-olive/10 text-text-secondary border-desert-olive/30'
  return (
    <span
      title={t(info.label)}
      aria-label={t(info.label)}
      className={`inline-block align-middle ml-1.5 px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wide font-semibold flex-shrink-0 ${tone}`}
    >
      {info.short}
    </span>
  )
}
