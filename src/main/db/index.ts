import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { schema } from './schema'
import { runMigrations } from './migrate'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _sqlite: Database.Database | null = null

export function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.')
  return _db
}

export function getSqlite() {
  if (!_sqlite) throw new Error('SQLite not initialized.')
  return _sqlite
}

export function initDb(): void {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')
  mkdirSync(dbDir, { recursive: true })

  const dbPath = join(dbDir, 'schoolbus.db')
  console.log('[DB] Opening database at:', dbPath)

  _sqlite = new Database(dbPath)

  // Performance pragmas
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('foreign_keys = ON')
  _sqlite.pragma('synchronous = NORMAL')
  _sqlite.pragma('cache_size = 10000')

  _db = drizzle(_sqlite, { schema })

  runMigrations(_sqlite)
  console.log('[DB] Initialized successfully')
}

export function closeDb(): void {
  _sqlite?.close()
  _sqlite = null
  _db = null
}
