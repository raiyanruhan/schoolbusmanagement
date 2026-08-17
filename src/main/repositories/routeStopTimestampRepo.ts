import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db'
import { routeStopTimestamps } from '../db/schema'

export interface RouteStopTimestampRow {
  id: string
  route_id: string
  stop_id: string
  start_ms: number
  end_ms: number
}

function now() {
  return new Date().toISOString()
}

export const routeStopTimestampRepo = {
  getByRoute(route_id: string): RouteStopTimestampRow[] {
    return getDb()
      .select()
      .from(routeStopTimestamps)
      .where(eq(routeStopTimestamps.route_id, route_id))
      .all() as RouteStopTimestampRow[]
  },

  /** Replace all timestamps for a route with the given set. */
  replaceForRoute(route_id: string, timestamps: Array<{ stop_id: string; start_ms: number; end_ms: number }>): void {
    const db = getDb()
    const ts = now()
    db.delete(routeStopTimestamps).where(eq(routeStopTimestamps.route_id, route_id)).run()
    for (const t of timestamps) {
      db.insert(routeStopTimestamps).values({
        id: uuidv4(),
        route_id,
        stop_id: t.stop_id,
        start_ms: t.start_ms,
        end_ms: t.end_ms,
        created_at: ts,
        updated_at: ts
      }).run()
    }
  }
}
