/**
 * A single provenance entry under an assistant answer: the document a chunk of
 * injected context came from. `source` is the originating file/ZIM path and is
 * what dedupes the list; `title` is what the user actually reads.
 */
/** Where in a document a cited passage is: "p. 12", "p. 12–13" or a chapter title. */
export interface ChatSourceLocation {
  label: string
  /** First page of the passage (PDF), for opening the reader there. */
  page?: number
  /** Spine href of the chapter (EPUB), for opening the reader there. */
  href?: string
}

export interface ChatSource {
  title: string
  date?: string
  source?: string
  /** Pages or chapters of this source the answer was based on, in retrieval order. */
  locations?: ChatSourceLocation[]
}

export interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: ChatImageAttachment[]
  timestamp: Date
  isStreaming?: boolean
  thinking?: string
  isThinking?: boolean
  thinkingDuration?: number
  sources?: ChatSource[]
  // Generation stopped at the length limit, so the answer ends mid-thought.
  truncated?: boolean
  /** Survival mode: what the agent understood (scenario level, hazard, phase, place). */
  survival?: import('./assistant.js').SurvivalMeta
}

export interface ChatImageAttachment {
  id: string
  name: string
  file: File
  previewUrl: string
}

export interface ChatSession {
  id: string
  title: string
  lastMessage?: string
  timestamp: Date
}
