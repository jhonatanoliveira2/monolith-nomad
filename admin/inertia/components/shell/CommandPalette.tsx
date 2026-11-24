import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { router } from '@inertiajs/react'
import { IconArrowRight, IconBooks, IconLanguage, IconMoon, IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from '~/lib/class_names'
import { setLocale, SUPPORTED_LOCALES } from '~/lib/i18n'
import { normalizeSearch, type NavGroup } from '~/lib/nav_config'
import { useThemeContext } from '~/providers/ThemeProvider'

type Command = {
  id: string
  label: string
  group: string
  icon: React.ElementType
  haystack: string
  run: () => void
}

/**
 * Quick access to every screen and a few global actions (Ctrl/⌘ K or "/"). Search is accent- and
 * case-insensitive and also matches pt-BR and English keywords, so "livros", "books" and "pdf" all
 * find the library.
 */
export default function CommandPalette({
  open,
  onClose,
  groups,
}: {
  open: boolean
  onClose: () => void
  groups: NavGroup[]
}) {
  const { t, i18n } = useTranslation()
  const { toggleTheme } = useThemeContext()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
    }
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const nav = groups.flatMap((g) =>
      g.items.map((item) => {
        const label = item.literal ? item.label : t(item.label)
        return {
          id: item.id,
          label,
          group: g.label ? t(g.label) : t('Dashboard'),
          icon: item.icon,
          haystack: normalizeSearch(`${label} ${item.label} ${item.keywords ?? ''}`),
          run: () => {
            if (item.external) window.open(item.href, '_blank', 'noopener,noreferrer')
            else if (item.hardLink) window.location.href = item.href
            else router.visit(item.href)
          },
        }
      })
    )
    const nextLocale =
      SUPPORTED_LOCALES[
        (SUPPORTED_LOCALES.findIndex((l) => l.code === i18n.language) + 1) % SUPPORTED_LOCALES.length
      ]
    const actions: Command[] = [
      {
        id: 'action-theme',
        label: t('Switch light / dark theme'),
        group: t('Actions'),
        icon: IconMoon,
        haystack: normalizeSearch('tema claro escuro theme dark light'),
        run: toggleTheme,
      },
      {
        id: 'action-locale',
        label: t('Switch language to {{next}}', { next: nextLocale.label }),
        group: t('Actions'),
        icon: IconLanguage,
        haystack: normalizeSearch('idioma language english portugues'),
        run: () => {
          setLocale(nextLocale.code)
          if (window.location.pathname.startsWith('/docs')) window.location.reload()
        },
      },
    ]
    return [...nav, ...actions]
  }, [groups, t, i18n.language, toggleTheme])

  const results = useMemo(() => {
    const q = normalizeSearch(query)
    const list = q ? commands.filter((c) => q.split(/\s+/).every((w) => c.haystack.includes(w))) : commands
    if (!q) return list
    // Searching the library is always offered for free text
    return [
      ...list,
      {
        id: 'search-library',
        label: t('Search the library for "{{query}}"', { query: query.trim() }),
        group: t('Library'),
        icon: IconBooks,
        haystack: '',
        run: () => router.visit(`/library?q=${encodeURIComponent(query.trim())}`),
      },
    ]
  }, [commands, query, t])

  useEffect(() => {
    setIndex(0)
  }, [query])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const runAt = (i: number) => {
    const cmd = results[i]
    if (!cmd) return
    onClose()
    cmd.run()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runAt(index)
    }
  }

  let lastGroup = ''
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[70]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-scrim transition-opacity duration-[140ms] data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-[12vh]">
        <DialogPanel
          transition
          className="w-full max-w-xl overflow-hidden rounded-[var(--radius-panel)] border border-border-default bg-surface-primary shadow-2xl transition duration-[140ms] data-[closed]:scale-[0.98] data-[closed]:opacity-0"
        >
          <div className="flex items-center gap-3 border-b border-border-subtle px-5">
            <IconSearch className="size-5 text-text-muted shrink-0" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t('Go to a screen or search the library')}
              className="h-14 w-full bg-transparent text-base text-text-primary placeholder:text-text-muted focus:outline-none"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-palette-list"
              aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
              aria-label={t('Search the interface')}
            />
            <kbd className="nd-kbd">Esc</kbd>
          </div>
          <ul
            id="command-palette-list"
            ref={listRef}
            role="listbox"
            className="max-h-[50vh] overflow-y-auto p-2"
          >
            {results.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-text-muted">{t('Nothing found')}</li>
            )}
            {results.map((cmd, i) => {
              const header = cmd.group !== lastGroup ? cmd.group : null
              lastGroup = cmd.group
              return (
                <li key={cmd.id} role="presentation">
                  {header && <p className="nd-eyebrow px-3 pt-3 pb-1 !text-[10px]">{header}</p>}
                  <div
                    id={`cmd-${cmd.id}`}
                    role="option"
                    aria-selected={i === index}
                    data-index={i}
                    onMouseMove={() => setIndex(i)}
                    onClick={() => runAt(i)}
                    className={classNames(
                      'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm',
                      i === index ? 'bg-surface-elevated text-text-primary' : 'text-text-secondary'
                    )}
                  >
                    <cmd.icon className="size-[18px] shrink-0" stroke={1.75} aria-hidden="true" />
                    <span className="flex-1 truncate">{cmd.label}</span>
                    {i === index && <IconArrowRight className="size-4 text-highlight" aria-hidden="true" />}
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center gap-4 border-t border-border-subtle px-5 py-2.5 nd-mono text-[10px] uppercase tracking-wider text-text-muted">
            <span>↑↓ {t('navigate')}</span>
            <span>↵ {t('open')}</span>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
