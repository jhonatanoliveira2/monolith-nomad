import vine from '@vinejs/vine'

export const getJobStatusSchema = vine.compile(
  vine.object({
    filePath: vine.string(),
  })
)

export const deleteFileSchema = vine.compile(
  vine.object({
    source: vine.string(),
  })
)

export const embedFileSchema = vine.compile(
  vine.object({
    source: vine.string().minLength(1),
    force: vine.boolean().optional(),
  })
)

export const fileSourceSchema = vine.compile(
  vine.object({
    source: vine.string().minLength(1),
  })
)

export const estimateBatchSchema = vine.compile(
  vine.object({
    files: vine
      .array(
        vine.object({
          filename: vine.string().minLength(1).maxLength(255),
          sizeBytes: vine.number().min(0),
        })
      )
      .minLength(1)
      .maxLength(500),
  })
)

/** Optional body of POST /api/rag/reset-and-rebuild: rebuild the index with another embedding model. */
export const resetAndRebuildSchema = vine.compile(
  vine.object({
    embeddingProfile: vine.enum(['embeddinggemma', 'nomic-v1.5'] as const).optional(),
  })
)
