import { auditRepo } from '../repositories/auditRepo'

export const auditLogger = {
  log(entity_type: string, entity_id: string, action: string, payload?: unknown, actor?: string): void {
    auditRepo.append({ entity_type, entity_id, action, actor, payload })
  },

  runCreated(run_id: string, payload: unknown): void {
    this.log('run', run_id, 'CREATED', payload)
  },

  runDeleted(run_id: string, payload?: unknown): void {
    this.log('run', run_id, 'DELETED', payload)
  },

  runStatusChanged(run_id: string, from: string, to: string, actor?: string): void {
    this.log('run', run_id, 'STATUS_CHANGED', { from, to }, actor)
  },

  busStatusChanged(bus_id: string, from: string, to: string, actor?: string): void {
    this.log('bus', bus_id, 'STATUS_CHANGED', { from, to }, actor)
  },

  incidentCreated(incident_id: string, payload: unknown): void {
    this.log('incident', incident_id, 'CREATED', payload)
  },

  incidentAcknowledged(incident_id: string, actor?: string): void {
    this.log('incident', incident_id, 'ACKNOWLEDGED', undefined, actor)
  },

  incidentResolved(incident_id: string, actor?: string): void {
    this.log('incident', incident_id, 'RESOLVED', undefined, actor)
  }
}
