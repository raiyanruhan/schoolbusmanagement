import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '../../shared/types'
import { getSkippedVersion, setSkippedVersion } from './updatePrefs'

const { autoUpdater } = electronUpdater

// Author-controlled release metadata — kept as a plain file on `main` so it can
// be edited and pushed independently of cutting a GitHub Release.
// Missing file / fetch failure both mean "treat as a normal optional update".
const MANIFEST_URL =
  'https://raw.githubusercontent.com/raiyanruhan/schoolbusmanagement/main/update-manifest.json'
const FETCH_TIMEOUT_MS = 8000

interface UpdateManifest {
  minVersion: string
  mandatory: boolean
  notes: string | null
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return Math.sign(diff)
  }
  return 0
}

async function fetchManifest(): Promise<UpdateManifest | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data.minVersion !== 'string') return null
    return { minVersion: data.minVersion, mandatory: !!data.mandatory, notes: data.notes ?? null }
  } catch {
    return null
  }
}

let latestManifest: UpdateManifest | null = null
let currentStatus: UpdateStatus = { state: 'not-available' }
let mainWindow: BrowserWindow | null = null
// Set once on 'update-available' so 'download-progress' (which only carries a
// percent, not version/mandatory) can tag its events consistently.
let pending: { version: string; mandatory: boolean } | null = null

function isMandatory(version: string): boolean {
  if (!latestManifest?.mandatory) return false
  return compareVersions(app.getVersion(), latestManifest.minVersion) < 0 && !!version
}

function emit(status: UpdateStatus): void {
  currentStatus = status
  mainWindow?.webContents.send('update:event', status)
}

export function getCurrentStatus(): UpdateStatus {
  return currentStatus
}

export function skipVersion(version: string): void {
  setSkippedVersion(version)
}

export function installNow(): void {
  autoUpdater.quitAndInstall()
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) return // no update feed in dev
  latestManifest = await fetchManifest()
  emit({ state: 'checking' })
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    emit({ state: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

export function initUpdater(win: BrowserWindow): void {
  mainWindow = win
  autoUpdater.autoDownload = true // download quietly in the background — never blocks the UI
  autoUpdater.autoInstallOnAppQuit = false // we decide when to install (mandatory vs. optional)

  autoUpdater.on('update-available', (info) => {
    const mandatory = isMandatory(info.version)
    if (!mandatory && getSkippedVersion() === info.version) return // user dismissed this one already
    pending = { version: info.version, mandatory }
    emit({ state: 'available', version: info.version, mandatory, notes: latestManifest?.notes ?? null })
  })

  autoUpdater.on('update-not-available', () => {
    pending = null
    emit({ state: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    if (!pending) return
    emit({ state: 'downloading', version: pending.version, mandatory: pending.mandatory, percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    const mandatory = isMandatory(info.version)
    if (!mandatory && getSkippedVersion() === info.version) return
    // Mandatory doesn't mean "install without asking" — it means the renderer shows
    // a blocking, non-dismissable modal until the user clicks Restart & Install.
    emit({ state: 'downloaded', version: info.version, mandatory, notes: latestManifest?.notes ?? null })
  })

  autoUpdater.on('error', (err) => emit({ state: 'error', message: err.message }))

  // First check a few seconds after launch — never on the critical startup path —
  // then poll periodically. All work happens off the render thread already;
  // downloads are silent, so none of this can block the user's session.
  setTimeout(() => void checkForUpdates(), 5000)
  setInterval(() => void checkForUpdates(), 4 * 60 * 60 * 1000)
}
