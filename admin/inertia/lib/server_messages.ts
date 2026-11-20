/**
 * Translation of messages produced by the SERVER, bound to the app's i18n. The patterns and the logic live in
 * server_messages_core.ts (pure, unit-tested in tests/unit/server_messages.spec.ts).
 */
import i18n from '~/lib/i18n'
import { createServerMessageTranslator } from '~/lib/server_messages_core'

// adapter: i18next's overloaded `t` is wider than the core needs
export const translateServerMessage = createServerMessageTranslator({
  exists: (key) => i18n.exists(key),
  t: (key, values) => i18n.t(key, values ?? {}) as string,
})
