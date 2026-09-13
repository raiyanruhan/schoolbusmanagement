import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Tiny flat-file preference store for the updater — a single skipped version
// doesn't warrant a SQLite table/migration, and it must be readable before
// the DB is initialized.
const prefsPath = (): string => join(app.getPath('userData'), 'update-prefs.json')

interface UpdatePrefs {
  skippedVersion: string | null
}

function read(): UpdatePrefs {
  try {
    const path = prefsPath()
    if (!existsSync(path)) return { skippedVersion: null }
    return { skippedVersion: null, ...JSON.parse(readFileSync(path, 'utf8')) }
  } catch {
    return { skippedVersion: null }
  }
}

function write(prefs: UpdatePrefs): void {
  try {
    writeFileSync(prefsPath(), JSON.stringify(prefs), 'utf8')
  } catch (err) {
    console.error('[updatePrefs] failed to persist', err)
  }
}

export function getSkippedVersion(): string | null {
  return read().skippedVersion
}

export function setSkippedVersion(version: string): void {
  write({ skippedVersion: version })
}
