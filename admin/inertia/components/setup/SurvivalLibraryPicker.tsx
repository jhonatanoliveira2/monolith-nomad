import { IconShieldCheck } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import SegmentedControl from '~/components/nd/SegmentedControl'
import { formatBytes } from '~/lib/util'
import { survivalLibraryIds, type SetupDraft, type SurvivalLibraryProfile } from '~/lib/setup_plan'

const LABEL: Record<SurvivalLibraryProfile, string> = {
  none: 'None',
  essential: 'Essential',
  standard: 'Standard',
  complete: 'Comprehensive',
}

/**
 * Official Brazilian survival and emergency publications (Ministry of Health, Civil Defence, Ministry
 * of the Environment) as PDFs in the Library: chosen by level, listed with what is already installed,
 * and indexed for the survival agent once downloaded.
 */
export default function SurvivalLibraryPicker({
  draft,
  update,
  items,
  plan,
  online,
}: {
  draft: SetupDraft
  update: (patch: Partial<SetupDraft>) => void
  items: { id: string; title: string; year?: string; files: { format: string; status: string }[] }[]
  plan: { queue: { id: string; bytes: number }[]; skipped: number; bytes: number }
  online: boolean
}) {
  const { t } = useTranslation()
  const ids = new Set(survivalLibraryIds(draft.survivalLibrary))
  const chosen = items.filter((i) => ids.has(i.id))
  return (
    <section aria-labelledby="content-survival" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2
            id="content-survival"
            className="nd-eyebrow flex items-center gap-1.5 !text-xs !text-text-secondary"
          >
            <IconShieldCheck size={14} aria-hidden="true" />
            {t('Survival library')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t(
              'Official Brazilian publications on floods, droughts, landslides, fires, heat, dams, safe water, venomous animals and epidemics (Ministry of Health, Civil Defence, Ministry of the Environment). PDFs, in Portuguese, searchable by the local assistant.'
            )}
          </p>
        </div>
        <SegmentedControl
          size="sm"
          label={t('Survival library')}
          value={draft.survivalLibrary}
          onChange={(v) => online && update({ survivalLibrary: v })}
          options={(['none', 'essential', 'standard', 'complete'] as const).map((p) => ({
            value: p,
            label: t(LABEL[p]),
          }))}
        />
      </div>
      {chosen.length > 0 && (
        <div className="rounded-xl border border-border-subtle p-4">
          <p className="text-sm text-text-primary">
            {plan.queue.length === 0
              ? t('Everything at this level is already installed.')
              : plan.queue.length === 1
                ? t('1 publication to download ({{size}}).', { size: formatBytes(plan.bytes) })
                : t('{{count}} publications to download ({{size}}).', {
                    count: plan.queue.length,
                    size: formatBytes(plan.bytes),
                  })}
          </p>
          <ul className="mt-2 grid gap-x-6 gap-y-1 text-xs text-text-secondary md:grid-cols-2">
            {chosen.map((item) => {
              const done = item.files.some((f) => f.format === 'pdf' && f.status === 'installed')
              return (
                <li key={item.id} className="truncate" title={item.title}>
                  {done ? '✓ ' : ''}
                  {item.title}
                  {item.year ? <span className="text-text-muted"> ({item.year})</span> : null}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
