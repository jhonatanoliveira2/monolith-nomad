import { useTranslation } from 'react-i18next'
import { IconLanguage } from '@tabler/icons-react'
import { SUPPORTED_LOCALES, setLocale, currentLocale } from '~/lib/i18n'

/** Cycles the interface language (pt-BR default, English). Sits next to the theme toggle. */
export default function LocaleToggle({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const active = SUPPORTED_LOCALES.find((l) => l.code === i18n.language) ?? SUPPORTED_LOCALES[0]
  const next = SUPPORTED_LOCALES[(SUPPORTED_LOCALES.indexOf(active) + 1) % SUPPORTED_LOCALES.length]
  return (
    <button
      type="button"
      onClick={async () => {
        await setLocale(next.code)
        // documentation is rendered by the server in the chosen language
        if (window.location.pathname.startsWith('/docs')) window.location.reload()
      }}
      className={
        className ??
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors duration-[140ms] cursor-pointer'
      }
      title={t('Language: {{name}} (switch to {{next}})', { name: active.label, next: next.label })}
      aria-label={t('Switch language to {{next}}', { next: next.label })}
      data-locale={currentLocale()}
    >
      <IconLanguage className="size-4" />
      <span className="font-mono text-xs tracking-wider">{active.short}</span>
    </button>
  )
}
