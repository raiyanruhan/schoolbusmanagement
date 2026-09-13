import { registerBusHandlers } from './bus.ipc'
import { registerRouteHandlers } from './route.ipc'
import { registerShiftHandlers } from './shift.ipc'
import { registerSessionHandlers } from './session.ipc'
import { registerPlannerHandlers } from './planner.ipc'
import { registerAutoPlannerHandlers } from './autoPlanner.ipc'
import { registerExcelHandlers } from './excel.ipc'
import { registerIncidentHandlers } from './incident.ipc'
import { registerAudioHandlers } from './audio.ipc'
import { registerUpdateHandlers } from './update.ipc'

export function registerAllIpcHandlers(): void {
  registerBusHandlers()
  registerRouteHandlers()
  registerShiftHandlers()
  registerSessionHandlers()
  registerPlannerHandlers()
  registerAutoPlannerHandlers()
  registerExcelHandlers()
  registerIncidentHandlers()
  registerAudioHandlers()
  registerUpdateHandlers()
  console.log('[IPC] All handlers registered')
}
