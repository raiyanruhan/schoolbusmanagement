import type Database from 'better-sqlite3'

// No seed data — users add all data through the Settings UI or Excel import.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function seedInitialData(_sqlite: Database.Database): void {
  // intentionally empty
}
