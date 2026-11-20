/**
 * Monochrome Ubuntu "Circle of Friends" (the user's choice for this distribution's mark: monolith-nomad
 * runs on Ubuntu). Geometry from the classic CoF (Wikimedia Commons, UbuntuCoF.svg) without the orange
 * disc: the ring gaps are cut with a mask, so the mark is a single `currentColor` shape that follows the
 * theme (ink on the Nothing dark theme, black on light).
 *
 * Ubuntu and the Circle of Friends are trademarks of Canonical Ltd. monolith-nomad is not affiliated with
 * or endorsed by Canonical (see THIRD_PARTY_NOTICES.md).
 */
import { useId } from 'react'

type UbuntuLogoProps = {
  className?: string
  title?: string
}

export default function UbuntuLogo({ className, title = 'Ubuntu' }: UbuntuLogoProps) {
  const id = useId().replace(/:/g, '')
  const mask = `cof-gaps-${id}`
  const cut = `cof-cut-${id}`
  const head = `cof-head-${id}`
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
      <defs>
        <mask id={mask}>
          <rect width="100" height="100" fill="#fff" />
          <g id={cut}>
            <circle cx="19.4" cy="50" r="8.4376" fill="#000" />
            <path d="M67,50H77" stroke="#000" strokeWidth="3.2378" />
          </g>
          <use href={`#${cut}`} transform="rotate(120,50,50)" />
          <use href={`#${cut}`} transform="rotate(240,50,50)" />
        </mask>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="21.825"
        fill="none"
        stroke="currentColor"
        strokeWidth="8.55"
        mask={`url(#${mask})`}
      />
      <circle id={head} cx="19.4" cy="50" r="6.00745" />
      <use href={`#${head}`} transform="rotate(120,50,50)" />
      <use href={`#${head}`} transform="rotate(240,50,50)" />
    </svg>
  )
}
