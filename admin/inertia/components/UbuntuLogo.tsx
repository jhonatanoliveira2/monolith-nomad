/**
 * The Ubuntu "Circle of Friends" as a dot matrix (Nothing's dot language), in `currentColor` so it follows
 * the theme. The dots come from the classic CoF geometry (lib/dot_logo.ts); `grid` picks the density:
 * 13 for small marks (navigation), 21 for large ones.
 *
 * Ubuntu and the Circle of Friends are trademarks of Canonical Ltd. monolith-nomad is not affiliated with
 * or endorsed by Canonical (see THIRD_PARTY_NOTICES.md).
 */
import { circleOfFriendsDots, type LogoDot } from '~/lib/dot_logo'

const cache = new Map<number, LogoDot[]>()
function dotsFor(grid: number): LogoDot[] {
  let dots = cache.get(grid)
  if (!dots) {
    dots = circleOfFriendsDots(grid)
    cache.set(grid, dots)
  }
  return dots
}

type UbuntuLogoProps = {
  className?: string
  title?: string
  grid?: number
}

export default function UbuntuLogo({ className, title = 'Ubuntu', grid = 13 }: UbuntuLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="currentColor"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      {dotsFor(grid).map((d) => (
        <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={d.r} />
      ))}
    </svg>
  )
}
