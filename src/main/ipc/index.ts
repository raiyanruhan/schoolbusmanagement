import { registerBusHandlers } from './bus.ipc'
import { registerRouteHandlers } from './route.ipc'
import { registerShiftHandlers } from './shift.ipc'
import { registerSessionHandlers } from './session.ipc'
import { registerPlannerHandlers } from './planner.ipc'
import { registerAutoPlannerHandlers } from './autoPlanner.ipc'
import { registerExcelHandlers } from './excel.ipc'

export function registerAllIpcHandlers(): void {
  registerBusHandlers()
  registerRouteHandlers()
  registerShiftHandlers()
  registerSessionHandlers()
  registerPlannerHandlers()
  registerAutoPlannerHandlers()
  registerExcelHandlers()
  console.log('[IPC] All handlers registered')
}
