import { eq, asc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db'
import { routes, stops } from '../db/schema'
import type { Route, Stop, CreateRouteInput, UpdateRouteInput, CreateStopInput, UpdateStopInput, ReorderStopsInput } from '../../shared/types'

function now() {
  return new Date().toISOString()
}

export const routeRepo = {
  // ── Routes ──────────────────────────────────────────────────────────────

  getAllRoutes(): Route[] {
    return getDb().select().from(routes).orderBy(asc(routes.name)).all() as Route[]
  },

  getRouteById(id: string): Route | null {
    const result = getDb().select().from(routes).where(eq(routes.id, id)).get()
    return (result as Route) ?? null
  },

  createRoute(input: CreateRouteInput): Route {
    const id = uuidv4()
    const ts = now()
    getDb().insert(routes).values({
      id,
      name: input.name,
      name_bn: input.name_bn ?? null,
      color: input.color,
      is_active: true,
      notes: input.notes ?? null,
      created_at: ts,
      updated_at: ts
    }).run()
    return this.getRouteById(id)!
  },

  updateRoute(input: UpdateRouteInput): Route {
    const ts = now()
    getDb().update(routes)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.name_bn !== undefined && { name_bn: input.name_bn }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
        ...(input.notes !== undefined && { notes: input.notes }),
        updated_at: ts
      })
      .where(eq(routes.id, input.id))
      .run()
    return this.getRouteById(input.id)!
  },

  deleteRoute(id: string): void {
    getDb().delete(routes).where(eq(routes.id, id)).run()
  },

  // ── Stops ───────────────────────────────────────────────────────────────

  getStopsByRoute(route_id: string): Stop[] {
    return getDb()
      .select()
      .from(stops)
      .where(eq(stops.route_id, route_id))
      .orderBy(asc(stops.sequence_order))
      .all() as Stop[]
  },

  getStopById(id: string): Stop | null {
    const result = getDb().select().from(stops).where(eq(stops.id, id)).get()
    return (result as Stop) ?? null
  },

  createStop(input: CreateStopInput): Stop {
    const id = uuidv4()
    const ts = now()
    getDb().insert(stops).values({
      id,
      route_id: input.route_id,
      name: input.name,
      name_bn: input.name_bn ?? null,
      sequence_order: input.sequence_order,
      is_active: true,
      created_at: ts,
      updated_at: ts
    }).run()
    return this.getStopById(id)!
  },

  updateStop(input: UpdateStopInput): Stop {
    const ts = now()
    getDb().update(stops)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.name_bn !== undefined && { name_bn: input.name_bn }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
        updated_at: ts
      })
      .where(eq(stops.id, input.id))
      .run()
    return this.getStopById(input.id)!
  },

  reorderStops(input: ReorderStopsInput): void {
    const ts = now()
    const db = getDb()
    input.stop_ids.forEach((stopId, index) => {
      db.update(stops)
        .set({ sequence_order: index + 1, updated_at: ts })
        .where(eq(stops.id, stopId))
        .run()
    })
  },

  deleteStop(id: string): void {
    getDb().delete(stops).where(eq(stops.id, id)).run()
  }
}
