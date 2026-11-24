import { useEffect, useState } from 'react'
import { formatDate, formatTime } from '~/lib/format'

/**
 * Local time of the server's browser in dot-matrix type. On an offline server it is also the quickest
 * way to see that the clock is sane (TLS, logs and schedules depend on it).
 */
export default function DashboardClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    // tick on the minute boundary, then every minute
    let interval = 0
    const timeout = window.setTimeout(
      () => {
        setNow(new Date())
        interval = window.setInterval(() => setNow(new Date()), 60_000)
      },
      60_000 - (Date.now() % 60_000) + 50
    )
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [])
  return (
    <div className="text-right" aria-live="off">
      <p className="nd-display text-5xl sm:text-6xl text-text-primary">
        <time dateTime={now.toISOString()}>{formatTime(now)}</time>
      </p>
      <p className="nd-eyebrow mt-2">
        {formatDate(now, { weekday: 'short', day: '2-digit', month: 'short' })}
      </p>
    </div>
  )
}
