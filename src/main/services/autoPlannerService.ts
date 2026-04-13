import { z } from 'zod'
import { busRepo } from '../repositories/busRepo'
import { routeRepo } from '../repositories/routeRepo'
import { shiftRepo } from '../repositories/shiftRepo'
import { runRepo } from '../repositories/runRepo'
import { runAssignmentEngine } from '../engine/assignmentEngine'
import { parseTimeToDate } from '../engine/timeCalculator'
import type { IpcResult, Run } from '../../shared/types'
import type { EngineOutput, ProposedRun, AssignmentStrategy, StopWithCount, TimeConfig } from '../engine/types'

// ─── Input schemas ────────────────────────────────────────────────────────────

const GeneratePlanSchema = z.object({
  session_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  strategy: z.enum(['LARGEST_ROUTE_FIRST', 'SMALLEST_ROUTE_FIRST', 'SEQUENCE_ORDER'])
})

const ApprovePlanSchema = z.object({
  session_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  proposedRuns: z.array(z.object({
    temp_id: z.string(),
    bus_id: z.string().uuid(),
    route_id: z.string().uuid(),
    direction: z.enum(['INBOUND', 'OUTBOUND']),
    gender: z.enum(['BOYS', 'GIRLS', 'MIXED']),
    stops: z.array(z.object({
      stop_id: z.string().uuid(),
      stop_name: z.string(),
      student_count: z.number()
    })),
    overload_limit: z.number()
  }))
})

// ─── Service ─────────────────────────────────────────────────────────────────

export const autoPlannerService = {
  generatePlan(
    rawInput: unknown
  ): IpcResult<EngineOutput> {
    try {
      const input = GeneratePlanSchema.parse(rawInput)

      // Load shift to get gender_mode and default_overload
      const shift = shiftRepo.getById(input.shift_id)
      if (!shift) return { success: false, error: 'Shift not found' }

      // Load all active buses
      const allBuses = busRepo.getAll()

      // Load all active routes with stops
      const allRoutes = routeRepo.getAllRoutes()
      const activeRoutes = allRoutes.filter((r) => r.is_active)

      // Load stop configs for this shift
      const stopConfigs = shiftRepo.getStopConfigsByShift(input.shift_id)
      const stopConfigMap = new Map(
        stopConfigs.map((sc) => [sc.stop_id, sc])
      )

      // Build routes with StopWithCount
      const engineRoutes = activeRoutes.map((route) => {
        const routeStops = routeRepo.getStopsByRoute(route.id)
        const activeStops = routeStops.filter((s) => s.is_active)

        const stopsWithCount: StopWithCount[] = activeStops.map((stop) => {
          const config = stopConfigMap.get(stop.id)
          const planned_boys = config?.planned_boys ?? 0
          const planned_girls = config?.planned_girls ?? 0
          return {
            stop_id: stop.id,
            stop_name: stop.name,
            sequence_order: stop.sequence_order,
            planned_boys,
            planned_girls,
            total: planned_boys + planned_girls
          }
        })

        return {
          id: route.id,
          name: route.name,
          name_bn: route.name_bn,
          color: route.color,
          stops: stopsWithCount
        }
      })

      // Load existing runs for session + shift
      const allSessionRuns = runRepo.getRunsBySession(input.session_id)
      const existingRuns = allSessionRuns.filter((r) => r.shift_id === input.shift_id)

      // Build time_config from shift timing fields (if available)
      const today = new Date()
      let time_config: TimeConfig | undefined

      if (input.direction === 'OUTBOUND') {
        const departure = parseTimeToDate(shift.outbound_depart_school, today)
        const deadline = parseTimeToDate(shift.outbound_arrive_stops, today)
        if (departure && deadline && deadline > departure) {
          time_config = {
            base_stop_time_sec: 20,
            per_student_time_sec: 2,
            departure_time: departure,
            arrival_deadline: deadline
          }
        }
      } else {
        // INBOUND: buses depart from stops, arrive at school
        const departure = parseTimeToDate(shift.inbound_depart_school, today)
        const deadline = parseTimeToDate(shift.inbound_arrive_school, today)
        if (departure && deadline && deadline > departure) {
          time_config = {
            base_stop_time_sec: 20,
            per_student_time_sec: 2,
            departure_time: departure,
            arrival_deadline: deadline
          }
        }
      }

      // Build engine config
      const engineConfig = {
        shift_id: input.shift_id,
        session_id: input.session_id,
        direction: input.direction,
        gender_mode: shift.gender_mode,
        strategy: input.strategy as AssignmentStrategy,
        overload_limit: shift.default_overload,
        underfill_threshold: 5,
        ...(time_config && { time_config })
      }

      const output = runAssignmentEngine({
        buses: allBuses,
        routes: engineRoutes,
        existingRuns,
        config: engineConfig
      })

      return { success: true, data: output }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  approvePlan(rawInput: unknown): IpcResult<Run[]> {
    try {
      const input = ApprovePlanSchema.parse(rawInput)
      const createdRuns: Run[] = []

      for (const proposed of input.proposedRuns) {
        // Skip runs with no stops
        if (proposed.stops.length === 0) continue

        const run = runRepo.createRunAuto({
          session_id: input.session_id,
          shift_id: input.shift_id,
          bus_id: proposed.bus_id,
          route_id: proposed.route_id,
          direction: proposed.direction,
          gender: proposed.gender,
          stop_ids: proposed.stops.map((s) => s.stop_id),
          stop_student_counts: proposed.stops.map((s) => s.student_count),
          overload_limit: proposed.overload_limit,
          assigned_by: 'AUTO'
        })

        createdRuns.push(run)
      }

      return { success: true, data: createdRuns }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  }
}
