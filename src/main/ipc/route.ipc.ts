import { ipcMain } from 'electron'
import { routeService } from '../services/routeService'

export function registerRouteHandlers(): void {
  ipcMain.handle('route:getAll', () => routeService.getAllRoutes())
  ipcMain.handle('route:getWithStops', (_e, id) => routeService.getRouteWithStops(id))
  ipcMain.handle('route:create', (_e, input) => routeService.createRoute(input))
  ipcMain.handle('route:update', (_e, input) => routeService.updateRoute(input))
  ipcMain.handle('route:delete', (_e, id) => routeService.deleteRoute(id))
  ipcMain.handle('route:deleteAll', () => routeService.deleteAllRoutes())

  ipcMain.handle('stop:create', (_e, input) => routeService.createStop(input))
  ipcMain.handle('stop:update', (_e, input) => routeService.updateStop(input))
  ipcMain.handle('stop:reorder', (_e, input) => routeService.reorderStops(input))
  ipcMain.handle('stop:delete', (_e, id) => routeService.deleteStop(id))
}
