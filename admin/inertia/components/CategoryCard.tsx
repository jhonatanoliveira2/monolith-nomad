import { formatBytes } from '~/lib/util'
import DynamicIcon, { DynamicIconName } from './DynamicIcon'
import type { CategoryWithStatus, SpecTier } from '../../types/collections'
import classNames from 'classnames'
import { IconChevronRight, IconCircleCheck, IconLoader2 } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

export interface CategoryCardProps {
  category: CategoryWithStatus
  selectedTier?: SpecTier | null
  onClick?: (category: CategoryWithStatus) => void
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, selectedTier, onClick }) => {
  const { t } = useTranslation()
  // Calculate total size range across all tiers
  const getTierTotalSize = (tier: SpecTier, allTiers: SpecTier[]): number => {
    let total = tier.resources.reduce((acc, r) => acc + r.size_mb * 1024 * 1024, 0)

    // Add included tier sizes recursively
    if (tier.includesTier) {
      const includedTier = allTiers.find((t) => t.slug === tier.includesTier)
      if (includedTier) {
        total += getTierTotalSize(includedTier, allTiers)
      }
    }

    return total
  }

  const minSize = getTierTotalSize(category.tiers[0], category.tiers)
  const maxSize = getTierTotalSize(category.tiers[category.tiers.length - 1], category.tiers)

  // Priority order for the prominent corner badge + highlight border:
  //   1. selectedTier — in-session wizard pick (highest priority, reflects
  //      what the user is editing right now)
  //   2. downloadingTierSlug — backend-derived from in-flight downloads, so
  //      the card shows the user's intent immediately after Submit, before
  //      any single file has finished downloading
  //   3. installedTierSlug — fully on disk
  const downloadingTier =
    !selectedTier && category.downloadingTierSlug
      ? category.tiers.find((t) => t.slug === category.downloadingTierSlug)
      : null
  const installedTier =
    !selectedTier && !downloadingTier && category.installedTierSlug
      ? category.tiers.find((t) => t.slug === category.installedTierSlug)
      : null
  const badgeTier = selectedTier || downloadingTier || installedTier
  const badgeStatus: 'selected' | 'downloading' | 'installed' | null = selectedTier
    ? 'selected'
    : downloadingTier
      ? 'downloading'
      : installedTier
        ? 'installed'
        : null
  const highlightedTierSlug = badgeTier?.slug

  return (
    <div
      className={classNames(
        'flex flex-col bg-neutral-950 rounded-[var(--radius-card)] p-6 text-white border cursor-pointer min-h-72 text-left',
        'transition-[border-color,transform] duration-[140ms] ease-[cubic-bezier(0.2,0,0,1)] hover:border-neutral-500 active:scale-[0.995]',
        'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        badgeTier ? 'border-white' : 'border-neutral-800'
      )}
      role="button"
      tabIndex={0}
      aria-label={t('Choose a tier for {{name}}', { name: category.name })}
      onClick={() => onClick?.(category)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(category)
        }
      }}
    >
      <div className="flex items-center mb-4">
        <div className="flex justify-between w-full items-center">
          <div className="flex items-center">
            <DynamicIcon icon={category.icon as DynamicIconName} className="w-6 h-6 mr-2" />
            <h3 className="text-lg font-medium">{category.name}</h3>
          </div>
          {badgeTier ? (
            <div className="flex items-center">
              {badgeStatus === 'downloading' ? (
                <IconLoader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <IconCircleCheck className="w-5 h-5 text-white" />
              )}
              <span className="text-white text-sm ml-1">
                {badgeTier.name}
                {badgeStatus === 'downloading' &&
                  ` ${category.downloadingTierIndexing ? t('(indexing)') : t('(downloading)')}`}
              </span>
            </div>
          ) : (
            <IconChevronRight className="w-5 h-5 text-white opacity-70" />
          )}
        </div>
      </div>

      <p className="text-neutral-200 grow">{category.description}</p>

      <div className="mt-4 pt-4 border-t border-white/15">
        <p className="text-sm text-neutral-300 mb-2">
          {category.tiers.length === 1
            ? t('1 tier available')
            : t('{{count}} tiers available', { count: category.tiers.length })}
          {!highlightedTierSlug && (
            <span className="text-neutral-400"> - {t('Click to choose')}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {category.tiers.map((tier) => {
            const isInstalled = tier.slug === highlightedTierSlug
            return (
              <span
                key={tier.slug}
                className={classNames(
                  'nd-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full',
                  isInstalled ? 'bg-white text-black' : 'bg-white/10 text-neutral-300',
                  selectedTier?.slug === tier.slug && 'ring-2 ring-white'
                )}
              >
                {tier.name}
              </span>
            )
          })}
        </div>
        <p className="nd-mono text-neutral-400 text-[11px] mt-3">
          {t('Size: {{min}} - {{max}}', {
            min: formatBytes(minSize, 1),
            max: formatBytes(maxSize, 1),
          })}
        </p>
      </div>
    </div>
  )
}

export default CategoryCard
