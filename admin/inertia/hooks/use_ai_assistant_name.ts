import { usePage } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'

/**
 * The assistant's display name. The server sends the custom name, or the English default "AI Assistant"
 * (it does not know the UI language); the default is translated here, a custom name passes through
 * unchanged (no catalog key matches it).
 */
export function useAiAssistantName(): string {
  const { t } = useTranslation()
  const name = usePage<{ aiAssistantName?: string }>().props?.aiAssistantName?.trim()
  return name ? t(name) : t('AI Assistant')
}
