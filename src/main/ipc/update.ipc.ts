import { ipcMain } from 'electron'
import { checkForUpdates, getCurrentStatus, installNow, skipVersion } from '../services/updateService'

export function registerUpdateHandlers(): void {
  ipcMain.handle('update:getStatus', () => getCurrentStatus())
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:skip', (_e, version: string) => skipVersion(version))
  ipcMain.handle('update:installNow', () => installNow())
}
