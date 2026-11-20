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
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors
                 text-desert-stone hover:text-desert-green-darker cursor-pointer"
      aria-label={label}
      title={label}
    >
      {isDark ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
      {!compact && <span>{isDark ? t('Light mode') : t('Dark mode')}</span>}
    </button>
  )
}
