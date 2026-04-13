import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { incidents } from '../db/schema'
import { eq, desc, ne } from 'drizzle-orm'
import type { Incident, CreateIncidentInput, IncidentStatus } from '../../shared/types'

export const incidentRepo = {
  create(input: CreateIncidentInput): Incident {
    const db = getDb()
    const now = new Date().toISOString()
    const id = randomUUID()
    const [row] = db.insert(incidents).values({
      id,
      session_id: input.session_id,
      type: input.type,
      status: 'OPEN',
      severity: input.severity,
      title: input.title,
      description: input.description ?? null,
      bus_id: input.bus_id ?? null,
      run_id: input.run_id ?? null,
      reported_by: input.reported_by ?? null,
      resolved_by: null,
      created_at: now,
      acknowledged_at: null,
      resolved_at: null,
      metadata: null
    }).returning()
    return row as Incident
  },

  getById(id: string): Incident | null {
    const db = getDb()
    const [row] = db.select().from(incidents).where(eq(incidents.id, id))
    return (row as Incident) ?? null
  },

  getBySession(session_id: string): Incident[] {
    const db = getDb()
    return db.select()
      .from(incidents)
      .where(eq(incidents.session_id, session_id))
      .orderBy(desc(incidents.created_at)) as Incident[]
  },

  getOpen(): Incident[] {
    const db = getDb()
    return db.select()
      .from(incidents)
      .where(ne(incidents.status, 'RESOLVED'))
      .orderBy(desc(incidents.created_at)) as Incident[]
  },

  acknowledge(id: string): Incident | null {
    const db = getDb()
    const [row] = db.update(incidents)
      .set({ status: 'ACKNOWLEDGED', acknowledged_at: new Date().toISOString() })
      .where(eq(incidents.id, id))
      .returning()
    return (row as Incident) ?? null
  },

  resolve(id: string, resolved_by?: string): Incident | null {
    const db = getDb()
    const [row] = db.update(incidents)
      .set({
        status: 'RESOLVED',
        resolved_at: new Date().toISOString(),
        resolved_by: resolved_by ?? null
      })
      .where(eq(incidents.id, id))
      .returning()
    return (row as Incident) ?? null
  },

  updateStatus(id: string, status: IncidentStatus): Incident | null {
    const db = getDb()
    const now = new Date().toISOString()
    const patch: Record<string, string | null> = { status }
    if (status === 'ACKNOWLEDGED') patch.acknowledged_at = now
    if (status === 'RESOLVED') patch.resolved_at = now
    const [row] = db.update(incidents).set(patch).where(eq(incidents.id, id)).returning()
    return (row as Incident) ?? null
  },

  countOpenBySession(session_id: string): { open: number; critical: number } {
    const db = getDb()
    const allForSession = db.select()
      .from(incidents)
      .where(eq(incidents.session_id, session_id)) as Incident[]
    const rows = allForSession.filter((r) => r.status !== 'RESOLVED')
    return {
      open: rows.length,
      critical: rows.filter((r: Incident) => r.severity === 'CRITICAL' || r.severity === 'HIGH').length
    }
  }
}
