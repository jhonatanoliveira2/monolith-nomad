import { useQuery } from '@tanstack/react-query'
import { IconLanguage, IconPlayerStop, IconSend, IconSparkles } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '~/lib/api'
import SegmentedControl from '~/components/nd/SegmentedControl'
import StyledButton from '~/components/StyledButton'
import { useSystemSetting } from '~/hooks/use_system_setting'
import type { ChatSource, ChatSourceLocation } from '../../../types/chat'
import type { TranslationLanguage, TranslationResponse } from '../../../types/assistant'
import type { ReaderApi, ReaderPassageText } from './types'

type Tab = 'ask' | 'explain' | 'summarize' | 'translate'
type Turn = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  streaming?: boolean
  progress?: { done: number; total: number }
}

/** Same compact markdown styling as the chat bubbles (no typography plugin in this build). */
const MARKDOWN = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-disc pl-5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 list-decimal pl-5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="mb-1">{children}</li>,
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-1.5 mt-2 font-semibold">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 mt-2 font-medium">{children}</h3>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-border-subtle px-2 py-1 text-left">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-border-subtle px-2 py-1">{children}</td>
  ),
}

const MAX_PASSAGE = 24_000
const MAX_TRANSLATE = 12_000
const MAX_RANGE_PAGES = 15
const LANGS: { value: TranslationLanguage; label: string }[] = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
]

/**
 * The local AI inside the reader: questions about the open book, explanations of a selection,
 * summaries of a page, a page range or a chapter (done in parts when long), and translation of a
 * selection or the open page on demand. Answers cite the pages used, and a cited page opens in place.
 * Nothing leaves the machine and the book file is never modified.
 */
