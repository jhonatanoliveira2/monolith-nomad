/**
 * Translation of messages produced by the SERVER (API `message`/`error` fields, thrown errors, install-activity
 * broadcasts). The server always answers in English, which is the i18n source language, so its text is the key:
 *
 *  - static messages are looked up as-is in the catalogs (inertia/locales/<locale>/server.json);
 *  - messages with values baked in (`Service nomad_kiwix_server not found`) cannot be static keys, so the
 *    PATTERNS below turn them back into a template key (`Service {{name}} not found`) plus its values.
 *
 * Unknown messages are returned unchanged (English). Call it at display time, never cache the result, so a
 * language switch takes effect immediately. NotificationProvider already applies it to every notification.
 *
 * Pure module (no i18next import) so it can be unit-tested with a real i18next instance; the app binds it to
 * its i18n in server_messages.ts.
 */

export type ServerMessageI18n = {
  exists(key: string): boolean
  t(key: string, values?: Record<string, string>): string
}

type Pattern = { re: RegExp; key: string }

// Named groups become interpolation values. A group named `error` holds a nested server message and is
// translated recursively. Avoid i18next option names (count, context, lng, ns, defaultValue) as group names.
// Order matters: the more specific pattern must come first.
export const PATTERNS: Pattern[] = [
  // library (run_download_job, library_service)
  {
    re: /^Integrity check failed: the publisher's file changed or is unavailable \((?<detail>.*)\)$/,
    key: "Integrity check failed: the publisher's file changed or is unavailable ({{detail}})",
  },
  { re: /^Library item not found: (?<id>\S+)$/, key: 'Library item not found: {{id}}' },
  // apps (docker_service, system_controller)
  {
    re: /^Service (?<name>\S+) not found or not installed$/,
    key: 'Service {{name}} not found or not installed',
  },
  { re: /^Service (?<name>\S+) not found$/, key: 'Service {{name}} not found' },
  { re: /^Service (?<name>\S+) is not installed$/, key: 'Service {{name}} is not installed' },
  {
    re: /^Service (?<name>\S+) is already installed$/,
    key: 'Service {{name}} is already installed',
  },
  { re: /^Service (?<name>\S+) is already running$/, key: 'Service {{name}} is already running' },
  {
    re: /^Service (?<name>\S+) installation is already in progress$/,
    key: 'Service {{name}} installation is already in progress',
  },
  {
    re: /^Service (?<name>\S+) installation initiated successfully\. You can receive updates via server-sent events\.$/,
    key: 'Service {{name}} installation initiated successfully. You can receive updates via server-sent events.',
  },
  {
    re: /^Service (?<name>\S+) force reinstall initiated successfully\. You can receive updates via server-sent events\.$/,
    key: 'Service {{name}} force reinstall initiated successfully. You can receive updates via server-sent events.',
  },
  {
    re: /^Failed to force reinstall service (?<name>\S+)\. Check server logs for details\.$/,
    key: 'Failed to force reinstall service {{name}}. Check server logs for details.',
  },
  {
    re: /^Service (?<name>\S+) stopped successfully$/,
    key: 'Service {{name}} stopped successfully',
  },
  {
    re: /^Service (?<name>\S+) started successfully$/,
    key: 'Service {{name}} started successfully',
  },
  {
    re: /^Service (?<name>\S+) restarted successfully$/,
    key: 'Service {{name}} restarted successfully',
  },
  {
    re: /^Failed to start service (?<name>\S+)\. Check server logs for details\.$/,
    key: 'Failed to start service {{name}}. Check server logs for details.',
  },
  {
    re: /^Failed to stop service (?<name>\S+)\. Check server logs for details\.$/,
    key: 'Failed to stop service {{name}}. Check server logs for details.',
  },
  {
    re: /^Failed to restart service (?<name>\S+)\. Check server logs for details\.$/,
    key: 'Failed to restart service {{name}}. Check server logs for details.',
  },
  {
    re: /^Container for service (?<name>\S+) not found$/,
    key: 'Container for service {{name}} not found',
  },
  { re: /^Container for (?<name>\S+) not found$/, key: 'Container for {{name}} not found' },
  {
    re: /^Service (?<name>\S+) container removed successfully$/,
    key: 'Service {{name}} container removed successfully',
  },
  {
    re: /^Failed to remove service (?<name>\S+) container\. Check server logs for details\.$/,
    key: 'Failed to remove service {{name}} container. Check server logs for details.',
  },
  {
    re: /^Service (?<name>\S+) already has an operation in progress$/,
    key: 'Service {{name}} already has an operation in progress',
  },
  {
    re: /^Service (?<name>\S+) already has an update in progress$/,
    key: 'Service {{name}} already has an update in progress',
  },
  {
    re: /^Service (?<name>\S+) updated to (?<version>\S+)$/,
    key: 'Service {{name}} updated to {{version}}',
  },
  { re: /^Service (?<name>\S+) uninstalled$/, key: 'Service {{name}} uninstalled' },
  {
    re: /^Service (?<name>\S+) reconfigured successfully$/,
    key: 'Service {{name}} reconfigured successfully',
  },
  { re: /^Container (?<name>\S+) removed$/, key: 'Container {{name}} removed' },
  { re: /^No container found for (?<name>\S+)$/, key: 'No container found for {{name}}' },
  {
    re: /^Reconfigure failed and was rolled back: (?<error>.+)$/s,
    key: 'Reconfigure failed and was rolled back: {{error}}',
  },
  {
    re: /^Update failed: new container did not start \((?<error>.+)\)\. Rolled back to previous version\.$/s,
    key: 'Update failed: new container did not start ({{error}}). Rolled back to previous version.',
  },
  {
    re: /^Failed to create updated container: (?<error>.+)$/s,
    key: 'Failed to create updated container: {{error}}',
  },
  {
    re: /^Failed to install service (?<name>\S+): (?<error>.+)$/s,
    key: 'Failed to install service {{name}}: {{error}}',
  },
  { re: /^Custom app (?<name>\S+) deleted$/, key: 'Custom app {{name}} deleted' },
  {
    re: /^A custom app named "(?<name>.+)" already exists\. Choose a different name\.$/,
    key: 'A custom app named "{{name}}" already exists. Choose a different name.',
  },
  {
    re: /^A link named "(?<name>.+)" already exists\. Choose a different name\.$/,
    key: 'A link named "{{name}}" already exists. Choose a different name.',
  },
  {
    re: /^Duplicate host port\(s\): (?<ports>.+)\. Each host port can map to only one container\.$/,
    key: 'Duplicate host port(s): {{ports}}. Each host port can map to only one container.',
  },
  { re: /^Port conflict: (?<ports>.+)\.$/, key: 'Port conflict: {{ports}}.' },
  {
    re: /^Update already in progress \(stage: (?<stage>.+)\)$/,
    key: 'Update already in progress (stage: {{stage}})',
  },

  // install activity feed (docker_service broadcasts)
  {
    re: /^Starting force reinstall for (?<name>\S+)\.\.\.$/,
    key: 'Starting force reinstall for {{name}}...',
  },
  { re: /^Removed volume: (?<name>.+)$/, key: 'Removed volume: {{name}}' },
  {
    re: /^Checking dependencies for service (?<name>\S+)\.\.\.$/,
    key: 'Checking dependencies for service {{name}}...',
  },
  {
    re: /^Dependency service (?<name>\S+) is not installed\. Installing it first\.\.\.$/,
    key: 'Dependency service {{name}} is not installed. Installing it first...',
  },
  {
    re: /^Dependency service (?<name>\S+) is already installed\.$/,
    key: 'Dependency service {{name}} is already installed.',
  },
  {
    re: /^Docker image (?<image>\S+) already exists locally\. Skipping pull\.\.\.$/,
    key: 'Docker image {{image}} already exists locally. Skipping pull...',
  },
  { re: /^Pulling Docker image (?<image>\S+)\.\.\.$/, key: 'Pulling Docker image {{image}}...' },
  { re: /^Pulling image (?<image>\S+)\.\.\.$/, key: 'Pulling image {{image}}...' },
  {
    re: /^Creating Docker container for service (?<name>\S+)\.\.\.$/,
    key: 'Creating Docker container for service {{name}}...',
  },
  {
    re: /^Starting Docker container for service (?<name>\S+)\.\.\.$/,
    key: 'Starting Docker container for service {{name}}...',
  },
  {
    re: /^Finalizing installation of service (?<name>\S+)\.\.\.$/,
    key: 'Finalizing installation of service {{name}}...',
  },
  {
    re: /^Service (?<name>\S+) installation completed successfully\.$/,
    key: 'Service {{name}} installation completed successfully.',
  },
  {
    re: /^Error installing service (?<name>\S+): (?<error>.+)$/s,
    key: 'Error installing service {{name}}: {{error}}',
  },
  {
    re: /^Successfully updated (?<name>\S+) to (?<version>\S+)$/,
    key: 'Successfully updated {{name}} to {{version}}',
  },
  {
    re: /^Updated container failed to start: (?<error>.+)\. Rolling back to previous version\.\.\.$/s,
    key: 'Updated container failed to start: {{error}}. Rolling back to previous version...',
  },
  {
    re: /^Failed to create new container: (?<error>.+)\. Rolling back\.\.\.$/s,
    key: 'Failed to create new container: {{error}}. Rolling back...',
  },
  { re: /^Pre-install action failed: (?<error>.+)$/s, key: 'Pre-install action failed: {{error}}' },

  // AI models (ollama_controller, ollama_service)
  { re: /^Model deleted: (?<model>.+)$/, key: 'Model deleted: {{model}}' },
  { re: /^Model "(?<model>.+)" deleted\.$/, key: 'Model "{{model}}" deleted.' },
  {
    re: /^Download job dispatched for model: (?<model>.+)$/,
    key: 'Download job dispatched for model: {{model}}',
  },
  {
    re: /^Model "(?<model>.+)" is not available in your AI host\. Please load it manually \(model pulling is only supported for Ollama backends\)\.$/,
    key: 'Model "{{model}}" is not available in your AI host. Please load it manually (model pulling is only supported for Ollama backends).',
  },
  {
    re: /^The selected model "(?<model>.+)" does not support image input\.$/,
    key: 'The selected model "{{model}}" does not support image input.',
  },
  {
    re: /^Could not connect to (?<url>\S+) \(HTTP (?<status>\d+)\)\. Make sure the server is running and accessible\. For Ollama, start it with OLLAMA_HOST=0\.0\.0\.0\.$/,
    key: 'Could not connect to {{url}} (HTTP {{status}}). Make sure the server is running and accessible. For Ollama, start it with OLLAMA_HOST=0.0.0.0.',
  },
  {
    re: /^Could not connect to (?<url>\S+)\. Make sure the server is running and reachable\. For Ollama, start it with OLLAMA_HOST=0\.0\.0\.0\.$/,
    key: 'Could not connect to {{url}}. Make sure the server is running and reachable. For Ollama, start it with OLLAMA_HOST=0.0.0.0.',
  },
  {
    re: /^Retrying download for model (?<model>.+)$/,
    key: 'Retrying download for model {{model}}',
  },

  // content, downloads and maps
  { re: /^Retrying download for (?<url>\S+)$/, key: 'Retrying download for {{url}}' },
  { re: /^ZIM file with key (?<name>.+) not found$/, key: 'ZIM file with key {{name}} not found' },
  { re: /^Map file with key (?<name>.+) not found$/, key: 'Map file with key {{name}} not found' },
  {
    re: /^Invalid ZIM file URL: (?<url>.+)\. URL must end with \.zim$/,
    key: 'Invalid ZIM file URL: {{url}}. URL must end with .zim',
  },
  {
    re: /^Invalid PMTiles file URL: (?<url>.+)\. URL must end with \.pmtiles$/,
    key: 'Invalid PMTiles file URL: {{url}}. URL must end with .pmtiles',
  },
  {
    re: /^Download already in progress for URL (?<url>\S+)$/,
    key: 'Download already in progress for URL {{url}}',
  },
  { re: /^Failed to download: HTTP (?<status>\d+)$/, key: 'Failed to download: HTTP {{status}}' },
  { re: /^Creator pack not found: (?<name>.+)$/, key: 'Creator pack not found: {{name}}' },
  {
    re: /^Creator pack is not installed: (?<name>.+)$/,
    key: 'Creator pack is not installed: {{name}}',
  },
  {
    re: /^Uninstalled FDA drug reference \((?<rows>\d+) labels removed\)\.$/,
    key: 'Uninstalled FDA drug reference ({{rows}} labels removed).',
  },

  // knowledge base (rag_service, rag_controller, embed_file_job)
  { re: /^File queued for embedding: (?<name>.+)$/, key: 'File queued for embedding: {{name}}' },
  {
    re: /^Embedding job already exists for: (?<name>.+)$/,
    key: 'Embedding job already exists for: {{name}}',
  },
  { re: /^Moved to "(?<name>.+)"\.$/, key: 'Moved to "{{name}}".' },
  { re: /^Renamed "(?<from>.+)" to "(?<to>.+)"\.$/, key: 'Renamed "{{from}}" to "{{to}}".' },
  {
    re: /^"(?<name>.+)" removed\. Files moved to Uncategorized\.$/,
    key: '"{{name}}" removed. Files moved to Uncategorized.',
  },
  { re: /^Cleaned up (?<n>\d+) failed jobs?\.$/, key: 'Cleaned up {{n}} failed job(s).' },
  {
    re: /^Cleaned up (?<n>\d+) failed jobs?, deleted (?<files>\d+) files?\.$/,
    key: 'Cleaned up {{n}} failed job(s), deleted {{files}} file(s).',
  },
  { re: /^Cancelled (?<n>\d+) jobs?\.$/, key: 'Cancelled {{n}} job(s).' },
  {
    re: /^Cancelled (?<n>\d+) jobs?, deleted (?<files>\d+) files?\.$/,
    key: 'Cancelled {{n}} job(s), deleted {{files}} file(s).',
  },

  // chat images (utils/chat_images)
  { re: /^Attach no more than (?<n>\d+) images\.$/, key: 'Attach no more than {{n}} images.' },
  {
    re: /^"(?<name>.+)" exceeds the 8 MB per-image limit\.$/,
    key: '"{{name}}" exceeds the 8 MB per-image limit.',
  },
  {
    re: /^"(?<name>.+)" is not supported\. Use JPEG, PNG, or WebP\.$/,
    key: '"{{name}}" is not supported. Use JPEG, PNG, or WebP.',
  },
  {
    re: /^"(?<name>.+)" is not a valid image upload\.$/,
    key: '"{{name}}" is not a valid image upload.',
  },
  {
    re: /^"(?<name>.+)" could not be decoded as an image\.$/,
    key: '"{{name}}" could not be decoded as an image.',
  },

  // system update, release notes, benchmark
  { re: /^Failed to subscribe: (?<error>.+)$/s, key: 'Failed to subscribe: {{error}}' },
  {
    re: /^Failed to check latest version: (?<error>.+)$/s,
    key: 'Failed to check latest version: {{error}}',
  },
  { re: /^(?<type>\w+) benchmark started$/, key: '{{type}} benchmark started' },
  {
    re: /^Failed to submit benchmark: (?<error>.+)$/s,
    key: 'Failed to submit benchmark: {{error}}',
  },
  {
    re: /^AI benchmark failed: (?<error>.+)\. Make sure AI Assistant is installed and running\.$/s,
    key: 'AI benchmark failed: {{error}}. Make sure AI Assistant is installed and running.',
  },
  { re: /^AI benchmark failed: (?<error>.+)$/s, key: 'AI benchmark failed: {{error}}' },
  {
    re: /^Ollama is not running or not accessible \((?<code>.+)\)\. Ensure AI Assistant is installed and running\.$/,
    key: 'Ollama is not running or not accessible ({{code}}). Ensure AI Assistant is installed and running.',
  },

  // settings validators (app/validators/settings.ts)
  {
    re: /^Context window must be "auto" or one of: (?<values>.+)\.$/,
    key: 'Context window must be "auto" or one of: {{values}}.',
  },
  {
    re: /^Response style must be one of: (?<values>.+)\.$/,
    key: 'Response style must be one of: {{values}}.',
  },

  // HTTP client (axios) errors, e.g. the tail of catchInternal's notification
  {
    re: /^Request failed with status code (?<status>\d+)$/,
    key: 'Request failed with status code {{status}}',
  },

  // VineJS default messages (app/validators). `field` is the raw payload field name, not translated.
  { re: /^The (?<field>\S+) field must be defined$/, key: 'The {{field}} field must be defined' },
  { re: /^The (?<field>\S+) field must be a string$/, key: 'The {{field}} field must be a string' },
  { re: /^The (?<field>\S+) field must be a number$/, key: 'The {{field}} field must be a number' },
  {
    re: /^The (?<field>\S+) field must be a valid email address$/,
    key: 'The {{field}} field must be a valid email address',
  },
  {
    re: /^The (?<field>\S+) field must be a valid URL$/,
    key: 'The {{field}} field must be a valid URL',
  },
  {
    re: /^The (?<field>\S+) field format is invalid$/,
    key: 'The {{field}} field format is invalid',
  },
  {
    re: /^The (?<field>\S+) field must have at least (?<min>\d+) characters$/,
    key: 'The {{field}} field must have at least {{min}} characters',
  },
  {
    re: /^The (?<field>\S+) field must not be greater than (?<max>\d+) characters$/,
    key: 'The {{field}} field must not be greater than {{max}} characters',
  },
  {
    re: /^The (?<field>\S+) field must be at least (?<min>-?[\d.]+)$/,
    key: 'The {{field}} field must be at least {{min}}',
  },
  {
    re: /^The (?<field>\S+) field must not be greater than (?<max>-?[\d.]+)$/,
    key: 'The {{field}} field must not be greater than {{max}}',
  },
  {
    re: /^The (?<field>\S+) field must be between (?<min>-?[\d.]+) and (?<max>-?[\d.]+)$/,
    key: 'The {{field}} field must be between {{min}} and {{max}}',
  },
  { re: /^The (?<field>\S+) field must be positive$/, key: 'The {{field}} field must be positive' },
  {
    re: /^The (?<field>\S+) field must be an integer$/,
    key: 'The {{field}} field must be an integer',
  },
  { re: /^The (?<field>\S+) field must be an array$/, key: 'The {{field}} field must be an array' },
  {
    re: /^The (?<field>\S+) field must be an object$/,
    key: 'The {{field}} field must be an object',
  },
  { re: /^The selected (?<field>\S+) is invalid$/, key: 'The selected {{field}} is invalid' },
]

// Messages that end with an HTTP client error appended to a (possibly already translated) prefix.
const TAIL =
  /^(?<prefix>.*\s)(?<tail>Request failed with status code \d+|Network Error|timeout of \d+ms exceeded)$/s

export function createServerMessageTranslator(i18n: ServerMessageI18n) {
  return function translateServerMessage(message: unknown): string {
    if (message === null || message === undefined) return ''
    const text = typeof message === 'string' ? message : String(message)
    if (!text) return text
    if (i18n.exists(text)) return i18n.t(text)

    for (const { re, key } of PATTERNS) {
      const match = re.exec(text)
      if (!match) continue
      const values: Record<string, string> = { ...match.groups }
      if (values.error) values.error = translateServerMessage(values.error)
      return i18n.t(key, values)
    }

    const tail = TAIL.exec(text)
    if (tail?.groups) return tail.groups.prefix + translateServerMessage(tail.groups.tail)

    return text
  }
}
