import { ipcMain } from 'electron'
import { plannerService } from '../services/plannerService'

export function registerPlannerHandlers(): void {
  ipcMain.handle('planner:getRuns', (_e, session_id) => plannerService.getRunsForSession(session_id))
  ipcMain.handle('planner:getAllRunsWithDetails', (_e, session_id) => plannerService.getAllRunsWithDetails(session_id))
  ipcMain.handle('planner:getRunDetail', (_e, run_id) => plannerService.getRunWithDetails(run_id))
  ipcMain.handle('planner:createRun', (_e, input) => plannerService.createRun(input))
  ipcMain.handle('planner:deleteRun', (_e, id) => plannerService.deleteRun(id))
}