export default function ReaderAssistantPanel({
  filename,
  apiRef,
}: {
  filename: string
  apiRef: React.MutableRefObject<ReaderApi | null>
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('ask')
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [target, setTarget] = useState<TranslationLanguage>('pt')
  const [translation, setTranslation] = useState<
    (TranslationResponse & { label: string; what: 'selection' | 'page' }) | null
  >(null)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { data: models = [] } = useQuery({
    queryKey: ['installedModels'],
    queryFn: () => api.getInstalledModels(),
    select: (data) => data || [],
  })
  const { data: lastModel } = useSystemSetting({ key: 'chat.lastModel' })
  const [model, setModel] = useState('')
  useEffect(() => {
    if (model || models.length === 0) return
    const preferred = String(lastModel?.value ?? '')
    setModel(models.some((m) => m.name === preferred) ? preferred : models[0].name)
  }, [models, lastModel, model])

  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [turns])

  const reader = () => apiRef.current
  const isPdf = !!reader()?.rangeText

  async function passageFor(kind: 'current' | 'range'): Promise<ReaderPassageText | null> {
    const r = reader()
    if (!r) return null
    if (kind === 'range' && r.rangeText) {
      const total = r.pageCount?.() ?? 0
      const from = Math.max(1, Number(range.from) || r.location().page || 1)
      const to = Math.min(total || from, Number(range.to) || from, from + MAX_RANGE_PAGES - 1)
      return r.rangeText(from, Math.max(from, to))
    }
    return r.currentText()
  }

  async function run(action: 'chat' | 'explain' | 'summarize', opts: { range?: boolean } = {}) {
    const r = reader()
    if (!r || !model || busy) return
    setError(null)
    const passage = await passageFor(opts.range ? 'range' : 'current')
    if (!passage || !passage.text.trim()) {
      setError(t('This page has no extractable text (it may be a scanned image).'))
      return
    }
    const selection = action !== 'summarize' ? r.selection() : ''
    const userText =
      action === 'chat'
        ? question.trim()
        : action === 'explain'
          ? selection
            ? t('Explain the selection: "{{text}}"', { text: selection.slice(0, 200) })
            : t('Explain {{where}}', { where: passage.label })
          : t('Summarize {{where}}', { where: passage.label })
    if (!userText) return
    const history = turns
      .filter((x) => !x.streaming && x.content)
      .slice(-8)
      .map((x) => ({ role: x.role, content: x.content }))
    const answerId = `a-${Date.now()}`
    setTurns((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: userText },
      { id: answerId, role: 'assistant', content: '', streaming: true },
    ])
    setQuestion('')
    setBusy(true)
    const abort = new AbortController()
    abortRef.current = abort
    const update = (patch: Partial<Turn> | ((turn: Turn) => Partial<Turn>)) =>
      setTurns((prev) =>
        prev.map((x) =>
          x.id === answerId ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x
        )
      )
    try {
      await api.streamReaderAssistant(
        {
          filename,
          action,
          model,
          passage: {
            text: passage.text.slice(0, MAX_PASSAGE),
            label: passage.label,
            ...(passage.page ? { page: passage.page } : {}),
            ...(passage.href ? { href: passage.href } : {}),
          },
          ...(selection ? { selection: selection.slice(0, 4000) } : {}),
          ...(action === 'chat' ? { question: userText } : {}),
          ...(action === 'chat' && history.length ? { history } : {}),
        },
        {
          onChunk: (chunk) => update((x) => ({ content: x.content + chunk })),
          onSources: (sources) => update({ sources }),
          onProgress: (done, total) => update({ progress: { done, total } }),
        },
        abort.signal
      )
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        update({
          content: t('Sorry, there was an error processing your request. Please try again.'),
        })
      }
    } finally {
      update({ streaming: false, progress: undefined })
      setBusy(false)
    }
  }

  async function translate(what: 'selection' | 'page') {
    const r = reader()
    if (!r || busy) return
    setError(null)
    let text = ''
    let label = ''
    if (what === 'selection') {
      text = r.selection()
      label = r.location().label
      if (!text) {
        setError(t('Select a passage in the book first.'))
        return
      }
    } else {
      const passage = await r.currentText()
      text = passage.text
      label = passage.label
    }
    if (text.length > MAX_TRANSLATE) {
      setError(t('Too long to translate at once: select a shorter passage.'))
      return
    }
    setBusy(true)
    try {
      const result = await api.translateText({ text, target, ...(model ? { model } : {}) })
      setTranslation({ ...result, label, what })
    } catch (e) {
      setError(e instanceof Error ? t(e.message) : t('Translation failed.'))
    } finally {
      setBusy(false)
    }
  }

  const openLocation = (loc: ChatSourceLocation) =>
    reader()?.goTo({ page: loc.page, href: loc.href })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-border-subtle p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="nd-eyebrow flex items-center gap-1.5">
            <IconSparkles size={14} aria-hidden="true" />
            {t('Local assistant')}
          </p>
          {models.length > 0 ? (
            <select
              aria-label={t('Model')}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="nd-field !w-auto max-w-[11rem] !py-1 !text-xs"
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-desert-red-dark">{t('No models installed')}</span>
          )}
        </div>
        <SegmentedControl
          size="sm"
          label={t('Assistant action')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'ask', label: t('Ask') },
            { value: 'explain', label: t('Explain') },
            { value: 'summarize', label: t('Summarize') },
            { value: 'translate', label: t('Translate') },
          ]}
        />
        {tab === 'explain' && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted">
              {t(
                'Select a passage in the book, then explain it. Without a selection, the open page is explained.'
              )}
            </p>
            <StyledButton
              size="sm"
              fullWidth
              disabled={busy || !model}
              onClick={() => run('explain')}
            >
              {t('Explain')}
            </StyledButton>
          </div>
        )}
        {tab === 'summarize' && (
          <div className="space-y-2">
            <StyledButton
              size="sm"
              fullWidth
              disabled={busy || !model}
              onClick={() => run('summarize')}
            >
              {isPdf ? t('Summarize this page') : t('Summarize this chapter')}
            </StyledButton>
            {isPdf && (
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <span>{t('Pages')}</span>
                <input
                  inputMode="numeric"
                  aria-label={t('From page')}
                  className="nd-field !w-16 !px-2 !py-1 !text-xs"
                  value={range.from}
                  onChange={(e) =>
                    setRange((r) => ({ ...r, from: e.target.value.replace(/\D/g, '') }))
                  }
                />
                <span>–</span>
                <input
                  inputMode="numeric"
                  aria-label={t('To page')}
                  className="nd-field !w-16 !px-2 !py-1 !text-xs"
                  value={range.to}
                  onChange={(e) =>
                    setRange((r) => ({ ...r, to: e.target.value.replace(/\D/g, '') }))
                  }
                />
                <StyledButton
                  size="sm"
                  variant="secondary"
                  disabled={busy || !model || !range.from}
                  onClick={() => run('summarize', { range: true })}
                >
                  {t('Summarize pages')}
                </StyledButton>
              </div>
            )}
            <p className="text-xs text-text-muted">
              {t(
                'Long passages are summarized in parts and then combined (up to {{n}} pages at a time).',
                { n: MAX_RANGE_PAGES }
              )}
            </p>
          </div>
        )}
        {tab === 'translate' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <IconLanguage size={16} className="text-text-muted" aria-hidden="true" />
              <label className="text-xs text-text-secondary" htmlFor="reader-translate-target">
                {t('Translate into')}
              </label>
              <select
                id="reader-translate-target"
                className="nd-field !w-auto !py-1 !text-xs"
                value={target}
                onChange={(e) => setTarget(e.target.value as TranslationLanguage)}
              >
                {LANGS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StyledButton
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => translate('selection')}
              >
                {t('Translate selection')}
              </StyledButton>
              <StyledButton
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => translate('page')}
              >
                {isPdf ? t('Translate page') : t('Translate chapter')}
              </StyledButton>
            </div>
            <p className="text-xs text-text-muted">
              {t(
                'Only what you ask is translated, on this computer. Translations are cached; the original file is never changed.'
              )}
            </p>
          </div>
        )}
        {error && <p className="text-xs text-desert-red-dark">{error}</p>}
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
      >
        {tab === 'translate' ? (
          translation ? (
            <div className="space-y-2">
              <p className="text-xs text-text-muted">
                {translation.label} ·{' '}
                {translation.engine === 'bergamot'
                  ? 'Bergamot'
                  : translation.engine.startsWith('llm:')
                    ? translation.engine.slice(4)
                    : t('cache')}
                {' · '}
                {t('{{cached}} of {{total}} parts from cache', {
                  cached: translation.cachedSegments,
                  total: translation.segments.length,
                })}
              </p>
              <div className="whitespace-pre-wrap rounded-xl bg-surface-secondary p-3 text-sm text-text-primary">
                {translation.segments.map((s) => s.translated + s.after).join('')}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t('The translation appears here.')}</p>
          )
        ) : turns.length === 0 ? (
          <p className="text-sm text-text-muted">
            {t(
              'Ask about this book, or select a passage and use Explain. Answers cite the pages they use.'
            )}
          </p>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className={
                turn.role === 'user'
                  ? 'ml-6 rounded-xl bg-desert-green px-3 py-2 text-sm text-white'
                  : 'rounded-xl bg-surface-secondary px-3 py-2 text-sm text-text-primary'
              }
            >
              {turn.progress && (
                <p className="mb-1 text-xs text-text-muted">
                  {t('Summarizing part {{done}} of {{total}}…', {
                    done: Math.min(turn.progress.done + 1, turn.progress.total),
                    total: turn.progress.total,
                  })}
                </p>
              )}
              {turn.role === 'assistant' ? (
                <div className="break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN}>
                    {turn.content || (turn.streaming ? '…' : '')}
                  </ReactMarkdown>
                </div>
              ) : (
                turn.content
              )}
              {turn.sources && turn.sources.length > 0 && (
                <div className="mt-2 border-t border-border-subtle pt-1.5 text-xs">
                  <p className="mb-0.5 font-medium">{t('Sources')}</p>
                  <ul className="space-y-0.5">
                    {turn.sources.map((src, i) => (
                      <li key={i} className="text-text-secondary">
                        <span className="text-text-primary">{src.title}</span>
                        {src.locations?.map((loc) => (
                          <button
                            key={loc.label}
                            type="button"
                            onClick={() => openLocation(loc)}
                            className="ml-1.5 underline decoration-border-default underline-offset-2 hover:text-text-primary"
                          >
                            {loc.label}
                          </button>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {tab === 'ask' && (
        <form
          className="flex items-end gap-2 border-t border-border-subtle p-3"
          onSubmit={(e) => {
            e.preventDefault()
            run('chat')
          }}
        >
          <label className="sr-only" htmlFor="reader-question">
            {t('Question about this book')}
          </label>
          <textarea
            id="reader-question"
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                run('chat')
              }
            }}
            placeholder={t('Ask about this book…')}
            className="nd-field min-h-[2.5rem] flex-1 resize-none !text-sm"
          />
          {busy ? (
            <StyledButton
              size="sm"
              variant="secondary"
              aria-label={t('Stop')}
              onClick={() => abortRef.current?.abort()}
            >
              <IconPlayerStop size={16} />
            </StyledButton>
          ) : (
            <button
              type="submit"
              aria-label={t('Send')}
              disabled={!question.trim() || !model}
              className="inline-flex size-10 items-center justify-center rounded-full bg-desert-green text-white hover:bg-desert-green/90 disabled:opacity-40"
            >
              <IconSend size={16} />
            </button>
          )}
        </form>
      )}
    </div>
  )
}
