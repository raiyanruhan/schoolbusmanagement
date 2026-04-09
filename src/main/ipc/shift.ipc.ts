import { ipcMain } from 'electron'
import { shiftService } from '../services/shiftService'

export function registerShiftHandlers(): void {
  ipcMain.handle('shift:getAll', () => shiftService.getAll())
  ipcMain.handle('shift:create', (_e, input) => shiftService.create(input))
  ipcMain.handle('shift:update', (_e, input) => shiftService.update(input))
  ipcMain.handle('shift:getStopConfigs', (_e, shift_id) => shiftService.getStopConfigsByShift(shift_id))
  ipcMain.handle('shift:upsertStopConfig', (_e, input) => shiftService.upsertStopConfig(input))
}
