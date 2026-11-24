/**
 * The Ubuntu "Circle of Friends" redrawn as a dot matrix (Nothing's dot language). The shape is the
 * classic CoF geometry (UbuntuCoF.svg, Wikimedia Commons, see THIRD_PARTY_NOTICES.md) evaluated
 * analytically; each cell of an n×n grid becomes a dot when enough of it falls inside the shape, and
 * partly covered cells become smaller dots so the curves stay smooth at large sizes.
 *
 * Pure (no DOM): used by the UbuntuLogo component and by scripts/generate_logo.mjs for the favicons.
 */

export type LogoDot = { x: number; y: number; r: number }

const C = 50
const RING_R = 21.825
const RING_HALF = 8.55 / 2
const HEAD_X = 19.4
const HEAD_R = 6.00745
const GAP_R = 8.4376
const LINE_X0 = 67
const LINE_X1 = 77
const LINE_HALF = 3.2378 / 2

function rotate(x: number, y: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  const dx = x - C
  const dy = y - C
  return [C + dx * Math.cos(a) - dy * Math.sin(a), C + dx * Math.sin(a) + dy * Math.cos(a)]
}

/** True when (x, y), in the 0–100 logo box, is inside the Circle of Friends. */
export function insideCircleOfFriends(x: number, y: number): boolean {
  for (const k of [0, 120, 240]) {
    const [u, v] = rotate(x, y, -k)
    if (Math.hypot(u - HEAD_X, v - C) <= HEAD_R) return true
  }
  const d = Math.hypot(x - C, y - C)
  if (Math.abs(d - RING_R) > RING_HALF) return false
  for (const k of [0, 120, 240]) {
    const [u, v] = rotate(x, y, -k)
    if (Math.hypot(u - HEAD_X, v - C) <= GAP_R) return false
    if (u >= LINE_X0 && u <= LINE_X1 && Math.abs(v - C) <= LINE_HALF) return false
  }
  return true
}

/**
 * Dots of an n×n grid over the 0–100 box. `minCoverage` drops cells mostly outside the shape;
 * covered cells get a full dot (`fill` of the cell), partial ones a proportionally smaller dot.
 */
export function circleOfFriendsDots(
  n: number,
  {
    minCoverage = 0.3,
    fill = 0.78,
    samples = 6,
  }: { minCoverage?: number; fill?: number; samples?: number } = {}
): LogoDot[] {
  const cell = 100 / n
  const dots: LogoDot[] = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      let hits = 0
      for (let i = 0; i < samples; i++) {
        for (let j = 0; j < samples; j++) {
          const x = (col + (i + 0.5) / samples) * cell
          const y = (row + (j + 0.5) / samples) * cell
          if (insideCircleOfFriends(x, y)) hits++
        }
      }
      const coverage = hits / (samples * samples)
      if (coverage < minCoverage) continue
      const scale = coverage >= 0.75 ? 1 : 0.55 + 0.45 * (coverage / 0.75)
      dots.push({
        x: Math.round((col + 0.5) * cell * 100) / 100,
        y: Math.round((row + 0.5) * cell * 100) / 100,
        r: Math.round(((cell * fill) / 2) * scale * 100) / 100,
      })
    }
  }
  return dots
}
