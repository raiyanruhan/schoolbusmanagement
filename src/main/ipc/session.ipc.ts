import { ipcMain } from 'electron'
import { sessionService } from '../services/sessionService'

export function registerSessionHandlers(): void {
  ipcMain.handle('session:getOrCreateToday', () => sessionService.getOrCreateToday())
  ipcMain.handle('session:getDashboardStats', () => sessionService.getDashboardStats())
}
