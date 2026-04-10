import { eq, and, asc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db'
import { runs, runStops, stops, buses, routes } from '../db/schema'
import type { Run, RunStop, CreateRunInput, RunWithDetails } from '../../shared/types'

function now() {
  return new Date().toISOString()
}

export const runRepo = {
  getRunsBySession(session_id: string): Run[] {
    return getDb()
      .select()
      .from(runs)
      .where(eq(runs.session_id, session_id))
      .all() as Run[]
  },

  getRunById(id: string): Run | null {
    const result = getDb().select().from(runs).where(eq(runs.id, id)).get()
    return (result as Run) ?? null
  },

  getRunStops(run_id: string): RunStop[] {
    return getDb()
      .select()
      .from(runStops)
      .where(eq(runStops.run_id, run_id))
      .orderBy(asc(runStops.sequence_order))
      .all() as RunStop[]
  },

  getRunWithDetails(id: string): RunWithDetails | null {
    const run = this.getRunById(id)
    if (!run) return null

    const db = getDb()
    const bus = db.select().from(buses).where(eq(buses.id, run.bus_id)).get()
    const route = db.select().from(routes).where(eq(routes.id, run.route_id)).get()
    const runStopRows = this.getRunStops(id)

    const stopsWithDetails = runStopRows.map((rs) => {
      const stop = db.select().from(stops).where(eq(stops.id, rs.stop_id)).get()
      return { ...rs, stop: stop! }
    })

    return {
      ...run,
      bus: bus!,
      route: route!,
      stops: stopsWithDetails
    } as unknown as RunWithDetails
  },

  getAllRunsWithDetails(session_id: string): RunWithDetails[] {
    const sessionRuns = this.getRunsBySession(session_id)
    return sessionRuns
      .filter((r) => r.status !== 'CANCELLED')
      .map((r) => this.getRunWithDetails(r.id))
      .filter((r): r is RunWithDetails => r !== null)
  },

  createRun(input: CreateRunInput): Run {
    const db = getDb()
    const id = uuidv4()
    const ts = now()

    db.insert(runs).values({
      id,
      session_id: input.session_id,
      shift_id: input.shift_id,
      bus_id: input.bus_id,
      route_id: input.route_id,
      direction: input.direction,
      gender: input.gender,
      type: 'REGULAR',
      status: 'SCHEDULED',
      planned_depart: null,
      planned_return: null,
      actual_depart: null,
      actual_return: null,
      overload_limit: input.overload_limit ?? 0,
      assigned_by: 'MANUAL',
      notes: input.notes ?? null,
      created_at: ts,
      updated_at: ts
    }).run()

    // Insert RunStops
    input.stop_ids.forEach((stopId, index) => {
      db.insert(runStops).values({
        id: uuidv4(),
        run_id: id,
        stop_id: stopId,
        sequence_order: index + 1,
        student_count: 0,
        gender: input.gender
      }).run()
    })

    return this.getRunById(id)!
  },

  createRunAuto(input: {
    session_id: string
    shift_id: string
    bus_id: string
    route_id: string
    direction: Run['direction']
    gender: Run['gender']
    stop_ids: string[]
    stop_student_counts: number[]
    overload_limit?: number
    assigned_by: Run['assigned_by']
    notes?: string
  }): Run {
    const db = getDb()
    const id = uuidv4()
    const ts = now()

    db.insert(runs).values({
      id,
      session_id: input.session_id,
      shift_id: input.shift_id,
      bus_id: input.bus_id,
      route_id: input.route_id,
      direction: input.direction,
      gender: input.gender,
      type: 'REGULAR',
      status: 'SCHEDULED',
      planned_depart: null,
      planned_return: null,
      actual_depart: null,
      actual_return: null,
      overload_limit: input.overload_limit ?? 0,
      assigned_by: input.assigned_by,
      notes: input.notes ?? null,
      created_at: ts,
      updated_at: ts
    }).run()

    // Insert RunStops with actual student counts from engine
    input.stop_ids.forEach((stopId, index) => {
      db.insert(runStops).values({
        id: uuidv4(),
        run_id: id,
        stop_id: stopId,
        sequence_order: index + 1,
        student_count: input.stop_student_counts[index] ?? 0,
        gender: input.gender
      }).run()
    })

    return this.getRunById(id)!
  },

  updateRunStatus(id: string, status: Run['status']): void {
    getDb().update(runs)
      .set({ status, updated_at: now() })
      .where(eq(runs.id, id))
      .run()
  },

  deleteRun(id: string): void {
    getDb().delete(runs).where(eq(runs.id, id)).run()
  },

  isStopAssignedInSession(session_id: string, stop_id: string, shift_id: string): boolean {
    const db = getDb()
    const sessionRuns = db.select({ id: runs.id })
      .from(runs)
      .where(and(eq(runs.session_id, session_id), eq(runs.shift_id, shift_id)))
      .all()

    for (const run of sessionRuns) {
      const rs = db.select()
        .from(runStops)
        .where(and(eq(runStops.run_id, run.id), eq(runStops.stop_id, stop_id)))
        .get()
      if (rs) return true
    }
    return false
  }
}
