import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { auditLog } from '../db/schema'
import { eq, desc, and as drizzleAnd } from 'drizzle-orm'
import type { AuditLog } from '../../shared/types'

export interface AuditEntry {
  entity_type: string
  entity_id: string
  action: string
  actor?: string
  payload?: unknown
}

export const auditRepo = {
  append(entry: AuditEntry): void {
    try {
      const db = getDb()
      db.insert(auditLog).values({
        id: randomUUID(),
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        action: entry.action,
        actor: entry.actor ?? null,
        payload: entry.payload ? JSON.stringify(entry.payload) : null,
        created_at: new Date().toISOString()
      }).run()
    } catch {
      // Audit log never fails silently — but must never crash the caller
      console.error('[AuditLog] Failed to write entry:', entry)
    }
  },

  getForEntity(entity_type: string, entity_id: string): AuditLog[] {
    const db = getDb()
    return db.select()
      .from(auditLog)
      .where(drizzleAnd(
        eq(auditLog.entity_type, entity_type),
        eq(auditLog.entity_id, entity_id)
      ))
      .orderBy(desc(auditLog.created_at)) as AuditLog[]
  },

  getRecent(limit = 50): AuditLog[] {
    const db = getDb()
    return db.select()
      .from(auditLog)
      .orderBy(desc(auditLog.created_at))
      .limit(limit) as AuditLog[]
  }
}
