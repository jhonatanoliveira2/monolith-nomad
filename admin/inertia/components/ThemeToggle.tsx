import { IconSun, IconMoon } from '@tabler/icons-react'
import { useThemeContext } from '~/providers/ThemeProvider'
import { useTranslation } from 'react-i18next'

interface ThemeToggleProps {
  compact?: boolean
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeContext()
  const isDark = theme === 'dark'
  const { t } = useTranslation()
  const label = isDark ? t('Switch to light mode') : t('Switch to dark mode')

  return (
    <button
      onClick={toggleTheme}
      className={
        compact
          ? 'inline-flex size-9 items-center justify-center rounded-full text-text-secondary transition-colors duration-[140ms] hover:bg-surface-elevated hover:text-text-primary cursor-pointer'
          : 'flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors duration-[140ms] text-text-secondary hover:text-text-primary cursor-pointer'
      }
      aria-label={label}
      title={label}
    >
      {isDark ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
      {!compact && <span>{isDark ? t('Light mode') : t('Dark mode')}</span>}
    </button>
  )
}
