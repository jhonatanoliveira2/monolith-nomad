import { useTranslation } from 'react-i18next'

export type TocNode = { id: string; label: string; target: unknown; children: TocNode[] }

/** Table of contents for both readers (PDF outline, EPUB navigation). */
export default function ReaderToc({
  nodes,
  empty,
  onSelect,
}: {
  nodes: TocNode[]
  empty: string
  onSelect: (node: TocNode) => void
}) {
  const { t } = useTranslation()
  const render = (list: TocNode[], depth: number) => (
    <ul className={depth > 0 ? 'ml-3 border-l border-border-subtle' : ''}>
      {list.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => onSelect(node)}
            className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary cursor-pointer"
          >
            {node.label.trim()}
          </button>
          {node.children.length > 0 && render(node.children, depth + 1)}
        </li>
      ))}
    </ul>
  )
  return (
    <nav aria-label={t('Contents')} className="flex min-h-0 flex-1 flex-col">
      <p className="nd-eyebrow border-b border-border-subtle px-5 py-4">{t('Contents')}</p>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {nodes.length === 0 ? (
          <p className="px-3 py-6 text-sm text-text-muted">{empty}</p>
        ) : (
          render(nodes, 0)
        )}
      </div>
    </nav>
  )
}
