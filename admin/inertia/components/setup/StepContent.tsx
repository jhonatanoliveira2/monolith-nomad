import { Link } from '@inertiajs/react'
import { IconBooks } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import CreatorPackCard from '~/components/CreatorPackCard'
import EmptyState from '~/components/nd/EmptyState'
import LoadingSpinner from '~/components/LoadingSpinner'
import StyledButton from '~/components/StyledButton'
import WikipediaSelector from '~/components/WikipediaSelector'
import { DEFAULT_SELECTION, PROFILES, type SetupDraft } from '~/lib/setup_plan'
import type { CategoryWithStatus } from '../../../types/collections'
import CategoryPlanner, { PROFILE_LABEL } from './CategoryPlanner'
import SurvivalLibraryPicker from './SurvivalLibraryPicker'

export default function StepContent({
  draft,
  update,
  categories,
  categoriesLoading,
  wikipediaState,
  creatorPacks,
  kiwixReady,
  enableKiwix,
  online,
  survival,
}: {
  draft: SetupDraft
  update: (patch: Partial<SetupDraft>) => void
  categories: CategoryWithStatus[]
  categoriesLoading: boolean
  wikipediaState: any
  creatorPacks: { configured: boolean; packs: any[] }
  kiwixReady: boolean
  enableKiwix: () => void
  online: boolean
  survival: {
    items: React.ComponentProps<typeof SurvivalLibraryPicker>['items']
    plan: React.ComponentProps<typeof SurvivalLibraryPicker>['plan']
  }
}) {
  const { t } = useTranslation()
  // Survival PDFs come first (the priority content) and need no Kiwix
  const survivalSection = (
    <SurvivalLibraryPicker
      draft={draft}
      update={update}
      items={survival.items}
      plan={survival.plan}
      online={online}
    />
  )

  if (!kiwixReady) {
    return (
      <div className="space-y-10">
        {survivalSection}
        <EmptyState
          icon={<IconBooks size={22} />}
          title={t('Content needs the Information Library')}
          description={t(
            'Wikipedia, courses and reference collections open in the Information Library (Kiwix).'
          )}
          action={
            <StyledButton onClick={enableKiwix} disabled={!online}>
              {t('Add the Information Library')}
            </StyledButton>
          }
        />
      </div>
    )
  }

  const applyAll = (profile: (typeof PROFILES)[number] | null) => {
    const next: SetupDraft['categories'] = {}
    if (profile) {
      for (const c of categories) {
        next[c.slug] = { ...DEFAULT_SELECTION, ...draft.categories[c.slug], profile }
      }
    }
    update({ categories: next })
  }

  return (
    <div className="space-y-10">
      {survivalSection}
      <section aria-labelledby="content-wikipedia">
        <h2 id="content-wikipedia" className="sr-only">
          Wikipedia
        </h2>
        {wikipediaState?.options?.length > 0 ? (
          <WikipediaSelector
            options={wikipediaState.options}
            currentSelection={wikipediaState.currentSelection}
            selectedOptionId={draft.wikipedia}
            onSelect={(id) => online && update({ wikipedia: id })}
            disabled={!online}
          />
        ) : null}
      </section>

      <section aria-labelledby="content-categories" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="content-categories" className="nd-eyebrow !text-xs !text-text-secondary">
              {t('Collections by area')}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {t(
                'Portuguese content comes first. English items stay off until you enable them, per area or per item.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-text-muted">{t('Apply to all')}:</span>
            {PROFILES.map((p) => (
              <StyledButton key={p} size="sm" variant="secondary" onClick={() => applyAll(p)}>
                {t(PROFILE_LABEL[p])}
              </StyledButton>
            ))}
            <StyledButton size="sm" variant="ghost" onClick={() => applyAll(null)}>
              {t('Clear')}
            </StyledButton>
          </div>
        </div>
        {categoriesLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-3">
            {categories.map((c) => (
              <CategoryPlanner
                key={c.slug}
                category={c}
                selection={draft.categories[c.slug]}
                disabled={!online}
                onChange={(sel) => {
                  const next = { ...draft.categories }
                  if (sel) next[c.slug] = sel
                  else delete next[c.slug]
                  update({ categories: next })
                }}
              />
            ))}
          </div>
        )}
        <p className="text-sm text-text-muted">
          {t('Books and manuals in PDF and EPUB are in the')}{' '}
          <Link href="/library" className="text-text-primary underline underline-offset-4">
            {t('Library')}
          </Link>
          .
        </p>
      </section>

      {creatorPacks.configured && creatorPacks.packs.length > 0 && (
        <section aria-labelledby="content-packs" className="space-y-4">
          <h2 id="content-packs" className="nd-eyebrow !text-xs !text-text-secondary">
            {t('Creator Packs')}
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {creatorPacks.packs.map((pack) => (
              <CreatorPackCard
                key={pack.id}
                pack={pack}
                selected={draft.creatorPacks.includes(pack.id)}
                onClick={
                  pack.status === 'installed' && !pack.available_update_version
                    ? undefined
                    : () =>
                        online &&
                        update({
                          creatorPacks: draft.creatorPacks.includes(pack.id)
                            ? draft.creatorPacks.filter((x) => x !== pack.id)
                            : [...draft.creatorPacks, pack.id],
                        })
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
