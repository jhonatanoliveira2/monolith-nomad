/**
 * Strip the trailing `_YYYY-MM(-DD).zim` date suffix from a Kiwix-style ZIM
 * filename so different release dates of the same variant share a stem
 * (e.g., `wikipedia_en_all_nopic`) while distinct corpora keep distinct stems
 * (`wikipedia_en_simple_all_nopic`, `wikipedia_en_medicine_nopic`, etc.).
 */
export function zimFilenameStem(name: string): string {
  return name.replace(/_\d{4}-\d{2}(?:-\d{2})?\.zim$/i, '')
}

/**
 * Of the existing files, return only those that are prior-version replacements
 * of `currentFilename` — same Wikipedia variant stem, different release. Used
 * by the post-download cleanup to avoid deleting unrelated Wikipedia corpora
 * the user has installed independently (issue #884).
 */
export function findReplacedWikipediaFiles(
  currentFilename: string,
  existingNames: string[]
): string[] {
  const currentStem = zimFilenameStem(currentFilename)
  return existingNames.filter(
    (n) => WIKIPEDIA_FILENAME.test(n) && n !== currentFilename && zimFilenameStem(n) === currentStem
  )
}

/**
 * `wikipedia_<lang>_…`, any language. The selector used to be English-only and the code matched the
 * literal `wikipedia_en_`; the Brazilian catalog offers `wikipedia_pt_*`, which that check silently
 * skipped (old releases never cleaned up, a cancelled download never marked the selection failed).
 */
const WIKIPEDIA_FILENAME = /^wikipedia_[a-z]{2,3}(?:-[a-z]+)?_/i

/** True for the URL (or bare filename) of a Wikipedia ZIM in any language. */
export function isWikipediaZimUrl(url: string): boolean {
  const name = url.split('/').pop() ?? ''
  return WIKIPEDIA_FILENAME.test(name) && name.endsWith('.zim')
}

/**
 * True when `filename` is a release of one of the Wikipedia selector's own options (same stem),
 * as opposed to another corpus that merely shares the `wikipedia_en_` prefix — e.g. the curated
 * Medicine tier's `wikipedia_en_medicine_maxi_*.zim`, which must never be treated as "the"
 * Wikipedia (it would take over the selection and be deleted when the selection changes).
 */
export function isWikipediaSelectorFile(
  filename: string,
  optionUrls: Array<string | null>
): boolean {
  const stem = zimFilenameStem(filename)
  return optionUrls.some((url) => !!url && zimFilenameStem(url.split('/').pop() ?? '') === stem)
}
