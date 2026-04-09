import { eq, and, asc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db'
import { shifts, stopConfigs } from '../db/schema'
import type { Shift, StopConfig, CreateShiftInput, UpdateShiftInput, UpsertStopConfigInput } from '../../shared/types'

function now() {
  return new Date().toISOString()
}

export const shiftRepo = {
  getAll(): Shift[] {
    return getDb().select().from(shifts).orderBy(asc(shifts.sort_order)).all() as Shift[]
  },

  getById(id: string): Shift | null {
    const result = getDb().select().from(shifts).where(eq(shifts.id, id)).get()
    return (result as Shift) ?? null
  },

  create(input: CreateShiftInput): Shift {
    const id = uuidv4()
    const ts = now()
    getDb().insert(shifts).values({
      id,
      name: input.name,
      name_bn: input.name_bn ?? null,
      sort_order: input.sort_order,
      is_active: true,
      inbound_depart_school: input.inbound_depart_school ?? null,
      inbound_arrive_stops: input.inbound_arrive_stops ?? null,
      inbound_arrive_school: input.inbound_arrive_school ?? null,
      school_start_time: input.school_start_time ?? null,
      school_end_time: input.school_end_time ?? null,
      outbound_depart_school: input.outbound_depart_school ?? null,
      outbound_arrive_stops: input.outbound_arrive_stops ?? null,
      gender_mode: input.gender_mode,
      default_overload: input.default_overload,
      created_at: ts,
      updated_at: ts
    }).run()
    return this.getById(id)!
  },

  update(input: UpdateShiftInput): Shift {
    const ts = now()
    getDb().update(shifts)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.name_bn !== undefined && { name_bn: input.name_bn }),
        ...(input.sort_order !== undefined && { sort_order: input.sort_order }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
        ...(input.inbound_depart_school !== undefined && { inbound_depart_school: input.inbound_depart_school }),
        ...(input.inbound_arrive_stops !== undefined && { inbound_arrive_stops: input.inbound_arrive_stops }),
        ...(input.inbound_arrive_school !== undefined && { inbound_arrive_school: input.inbound_arrive_school }),
        ...(input.school_start_time !== undefined && { school_start_time: input.school_start_time }),
        ...(input.school_end_time !== undefined && { school_end_time: input.school_end_time }),
        ...(input.outbound_depart_school !== undefined && { outbound_depart_school: input.outbound_depart_school }),
        ...(input.outbound_arrive_stops !== undefined && { outbound_arrive_stops: input.outbound_arrive_stops }),
        ...(input.gender_mode !== undefined && { gender_mode: input.gender_mode }),
        ...(input.default_overload !== undefined && { default_overload: input.default_overload }),
        updated_at: ts
      })
      .where(eq(shifts.id, input.id))
      .run()
    return this.getById(input.id)!
  },

  // ── StopConfigs ──────────────────────────────────────────────────────────

  getStopConfigsByShift(shift_id: string): StopConfig[] {
    return getDb()
      .select()
      .from(stopConfigs)
      .where(eq(stopConfigs.shift_id, shift_id))
      .all() as StopConfig[]
  },

  getStopConfig(stop_id: string, shift_id: string): StopConfig | null {
    const result = getDb()
      .select()
      .from(stopConfigs)
      .where(and(eq(stopConfigs.stop_id, stop_id), eq(stopConfigs.shift_id, shift_id)))
      .get()
    return (result as StopConfig) ?? null
  },

  upsertStopConfig(input: UpsertStopConfigInput): StopConfig {
    const existing = this.getStopConfig(input.stop_id, input.shift_id)
    const ts = now()

    if (existing) {
      getDb().update(stopConfigs)
        .set({
          is_active: input.is_active,
          planned_boys: input.planned_boys,
          planned_girls: input.planned_girls,
          updated_at: ts
        })
        .where(eq(stopConfigs.id, existing.id))
        .run()
      return this.getStopConfig(input.stop_id, input.shift_id)!
    } else {
      const id = uuidv4()
      getDb().insert(stopConfigs).values({
        id,
        stop_id: input.stop_id,
        shift_id: input.shift_id,
        is_active: input.is_active,
        planned_boys: input.planned_boys,
        planned_girls: input.planned_girls,
        created_at: ts,
        updated_at: ts
      }).run()
      return this.getStopConfig(input.stop_id, input.shift_id)!
    }
  }
}
