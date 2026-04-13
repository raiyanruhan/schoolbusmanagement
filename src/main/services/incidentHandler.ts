// Incident handler — reacts to incident creation with automatic system responses.
// NOT pure: writes to DB via repos.
//
// Auto-response rules:
//   BUS_BREAKDOWN  → cancel today's SCHEDULED runs for this bus (bus status unchanged — it's a day-level event)
//   BUS_MAINTENANCE → mark bus MAINTENANCE in fleet (intentional, permanent flag)
//   BUS_DELAYED    → no automatic action (monitor only)
//   DRIVER_ABSENT  → cancel today's SCHEDULED runs for this bus (do NOT touch bus status)
//   ROUTE_BLOCKED  → no automatic action (manual reassignment needed)

import { runRepo } from '../repositories/runRepo'
import { getDb } from '../db'
import { buses } from '../db/schema'
import { eq } from 'drizzle-orm'
import { auditLogger } from './auditLogger'
import type { Incident } from '../../shared/types'

export const incidentHandler = {
  async handleNew(incident: Incident): Promise<void> {
    switch (incident.type) {
      case 'BUS_BREAKDOWN':
        await this._cancelSessionRuns(incident, 'system:breakdown')
        auditLogger.log('incident', incident.id, 'AUTO_RESPONSE', {
          action: 'RUNS_CANCELLED',
          note: 'Bus status NOT changed — breakdown is a session-level event, not a permanent fleet change',
          bus_id: incident.bus_id
        })
        break

      case 'BUS_MAINTENANCE':
        // Intentional fleet event — mark the bus permanently until cleared
        await this._setBusMaintenance(incident)
        break

      case 'BUS_DELAYED':
        auditLogger.log('incident', incident.id, 'AUTO_RESPONSE', {
          action: 'NONE',
          note: 'BUS_DELAYED — monitor only, no automatic run changes'
        })
        break

      case 'DRIVER_ABSENT':
        // Driver issue — cancel runs, but bus itself is fine
        await this._cancelSessionRuns(incident, 'system:driver_absent')
        auditLogger.log('incident', incident.id, 'AUTO_RESPONSE', {
          action: 'RUNS_CANCELLED',
          note: 'Bus status NOT changed — driver absence does not affect bus fleet status',
          bus_id: incident.bus_id
        })
        break

      case 'ROUTE_BLOCKED':
        auditLogger.log('incident', incident.id, 'AUTO_RESPONSE', {
          action: 'NONE',
          note: 'ROUTE_BLOCKED — manual reassignment required'
        })
        break
    }
  },

  /** Cancel all SCHEDULED runs for this bus in this session. Does not touch bus status. */
  async _cancelSessionRuns(incident: Incident, actor: string): Promise<void> {
    if (!incident.bus_id) return

    const sessionRuns = runRepo.getRunsBySession(incident.session_id)
    for (const run of sessionRuns) {
      if (run.bus_id === incident.bus_id && run.status === 'SCHEDULED') {
        runRepo.updateRunStatus(run.id, 'CANCELLED')
        auditLogger.runStatusChanged(run.id, 'SCHEDULED', 'CANCELLED', actor)
      }
    }
  },

  /** Mark a bus as MAINTENANCE in the fleet — used only for BUS_MAINTENANCE incidents. */
  async _setBusMaintenance(incident: Incident): Promise<void> {
    if (!incident.bus_id) return

    const db = getDb()
    const [bus] = db.select().from(buses).where(eq(buses.id, incident.bus_id))
    if (!bus) return

    const oldStatus = (bus as { status: string }).status
    if (oldStatus === 'MAINTENANCE') {
      auditLogger.log('incident', incident.id, 'AUTO_RESPONSE', {
        action: 'SKIPPED',
        note: 'Bus already in MAINTENANCE'
      })
      return
    }

    db.update(buses)
      .set({ status: 'MAINTENANCE', updated_at: new Date().toISOString() })
      .where(eq(buses.id, incident.bus_id))
      .run()

    auditLogger.busStatusChanged(incident.bus_id, oldStatus, 'MAINTENANCE', 'system:maintenance_incident')
    auditLogger.log('incident', incident.id, 'AUTO_RESPONSE', {
      action: 'BUS_MARKED_MAINTENANCE',
      bus_id: incident.bus_id
    })
  }
}
