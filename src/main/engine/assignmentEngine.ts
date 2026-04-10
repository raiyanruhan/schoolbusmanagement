import { v4 as uuidv4 } from 'uuid'
import { getAvailableBuses } from './availability'
import { resolveGenderGroups } from './genderLogic'
import { splitIntoContiguousGroups } from './capacityPlanner'
import type {
  EngineInput,
  EngineOutput,
  ProposedRun,
  UnassignedStopInfo,
  EngineWarning,
  StopWithCount,
  Bus
} from './types'

/**
 * Main engine orchestrator — pure function, no DB access.
 *
 * Algorithm:
 * 1. Get available buses (active + not used in this shift+direction)
 * 2. Sort routes by strategy
 * 3. For each route → resolve gender groups → split into capacity groups → assign a bus
 * 4. Compile output
 */
export function runAssignmentEngine(input: EngineInput): EngineOutput {
  const { buses, routes, existingRuns, config } = input

  const proposedRuns: ProposedRun[] = []
  const unassignedStops: UnassignedStopInfo[] = []
  const globalWarnings: EngineWarning[] = []

  // 1. Available buses
  const availableBuses = getAvailableBuses(buses, existingRuns, config.shift_id, config.direction)
  const busPool: Bus[] = [...availableBuses]

  // 2. Sort routes by strategy
  const sortedRoutes = sortRoutes(routes, config.strategy)

  // Track which routes need more than one bus (split routes)
  const splitRouteIds = new Set<string>()

  // 3. Process each route
  for (const route of sortedRoutes) {
    const activeStops = route.stops.filter((s) => s.total > 0 || (s.planned_boys + s.planned_girls) > 0)

    if (activeStops.length === 0) continue

    // Resolve gender groups
    const { groups, warnings: genderWarnings } = resolveGenderGroups(
      activeStops,
      config.gender_mode,
      config.underfill_threshold
    )

    // Attach route context to gender warnings
    genderWarnings.forEach((w) => {
      globalWarnings.push({ ...w, context: route.name })
    })

    let routeBusCount = 0

    // For each gender group
    for (const group of groups) {
      // Split stops into capacity-fitting contiguous groups
      const capacityGroups = splitIntoContiguousGroups(
        activeStops,
        group.getCount,
        config.overload_limit > 0 ? buses[0]?.capacity ?? 40 : 40, // use first bus capacity as reference, will be per-bus below
        config.overload_limit
      )

      // Actually: we need to re-split per the actual bus capacity when we pick the bus.
      // Since we don't know which bus yet, use a simplified approach:
      // Greedily assign capacity groups to buses as we go.
      // We'll pack stops against the actual bus once we pick it.

      // Collect all stops for this gender group to re-split with actual bus capacity
      const stopsForGroup = activeStops
      const stopsWithCounts = stopsForGroup.map((s) => ({
        ...s,
        _count: group.getCount(s)
      }))

      // Get contiguous stop segments split by available bus capacity
      // We'll do a second pass: pick a bus, then split
      const remainingStops = [...stopsForGroup]

      while (remainingStops.length > 0) {
        // Pick the next available bus
        const bus = busPool.shift()

        if (!bus) {
          // No bus available — mark all remaining stops as unassigned
          remainingStops.forEach((stop) => {
            unassignedStops.push({
              stop_id: stop.stop_id,
              stop_name: stop.stop_name,
              route_id: route.id,
              route_name: route.name,
              reason: 'NO_AVAILABLE_BUS',
              planned_boys: stop.planned_boys,
              planned_girls: stop.planned_girls
            })
          })
          globalWarnings.push({
            type: 'NO_AVAILABLE_BUS',
            severity: 'CRITICAL',
            message: `No available bus for route "${route.name}" (${group.gender})`,
            context: route.name
          })
          break
        }

        // Split remaining stops to fit within this bus capacity
        const busCapacity = bus.capacity
        const busMax = busCapacity + config.overload_limit

        // Greedily pack stops for this bus
        const busStops: StopWithCount[] = []
        let busTotal = 0

        while (remainingStops.length > 0) {
          const next = remainingStops[0]
          const count = group.getCount(next)

          if (busStops.length > 0 && busTotal + count > busMax) {
            // This stop won't fit — stop packing for this bus
            break
          }

          busStops.push(next)
          busTotal += count
          remainingStops.shift()
        }

        const isOverloaded = busTotal > busCapacity
        const runWarnings: EngineWarning[] = []

        if (isOverloaded) {
          runWarnings.push({
            type: 'OVERLOADED',
            severity: 'WARNING',
            message: `Bus ${bus.number} is overloaded by ${busTotal - busCapacity} on route "${route.name}"`,
            context: route.name
          })
        }

        const proposed: ProposedRun = {
          temp_id: uuidv4(),
          bus_id: bus.id,
          bus_number: bus.number,
          route_id: route.id,
          route_name: route.name,
          route_color: route.color,
          direction: config.direction,
          gender: group.gender,
          stops: busStops.map((s) => ({
            stop_id: s.stop_id,
            stop_name: s.stop_name,
            student_count: group.getCount(s)
          })),
          totalStudents: busTotal,
          capacity: busCapacity,
          overload_limit: config.overload_limit,
          isOverloaded,
          warnings: runWarnings
        }

        proposedRuns.push(proposed)
        routeBusCount++
      }
    }

    if (routeBusCount > 1) {
      splitRouteIds.add(route.id)
    }
  }

  // Compile summary
  const totalStudentsAssigned = proposedRuns.reduce((sum, r) => sum + r.totalStudents, 0)
  const totalStudentsUnassigned = unassignedStops.reduce(
    (sum, s) => sum + s.planned_boys + s.planned_girls,
    0
  )

  const summary = {
    totalBusesUsed: proposedRuns.length,
    totalStudentsAssigned,
    totalStudentsUnassigned,
    overloadedRuns: proposedRuns.filter((r) => r.isOverloaded).length,
    splitRoutes: splitRouteIds.size
  }

  return {
    proposedRuns,
    unassignedStops,
    warnings: globalWarnings,
    summary
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTotalStudents(stops: StopWithCount[]): number {
  return stops.reduce((sum, s) => sum + s.planned_boys + s.planned_girls, 0)
}

function sortRoutes(
  routes: EngineInput['routes'],
  strategy: EngineInput['config']['strategy']
): EngineInput['routes'] {
  if (strategy === 'SEQUENCE_ORDER') return routes

  const withTotals = routes.map((r) => ({
    route: r,
    total: getTotalStudents(r.stops)
  }))

  if (strategy === 'LARGEST_ROUTE_FIRST') {
    withTotals.sort((a, b) => b.total - a.total)
  } else {
    // SMALLEST_ROUTE_FIRST
    withTotals.sort((a, b) => a.total - b.total)
  }

  return withTotals.map((r) => r.route)
}
