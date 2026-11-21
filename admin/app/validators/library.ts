import vine from '@vinejs/vine'

/**
 * collections/library.json. Every field is declared: VineJS strips unknown keys, and a dropped
 * `sha256` would silently turn off the integrity check. The union-like file shape (document vs ZIM)
 * is enforced by LibraryService.isValidFile and by the catalog test, not here.
 */
const libraryFileValidator = vine.object({
  format: vine.enum(['pdf', 'epub', 'zim']),
  url: vine.string().url().optional(),
  size_bytes: vine.number().min(1).optional(),
  sha256: vine
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .optional(),
  zim_id: vine.string().optional(),
})

export const librarySpecSchema = vine.object({
  spec_version: vine.string(),
  areas: vine
    .array(
      vine.object({
        slug: vine.string(),
        name: vine.string(),
        description: vine.string(),
        icon: vine.string(),
      })
    )
    .minLength(1),
  items: vine.array(
    vine.object({
      id: vine.string().regex(/^[a-z0-9][a-z0-9-]*$/),
      version: vine.string().regex(/^[0-9A-Za-z.-]+$/),
      title: vine.string(),
      authors: vine.array(vine.string()).minLength(1),
      publisher: vine.string(),
      edition: vine.string(),
      year: vine.string(),
      language: vine.string().minLength(2).maxLength(5),
      description: vine.string(),
      areas: vine.array(vine.string()).minLength(1),
      subjects: vine.array(vine.string()).minLength(1),
      levels: vine.array(vine.enum(['iniciante', 'intermediario', 'avancado'])).minLength(1),
      source_url: vine.string().url(),
      license: vine.object({
        id: vine.string(),
        name: vine.string(),
        url: vine.string().url(),
        attribution: vine.string(),
      }),
      notes: vine.string().optional(),
      files: vine.array(libraryFileValidator).minLength(1),
    })
  ),
})

export const libraryFileParamsValidator = vine.compile(
  vine.object({
    params: vine.object({
      // Only names the library itself writes: <item-id>_<version>.<pdf|epub>
      filename: vine.string().regex(/^[a-z0-9][a-z0-9-]*_[0-9A-Za-z.-]+\.(pdf|epub)$/),
    }),
  })
)

export const libraryDownloadValidator = vine.compile(
  vine.object({
    itemId: vine.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    format: vine.enum(['pdf', 'epub', 'zim']),
  })
)
