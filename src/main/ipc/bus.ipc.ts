import { ipcMain } from 'electron'
import { busService } from '../services/busService'

export function registerBusHandlers(): void {
  ipcMain.handle('bus:getAll', () => busService.getAll())
  ipcMain.handle('bus:create', (_e, input) => busService.create(input))
  ipcMain.handle('bus:update', (_e, input) => busService.update(input))
  ipcMain.handle('bus:delete', (_e, id) => busService.delete(id))
}
