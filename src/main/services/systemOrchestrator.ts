// System orchestrator — centralized event hub
// All significant state changes flow through here
import { incidentRepo } from '../repositories/incidentRepo'
import { auditRepo } from '../repositories/auditRepo'
import { runRepo } from '../repositories/runRepo'
import { getDb } from '../db'
import { buses } from '../db/schema'
import { detectConflicts } from '../engine/conflictDetector'
import { incidentHandler } from './incidentHandler'
import { auditLogger } from './auditLogger'
import type { CreateIncidentInput, Conflict, Bus, RunWithDetails, SystemHealth } from '../../shared/types'

export const systemOrchestrator = {
  /**
   * Create an incident and trigger automatic system responses.
   */
  async createIncident(input: CreateIncidentInput) {
    const incident = incidentRepo.create(input)
    auditLogger.incidentCreated(incident.id, input)
    await incidentHandler.handleNew(incident)
    return incident
  },

  acknowledgeIncident(id: string, actor?: string) {
    const incident = incidentRepo.acknowledge(id)
    if (incident) auditLogger.incidentAcknowledged(id, actor)
    return incident
  },

  resolveIncident(id: string, resolved_by?: string) {
    const incident = incidentRepo.resolve(id, resolved_by)
    if (incident) auditLogger.incidentResolved(id, resolved_by)
    return incident
  },

  /**
   * Run conflict detection for a session and return current conflicts.
   */
  detectConflictsForSession(session_id: string): Conflict[] {
    const db = getDb()
    const allRuns = runRepo.getAllRunsWithDetails(session_id) as RunWithDetails[]
    const allBuses = db.select().from(buses).all() as Bus[]
    return detectConflicts(allRuns, allBuses)
  },

  /**
   * Get system health for a session (for dashboard alert bar).
   */
  getSystemHealth(session_id: string): SystemHealth {
    const { open, critical } = incidentRepo.countOpenBySession(session_id)
    const conflicts = this.detectConflictsForSession(session_id)
    const activeConflicts = conflicts.length

    let level: SystemHealth['level'] = 'GREEN'
    if (critical > 0 || conflicts.some((c) => c.severity === 'CRITICAL')) {
      level = 'RED'
    } else if (open > 0 || activeConflicts > 0) {
      level = 'YELLOW'
    }

    return { level, openIncidents: open, criticalIncidents: critical, activeConflicts }
  },

  getAuditLog(entity_type: string, entity_id: string) {
    return auditRepo.getForEntity(entity_type, entity_id)
  },

  getRecentAuditLog(limit = 50) {
    return auditRepo.getRecent(limit)
  }
}
