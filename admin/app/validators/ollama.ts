import vine from '@vinejs/vine'

export const chatSchema = vine.compile(
  vine.object({
    model: vine.string().trim().minLength(1),
    messages: vine.array(
      vine.object({
        role: vine.enum(['system', 'user', 'assistant'] as const),
        content: vine.string(),
      })
    ),
    stream: vine.boolean().optional(),
    sessionId: vine.number().positive().optional(),
    // Effective per-request thinking preference (per-model override or global default),
    // resolved client-side. Omitted -> server falls back to the ai.autoThinking KV default.
    think: vine.boolean().optional(),
    // 'survival': the preparedness agent (scenario level, location, survival works first, cited
    // answers). Omitted or 'general': the regular chat.
    assistantMode: vine.enum(['general', 'survival'] as const).optional(),
    // Location for this conversation, overriding the regional settings (survival mode only)
    location: vine
      .object({
        state: vine.string().trim().maxLength(8).nullable().optional(),
        environment: vine
          .enum(['urbano', 'rural'] as const)
          .nullable()
          .optional(),
        place: vine.string().trim().maxLength(80).nullable().optional(),
      })
      .optional(),
  })
)

export const unloadChatModelsSchema = vine.compile(
  vine.object({
    targetModel: vine.string().trim().minLength(1).nullable().optional(),
  })
)

export const getAvailableModelsSchema = vine.compile(
  vine.object({
    sort: vine.enum(['pulls', 'name'] as const).optional(),
    recommendedOnly: vine.boolean().optional(),
    query: vine.string().trim().optional(),
    limit: vine.number().positive().optional(),
    force: vine.boolean().optional(),
  })
)
