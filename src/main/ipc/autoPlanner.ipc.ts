import { ipcMain } from 'electron'
import { autoPlannerService } from '../services/autoPlannerService'

export function registerAutoPlannerHandlers(): void {
  ipcMain.handle('autoPlanner:generate', (_e, input) =>
    autoPlannerService.generatePlan(input)
  )

  ipcMain.handle('autoPlanner:generateBest', (_e, input) =>
    autoPlannerService.generateBestPlan(input)
  )

  ipcMain.handle('autoPlanner:approve', (_e, input) =>
    autoPlannerService.approvePlan(input)
  )
}
