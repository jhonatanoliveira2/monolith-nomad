import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Cache of on-demand translations (reader passages and selections), one row per segment and
 * direction. Keyed by sha256(source \0 target \0 text) so the same passage is translated once; the
 * original documents are never modified. Safe to truncate: it only re-translates.
 */
export default class extends BaseSchema {
  protected tableName = 'translation_cache'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('hash', 64).primary()
      table.string('source_lang', 8).notNullable()
      table.string('target_lang', 8).notNullable()
      // 'bergamot' (Translated Library app) or 'llm:<model>'
      table.string('engine', 120).notNullable()
      table.text('translated', 'mediumtext').notNullable()
      table.integer('chars').unsigned().notNullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
