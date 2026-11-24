/** localStorage that never throws (blocked storage, private mode, quota). */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {}
}

/**
 * True when a key event belongs to a control (text field, slider, select, button, radio group):
 * page-turning shortcuts must not steal ←/→ from them.
 */
export function isControlKeyTarget(e: KeyboardEvent): boolean {
  if (e.defaultPrevented) return true
  const target = e.target as HTMLElement | null
  if (!target || typeof target.closest !== 'function') return false
  return !!target.closest(
    'input, textarea, select, button, [contenteditable="true"], [role="radiogroup"], [role="slider"], [role="listbox"]'
  )
}
