import { ipcMain } from 'electron'
import { systemOrchestrator } from '../services/systemOrchestrator'
import { incidentRepo } from '../repositories/incidentRepo'
import type { IpcResult } from '../../shared/types'

function ok<T>(data: T): IpcResult<T> { return { success: true, data } }
function err(e: unknown): IpcResult<never> { return { success: false, error: String(e) } }

export function registerIncidentHandlers(): void {
  ipcMain.handle('incident:create', async (_e, input) => {
    try { return ok(await systemOrchestrator.createIncident(input)) }
    catch (e) { return err(e) }
  })

  ipcMain.handle('incident:getBySession', (_e, session_id: string) => {
    try { return ok(incidentRepo.getBySession(session_id)) }
    catch (e) { return err(e) }
  })

  ipcMain.handle('incident:getOpen', () => {
    try { return ok(incidentRepo.getOpen()) }
    catch (e) { return err(e) }
  })

  ipcMain.handle('incident:acknowledge', (_e, id: string, actor?: string) => {
    try {
      const result = systemOrchestrator.acknowledgeIncident(id, actor)
      if (!result) return err('Incident not found')
      return ok(result)
    } catch (e) { return err(e) }
  })

  ipcMain.handle('incident:resolve', (_e, id: string, resolved_by?: string) => {
    try {
      const result = systemOrchestrator.resolveIncident(id, resolved_by)
      if (!result) return err('Incident not found')
      return ok(result)
    } catch (e) { return err(e) }
  })

  ipcMain.handle('incident:getSystemHealth', (_e, session_id: string) => {
    try { return ok(systemOrchestrator.getSystemHealth(session_id)) }
    catch (e) { return err(e) }
  })

  ipcMain.handle('incident:getConflicts', (_e, session_id: string) => {
    try { return ok(systemOrchestrator.detectConflictsForSession(session_id)) }
    catch (e) { return err(e) }
  })

  ipcMain.handle('incident:getAuditLog', (_e, entity_type: string, entity_id: string) => {
    try { return ok(systemOrchestrator.getAuditLog(entity_type, entity_id)) }
    catch (e) { return err(e) }
  })

  ipcMain.handle('incident:getRecentAuditLog', (_e, limit?: number) => {
    try { return ok(systemOrchestrator.getRecentAuditLog(limit)) }
    catch (e) { return err(e) }
  })
}
