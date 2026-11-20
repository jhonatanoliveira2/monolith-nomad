/**
 * Guard: the UI colours come from the Nothing theme tokens (inertia/css/app.css), so both themes stay
 * consistent and a merge from upstream that brings hard-coded Tailwind palette classes back fails here.
 *
 * - `dark:` must follow the app theme (`data-theme="dark"`), not the OS `prefers-color-scheme`.
 * - Semantic ramps (red = alert, orange = warning, olive = success) invert between themes:
 *   `-lighter` is the tinted surface (light in the light theme, dark in the dark theme) and `-dark`
 *   is the readable text colour on it.
 * - No chromatic Tailwind palette classes (`bg-red-50`, `text-blue-600`…). Pure greys (`neutral-*`),
 *   `white` and `black` stay allowed for surfaces that are dark in both themes.
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ADMIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CSS = readFileSync(path.join(ADMIN, 'inertia/css/app.css'), 'utf8')

function block(selector: RegExp): string {
  const m = selector.exec(CSS)
  assert.ok(m, `block ${selector} not found in app.css`)
  const start = CSS.indexOf('{', m.index) + 1
  return CSS.slice(start, CSS.indexOf('\n}', start))
}

function tokens(css: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of css.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi))
    out.set(m[1], m[2].toLowerCase())
  return out
}

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('dark: variant follows the app theme, not the OS colour scheme', () => {
  assert.match(CSS, /@custom-variant\s+dark\s*\(\s*&:where\(\[data-theme=["']?dark["']?\]/)
})

test('semantic ramps invert between themes and keep text readable on their tinted surface', () => {
  const light = tokens(block(/@theme\s*\{/))
  const dark = new Map([...light, ...tokens(block(/^\[data-theme="dark"\]\s*\{/m))])
  for (const family of ['desert-red', 'desert-orange', 'desert-olive']) {
    for (const [name, theme, surfaceIsDark] of [
      ['light', light, false],
      ['dark', dark, true],
    ] as const) {
      const surface = theme.get(`${family}-lighter`)!
      const text = theme.get(`${family}-dark`)!
      assert.ok(surface && text, `${family} ramp incomplete in the ${name} theme`)
      assert.equal(
        luminance(surface) < 0.18,
        surfaceIsDark,
        `${family}-lighter (${surface}) should be a ${surfaceIsDark ? 'dark' : 'light'} surface in the ${name} theme`
      )
      assert.ok(
        contrast(surface, text) >= 4.5,
        `${family}-dark on ${family}-lighter is ${contrast(surface, text).toFixed(2)}:1 in the ${name} theme (needs 4.5)`
      )
    }
  }
})

test('white text stays readable on semantic fills and their hover state in both themes', () => {
  const light = tokens(block(/@theme\s*\{/))
  const dark = new Map([...light, ...tokens(block(/^\[data-theme="dark"\]\s*\{/m))])
  for (const family of ['desert-red', 'desert-orange', 'desert-olive']) {
    for (const [name, theme] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      for (const step of ['', '-hover']) {
        const fill = theme.get(`${family}${step}`)
        assert.ok(fill, `${family}${step} missing in the ${name} theme`)
        assert.ok(
          contrast('#ffffff', fill) >= 4.5,
          `white on ${family}${step} (${fill}) is ${contrast('#ffffff', fill).toFixed(2)}:1 in the ${name} theme`
        )
      }
    }
  }
  // the dark base is tuned for white text on it, so orange *text* on dark surfaces uses the light step
  assert.match(
    CSS,
    /\[data-theme="dark"\] \.text-desert-orange,\s*\[data-theme="dark"\] \.hover\\:text-desert-orange:hover\s*\{\s*color:\s*var\(--color-desert-orange-dark\)/
  )
})

test('semantic -dark steps are text colours, never fills (they turn light in the dark theme)', () => {
  const fills = sourceFiles(path.join(ADMIN, 'inertia')).flatMap((file) =>
    [
      ...readFileSync(file, 'utf8').matchAll(
        /(?<![\w-])(?:[a-z-]+:)*bg-desert-(?:red|orange|olive)-dark\b/g
      ),
    ].map((m) => `${path.relative(ADMIN, file)} ${m[0]}`)
  )
  assert.deepEqual(fills, [], `use bg-desert-*-hover (or the base) instead:\n${fills.join('\n')}`)
})

const CHROMATIC =
  /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|fill|stroke|from|via|to|divide|outline|placeholder|accent|shadow|decoration|caret)-(?:gray|slate|zinc|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}\b/g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(tsx?|jsx?)$/.test(name) ? [full] : []
  })
}

test('the UI uses theme tokens instead of chromatic Tailwind palette classes', () => {
  const offenders = sourceFiles(path.join(ADMIN, 'inertia')).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, i) =>
        [...line.matchAll(CHROMATIC)].map((m) => `${path.relative(ADMIN, file)}:${i + 1} ${m[0]}`)
      )
  )
  assert.deepEqual(offenders, [], `hard-coded palette classes:\n${offenders.join('\n')}`)
})
