import vine from '@vinejs/vine'
import { TRANSLATION_LANGUAGES, TRANSLATION_MAX_CHARS } from '../utils/translation.js'
import { READER_MAX_PASSAGE_CHARS, READER_MAX_SELECTION_CHARS } from '../utils/reader_assistant.js'

/** POST /api/assistant/translate: a selection or a page, never a whole document. */
export const translateSchema = vine.compile(
  vine.object({
    text: vine.string().minLength(1).maxLength(TRANSLATION_MAX_CHARS),
    target: vine.enum(TRANSLATION_LANGUAGES),
    source: vine.enum(TRANSLATION_LANGUAGES).optional(),
    model: vine.string().trim().maxLength(200).optional(),
  })
)

/** POST /api/assistant/reader: chat, explanation or summary about the book open in the reader. */
export const readerAssistantSchema = vine.compile(
  vine.object({
    filename: vine.string().trim().minLength(1).maxLength(255),
    action: vine.enum(['chat', 'explain', 'summarize'] as const),
    model: vine.string().trim().minLength(1).maxLength(200),
    passage: vine.object({
      text: vine.string().maxLength(READER_MAX_PASSAGE_CHARS),
      label: vine.string().trim().minLength(1).maxLength(200),
      page: vine.number().positive().optional(),
      href: vine.string().maxLength(500).optional(),
    }),
    selection: vine.string().maxLength(READER_MAX_SELECTION_CHARS).optional(),
    question: vine.string().maxLength(4000).optional(),
    // Earlier turns of this reader conversation (chat action)
    history: vine
      .array(
        vine.object({
          role: vine.enum(['user', 'assistant'] as const),
          content: vine.string().maxLength(20000),
        })
      )
      .maxLength(20)
      .optional(),
  })
)
