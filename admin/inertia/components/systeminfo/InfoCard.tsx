import classNames from '~/lib/class_names'
import { useTranslation } from 'react-i18next'

interface InfoCardProps {
  title: string
  icon?: React.ReactNode
  data: Array<{
    label: string
    value: string | number | undefined
  }>
  variant?: 'default' | 'bordered' | 'elevated'
}

/** A labelled list of facts (hardware, OS…): mono header, hairline rows, values right-aligned. */
export default function InfoCard({ title, icon, data, variant = 'default' }: InfoCardProps) {
  const { t } = useTranslation()
  return (
    <div
      className={classNames(
        'nd-card overflow-hidden',
        variant === 'bordered' ? '!border-text-muted' : '',
        variant === 'elevated' ? 'bg-surface-elevated' : ''
      )}
    >
      <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
        {icon && <div className="text-text-secondary [&_svg]:size-5">{icon}</div>}
        <h3 className="nd-eyebrow !text-text-secondary">{title}</h3>
      </div>
      <dl className="px-5 py-2">
        {data.map((item, index) => (
          <div
            key={index}
            className="flex justify-between items-baseline gap-4 py-2.5 border-b border-border-subtle last:border-b-0"
          >
            <dt className="text-sm text-text-muted">{item.label}</dt>
            <dd className="text-sm text-right text-text-primary break-words min-w-0">
              {item.value || t('N/A')}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
