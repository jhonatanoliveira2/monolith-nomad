import StatusDot from '~/components/nd/StatusDot'

export type StatusCardProps = {
  title: string
  value: string | number
}

/** One live reading (uptime, load…): label, steady LED, dot-matrix value. */
export default function StatusCard({ title, value }: StatusCardProps) {
  return (
    <div className="nd-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="nd-eyebrow">{title}</span>
        <StatusDot tone="ok" />
      </div>
      <div className="nd-display text-3xl text-text-primary">{value}</div>
    </div>
  )
}
