import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { getDefaultDataDir } from '@pinpinwish/pinterest-connector'
import { SCHEMA_SQL } from './schema'

let instance: DatabaseSync | null = null

export function getDatabasePath(): string {
  const customPath = process.env.SQLITE_DATABASE_PATH
  if (customPath) return customPath

  const dir = getDefaultDataDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return path.join(dir, 'pinpinwish.db')
}

export function getDb(customPath?: string): DatabaseSync {
  if (customPath === ':memory:') {
    const memoryDb = new DatabaseSync(':memory:')
    initDatabase(memoryDb)
    return memoryDb
  }

  if (!instance) {
    const dbPath = customPath || getDatabasePath()
    instance = new DatabaseSync(dbPath)
    initDatabase(instance)
  }

  return instance
}

export function initDatabase(db: DatabaseSync): void {
  db.exec(SCHEMA_SQL)

  // Seed default user and wishlist if not present
  const existingUser = db.prepare('SELECT id FROM profiles WHERE id = ?').get('local-user')
  if (!existingUser) {
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO profiles (id, username, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('local-user', 'local', 'My Wishlist', now, now)

    db.prepare(`
      INSERT INTO wishlists (id, user_id, name, currency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('wishlist-local', 'local-user', 'My Wishlist', 'EUR', now, now)

    db.prepare(`
      INSERT INTO wishlist_sources (id, user_id, source_type, label, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run('source-pinterest-default', 'local-user', 'pinterest', 'Pinterest', now, now)
  }
}
