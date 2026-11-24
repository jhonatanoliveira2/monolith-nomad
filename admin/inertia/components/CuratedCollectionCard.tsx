import { formatBytes } from '~/lib/util'
import DynamicIcon, { DynamicIconName } from './DynamicIcon'
import type { CollectionWithStatus } from '../../types/collections'
import classNames from 'classnames'
import { IconCircleCheck } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

export interface CuratedCollectionCardProps {
  collection: CollectionWithStatus
  onClick?: (collection: CollectionWithStatus) => void
  size?: 'small' | 'large'
}

const CuratedCollectionCard: React.FC<CuratedCollectionCardProps> = ({
  collection,
  onClick,
  size = 'small',
}) => {
  const { t } = useTranslation()
  const totalSizeBytes = collection.resources?.reduce(
    (acc, resource) => acc + resource.size_mb * 1024 * 1024,
    0
  )
  return (
    <div
      className={classNames(
        'flex flex-col bg-neutral-950 rounded-[var(--radius-card)] p-6 text-white border border-neutral-800 cursor-pointer',
        'transition-[border-color,transform] duration-[140ms] ease-[cubic-bezier(0.2,0,0,1)] hover:border-neutral-500 active:scale-[0.995]',
        'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        { 'opacity-65 cursor-not-allowed hover:border-neutral-800': collection.all_installed },
        { 'min-h-56': size === 'small', 'min-h-80': size === 'large' }
      )}
      role="button"
      tabIndex={collection.all_installed ? -1 : 0}
      aria-disabled={collection.all_installed || undefined}
      onClick={() => {
        if (collection.all_installed) {
          return
        }
        if (onClick) {
          onClick(collection)
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !collection.all_installed && onClick) {
          e.preventDefault()
          onClick(collection)
        }
      }}
    >
      <div className="flex items-center mb-4">
        <div className="flex justify-between w-full items-center">
          <div className="flex">
            <DynamicIcon icon={collection.icon as DynamicIconName} className="w-6 h-6 mr-2" />
            <h3 className="text-lg font-medium">{collection.name}</h3>
          </div>
          {collection.all_installed && (
            <div className="flex items-center">
              <IconCircleCheck
                className="w-5 h-5 text-white ml-2"
                title={t('All items downloaded')}
              />
              <p className="text-white text-sm ml-1">{t('All items downloaded')}</p>
            </div>
          )}
        </div>
      </div>
      <p className="text-neutral-200 grow">{collection.description}</p>
      <p className="nd-mono text-neutral-400 text-[11px] mt-3">
        {t('Items: {{count}} | Size: {{size}}', {
          count: collection.resources?.length ?? 0,
          size: formatBytes(totalSizeBytes, 0),
        })}
      </p>
    </div>
  )
}
export default CuratedCollectionCard
