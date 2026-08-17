import { ipcMain } from 'electron'
import { audioService } from '../services/audioService'

export function registerAudioHandlers(): void {
  ipcMain.handle('audio:getAll', () => audioService.getAll())
  ipcMain.handle('audio:saveClip', (_e, input) => audioService.saveClip(input))
  ipcMain.handle('audio:deleteClip', (_e, id) => audioService.deleteClip(id))
  ipcMain.handle('audio:getStopTimestamps', (_e, routeId) => audioService.getStopTimestamps(routeId))
  ipcMain.handle('audio:saveStopTimestamps', (_e, input) => audioService.saveStopTimestamps(input))
  ipcMain.handle('audio:resolveAnnouncements', (_e, input) => audioService.resolveAnnouncements(input))
}
