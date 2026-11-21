import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Widen `installed_resources.resource_type` to accept 'document': the library's PDFs and EPUBs
 * (collections/library.json). Without it the install-state row a finished download writes would be
 * truncated, exactly the failure the 'dataset' widening (1778800000001) fixed for the drug reference.
 */
export default class extends BaseSchema {
  protected tableName = 'installed_resources'

  async up() {
    await this.db.rawQuery(
      'ALTER TABLE installed_resources MODIFY COLUMN resource_type ' +
        "enum('zim','map','dataset','document') NOT NULL"
    )
  }

  async down() {
    await this.db.rawQuery("DELETE FROM installed_resources WHERE resource_type = 'document'")
    await this.db.rawQuery(
      'ALTER TABLE installed_resources MODIFY COLUMN resource_type ' +
        "enum('zim','map','dataset') NOT NULL"
    )
  }
}
