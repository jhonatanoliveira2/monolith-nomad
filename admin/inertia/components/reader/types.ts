/** Which side panel of the reader is open (contents, search, details or the AI assistant). */
export type ReaderPanel = 'contents' | 'search' | 'info' | 'assistant' | null

/** Where the reader is: a PDF page or an EPUB chapter, labelled the way answers cite it. */
export type ReaderLocation = { label: string; page?: number; href?: string }

export type ReaderPassageText = ReaderLocation & { text: string }

/**
 * What the reader exposes to the assistant panel: the position, the last text the user selected in
 * the book, the text of what is open, and navigation to a cited page or chapter. Everything reads the
 * local file already open in the browser; nothing is fetched.
 */
export type ReaderApi = {
  location(): ReaderLocation
  selection(): string
  currentText(): Promise<ReaderPassageText>
  /** PDF only: the text of pages `from`..`to` (capped by the caller). */
  rangeText?(from: number, to: number): Promise<ReaderPassageText>
  pageCount?(): number
  goTo(target: { page?: number; href?: string }): void
}
