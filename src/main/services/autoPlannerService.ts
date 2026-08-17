import { z } from 'zod'
import { busRepo } from '../repositories/busRepo'
import { routeRepo } from '../repositories/routeRepo'
import { shiftRepo } from '../repositories/shiftRepo'
import { runRepo } from '../repositories/runRepo'
import { runAssignmentEngine } from '../engine/assignmentEngine'
import { parseTimeToDate } from '../engine/timeCalculator'
import type { IpcResult, Run } from '../../shared/types'
import type { EngineOutput, EngineInput, AssignmentStrategy, StopWithCount, TimeConfig } from '../engine/types'

// ─── Input schemas ────────────────────────────────────────────────────────────

const GeneratePlanSchema = z.object({
  session_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  strategy: z.enum(['LARGEST_ROUTE_FIRST', 'SMALLEST_ROUTE_FIRST', 'SEQUENCE_ORDER'])
})

const GenerateBestPlanSchema = z.object({
  session_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  direction: z.enum(['INBOUND', 'OUTBOUND'])
})

const ALL_STRATEGIES: AssignmentStrategy[] = ['LARGEST_ROUTE_FIRST', 'SMALLEST_ROUTE_FIRST', 'SEQUENCE_ORDER']

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

type EngineInputBase = {
  buses: ReturnType<typeof busRepo.getAll>
  engineRoutes: EngineInput['routes']
  existingRuns: ReturnType<typeof runRepo.getRunsBySession>
  configBase: Omit<EngineInput['config'], 'strategy'>
}

function buildEngineInputBase(input: {
  session_id: string
  shift_id: string
  direction: 'INBOUND' | 'OUTBOUND'
}): { error: string } | { data: EngineInputBase } {
  // Load shift to get gender_mode and default_overload
  const shift = shiftRepo.getById(input.shift_id)
  if (!shift) return { error: 'Shift not found' }

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

  const configBase: Omit<EngineInput['config'], 'strategy'> = {
    shift_id: input.shift_id,
    session_id: input.session_id,
    direction: input.direction,
    gender_mode: shift.gender_mode,
    overload_limit: shift.default_overload,
    underfill_threshold: 5,
    ...(time_config && { time_config })
  }

  return { data: { buses: allBuses, engineRoutes, existingRuns, configBase } }
}

/**
 * Score a plan for auto-selection: lower is better on (unassigned, buses, splits),
 * higher is better on utilization — compared lexicographically in that order.
 */
function scorePlan(output: EngineOutput, buses: ReturnType<typeof busRepo.getAll>): {
  unassigned: number
  busesUsed: number
  splitRoutes: number
  utilization: number
} {
  const busCapacityById = new Map(buses.map((b) => [b.id, b.capacity]))
  const usedCapacity = output.proposedRuns.reduce(
    (sum, r) => sum + (busCapacityById.get(r.bus_id) ?? r.capacity),
    0
  )
  const utilization = usedCapacity > 0 ? output.summary.totalStudentsAssigned / usedCapacity : 0

  return {
    unassigned: output.summary.totalStudentsUnassigned,
    busesUsed: output.summary.totalBusesUsed,
    splitRoutes: output.summary.splitRoutes,
    utilization
  }
}

function compareScores(
  a: ReturnType<typeof scorePlan>,
  b: ReturnType<typeof scorePlan>
): number {
  if (a.unassigned !== b.unassigned) return a.unassigned - b.unassigned
  if (a.busesUsed !== b.busesUsed) return a.busesUsed - b.busesUsed
  if (a.splitRoutes !== b.splitRoutes) return a.splitRoutes - b.splitRoutes
  return b.utilization - a.utilization
}

export interface StrategyComparisonEntry {
  strategy: AssignmentStrategy
  totalBusesUsed: number
  totalStudentsUnassigned: number
  splitRoutes: number
  overloadedRuns: number
  utilization: number
  output: EngineOutput
}

export interface BestPlanResult {
  output: EngineOutput
  strategyUsed: AssignmentStrategy
  comparison: StrategyComparisonEntry[]
}

export const autoPlannerService = {
  generatePlan(
    rawInput: unknown
  ): IpcResult<EngineOutput> {
    try {
      const input = GeneratePlanSchema.parse(rawInput)

      const base = buildEngineInputBase(input)
      if ('error' in base) return { success: false, error: base.error }
      const { buses, engineRoutes, existingRuns, configBase } = base.data

      const output = runAssignmentEngine({
        buses,
        routes: engineRoutes,
        existingRuns,
        config: { ...configBase, strategy: input.strategy as AssignmentStrategy }
      })

      return { success: true, data: output }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  /**
   * Runs the engine once per strategy, scores each result, and returns
   * the best plan along with a comparison of all strategies tried.
   */
  generateBestPlan(rawInput: unknown): IpcResult<BestPlanResult> {
    try {
      const input = GenerateBestPlanSchema.parse(rawInput)

      const base = buildEngineInputBase(input)
      if ('error' in base) return { success: false, error: base.error }
      const { buses, engineRoutes, existingRuns, configBase } = base.data

      const results = ALL_STRATEGIES.map((strategy) => {
        const output = runAssignmentEngine({
          buses,
          routes: engineRoutes,
          existingRuns,
          config: { ...configBase, strategy }
        })
        return { strategy, output, score: scorePlan(output, buses) }
      })

      results.sort((a, b) => compareScores(a.score, b.score))
      const best = results[0]

      const comparison: StrategyComparisonEntry[] = results.map((r) => ({
        strategy: r.strategy,
        totalBusesUsed: r.output.summary.totalBusesUsed,
        totalStudentsUnassigned: r.output.summary.totalStudentsUnassigned,
        splitRoutes: r.output.summary.splitRoutes,
        overloadedRuns: r.output.summary.overloadedRuns,
        utilization: r.score.utilization,
        output: r.output
      }))

      return {
        success: true,
        data: { output: best.output, strategyUsed: best.strategy, comparison }
      }
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
