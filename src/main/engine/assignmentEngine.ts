/**
 * Core assignment engine — PURE function, no DB access, no side effects.
 *
 * Pipeline:
 *   1. Filter available buses (ACTIVE + not used in this shift/direction)
 *   2. Sort routes by strategy
 *   3. For each route:
 *      a. Filter stops that have students
 *      b. Resolve gender groups (COMBINED / SEPARATED / AUTO with fallback)
 *      c. For each group → split into time+capacity-valid segments
 *      d. Optimize segment boundaries (backtracking ±1)
 *      e. Best-fit bus assignment per segment
 *   4. Compile output with warnings and summary
 */

import { v4 as uuidv4 } from 'uuid'
import { getAvailableBuses } from './availability'
import { resolveGenderGroups } from './genderLogic'
import { splitIntoSegments, optimizeBoundaries } from './segmentSplitter'
import type { SegmentConstraints } from './segmentSplitter'
import { findBestFitBus, removeFromPool } from './busSelector'
import { segmentTravelTimeMin, computeArrivalTime } from './timeCalculator'
import type {
  EngineInput,
  EngineOutput,
  ProposedRun,
  UnassignedStopInfo,
  EngineWarning,
  StopWithCount,
  Bus
} from './types'

export function runAssignmentEngine(input: EngineInput): EngineOutput {
  const { buses, routes, existingRuns, config } = input

  const proposedRuns: ProposedRun[] = []
  const unassignedStops: UnassignedStopInfo[] = []
  const globalWarnings: EngineWarning[] = []

  // 1. Available bus pool — sorted descending by capacity (for best-fit reference)
  let busPool: Bus[] = getAvailableBuses(
    buses,
    existingRuns,
    config.shift_id,
    config.direction,
    config.crossShiftBusyBusIds
  ).sort((a, b) => b.capacity - a.capacity)

  if (config.crossShiftBusyBusIds && config.crossShiftBusyBusIds.size > 0) {
    globalWarnings.push({
      type: 'CROSS_SHIFT_BUSY',
      severity: 'WARNING',
      message: `${config.crossShiftBusyBusIds.size} bus${config.crossShiftBusyBusIds.size !== 1 ? 'es are' : ' is'} held back — already committed to another shift with a conflicting or too-tight turnaround window today.`
    })
  }

  // Reference capacity = largest available bus (most optimistic split for fewest segments)
  const refCapacity = busPool[0]?.capacity ?? 40

  const baseSec = config.time_config?.base_stop_time_sec ?? 20
  const perStudentSec = config.time_config?.per_student_time_sec ?? 2

  // 2. Sort routes by strategy
  const sortedRoutes = sortRoutes(routes, config.strategy)

  const splitRouteIds = new Set<string>()

  // 3. Process each route
  for (const route of sortedRoutes) {
    // Only include stops that have students in this shift
    const activeStops = route.stops
      .filter((s) => (s.planned_boys + s.planned_girls) > 0)
      .sort((a, b) => a.sequence_order - b.sequence_order)

    if (activeStops.length === 0) continue

    const routeTotalStops = activeStops.length
    const routeTravelMin = route.travel_time_minutes ?? 0

    const baseConstraints: SegmentConstraints = {
      refCapacity,
      overload_limit: config.overload_limit,
      totalRouteStops: routeTotalStops,
      travel_time_minutes: routeTravelMin,
      timeConfig: config.time_config,
      baseSec,
      perStudentSec
    }

    // a. Resolve gender groups — with AUTO fallback
    let genderResult = resolveGenderGroups(activeStops, config.gender_mode, config.underfill_threshold)

    if (config.gender_mode === 'AUTO') {
      // Simulate SEPARATED to check bus availability
      const separatedResult = resolveGenderGroups(activeStops, 'SEPARATED', config.underfill_threshold)
      const busesNeeded = estimateBusesNeeded(activeStops, separatedResult.groups, baseConstraints)
      if (busesNeeded > busPool.length) {
        // Not enough buses for gender separation — fall back to COMBINED
        genderResult = resolveGenderGroups(activeStops, 'COMBINED', config.underfill_threshold)
        globalWarnings.push({
          type: 'GENDER_MISMATCH',
          severity: 'WARNING',
          message: `Route "${route.name}": insufficient buses for gender separation (need ${busesNeeded}, have ${busPool.length}). Falling back to COMBINED.`,
          context: route.name
        })
      }
    }

    // Propagate gender warnings with route context
    genderResult.warnings.forEach((w) => globalWarnings.push({ ...w, context: route.name }))

    let routeBusCount = 0

    // b. Process each gender group
    for (const group of genderResult.groups) {
      // Only stops where this group has students
      const groupStops = activeStops.filter((s) => group.getCount(s) > 0)
      if (groupStops.length === 0) continue

      // c. Split into constraint-valid segments
      const groupConstraints: SegmentConstraints = {
        ...baseConstraints,
        totalRouteStops: groupStops.length
      }

      let segments = splitIntoSegments(groupStops, group.getCount, groupConstraints)

      // d. Boundary optimization (balance load between adjacent segments)
      if (segments.length > 1) {
        segments = optimizeBoundaries(segments, group.getCount, groupConstraints)
      }

      // e. Assign best-fit bus to each segment
      for (const segment of segments) {
        const studentCount = segment.reduce((sum, s) => sum + group.getCount(s), 0)

        const found = findBestFitBus(busPool, studentCount, config.overload_limit)

        if (!found) {
          segment.forEach((stop) => {
            unassignedStops.push({
              stop_id: stop.stop_id,
              stop_name: stop.stop_name,
              route_id: route.id,
              route_name: route.name,
              reason: 'No available bus',
              planned_boys: stop.planned_boys,
              planned_girls: stop.planned_girls
            })
          })
          globalWarnings.push({
            type: 'NO_AVAILABLE_BUS',
            severity: 'CRITICAL',
            message: `No available bus for ${group.gender} group on route "${route.name}"`,
            context: route.name
          })
          continue
        }

        const { bus, index } = found
        busPool = removeFromPool(busPool, index)

        const isOverloaded = studentCount > bus.capacity
        const runWarnings: EngineWarning[] = []

        if (isOverloaded) {
          runWarnings.push({
            type: 'OVERLOADED',
            severity: 'WARNING',
            message: `Bus ${bus.number} overloaded by ${studentCount - bus.capacity} student${studentCount - bus.capacity !== 1 ? 's' : ''} on route "${route.name}"`,
            context: route.name
          })
        }

        // Compute arrival time (if time config is present)
        let arrival_time: string | undefined
        if (config.time_config) {
          const segStopTimeSec = segment.reduce(
            (sum, s) => sum + baseSec + group.getCount(s) * perStudentSec,
            0
          )
          const travelMin = segmentTravelTimeMin(
            segment.length,
            groupConstraints.totalRouteStops,
            routeTravelMin
          )
          const arrival = computeArrivalTime(config.time_config.departure_time, travelMin, segStopTimeSec)
          arrival_time = arrival.toISOString()

          if (arrival > config.time_config.arrival_deadline) {
            runWarnings.push({
              type: 'TIME_EXCEEDED',
              severity: 'WARNING',
              message: `Bus ${bus.number} may arrive after deadline on route "${route.name}" (est. ${arrival.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })})`,
              context: route.name
            })
          }
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
          stops: segment.map((s) => ({
            stop_id: s.stop_id,
            stop_name: s.stop_name,
            student_count: group.getCount(s)
          })),
          totalStudents: studentCount,
          capacity: bus.capacity,
          overload_limit: config.overload_limit,
          isOverloaded,
          warnings: runWarnings,
          ...(arrival_time !== undefined && { arrival_time })
        }

        proposedRuns.push(proposed)
        routeBusCount++
      }
    }

    if (routeBusCount > 1) splitRouteIds.add(route.id)
  }

  // Compile summary
  const totalStudentsAssigned = proposedRuns.reduce((sum, r) => sum + r.totalStudents, 0)
  const totalStudentsUnassigned = unassignedStops.reduce(
    (sum, s) => sum + s.planned_boys + s.planned_girls,
    0
  )

  return {
    proposedRuns,
    unassignedStops,
    warnings: globalWarnings,
    summary: {
      totalBusesUsed: proposedRuns.length,
      totalStudentsAssigned,
      totalStudentsUnassigned,
      overloadedRuns: proposedRuns.filter((r) => r.isOverloaded).length,
      splitRoutes: splitRouteIds.size
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Estimate the number of buses required for a set of gender groups.
 * Used to check feasibility of SEPARATED mode in AUTO logic.
 */
function estimateBusesNeeded(
  stops: StopWithCount[],
  groups: ReturnType<typeof resolveGenderGroups>['groups'],
  constraints: SegmentConstraints
): number {
  let total = 0
  const maxSeats = constraints.refCapacity + constraints.overload_limit

  for (const group of groups) {
    let current = 0
    let buses = 0

    for (const stop of stops) {
      const count = group.getCount(stop)
      if (count === 0) continue
      if (buses === 0) { buses = 1 }
      if (current + count > maxSeats) { buses++; current = count }
      else { current += count }
    }

    total += buses
  }

  return total
}

function sortRoutes(
  routes: EngineInput['routes'],
  strategy: EngineInput['config']['strategy']
): EngineInput['routes'] {
  if (strategy === 'SEQUENCE_ORDER') return routes

  const withTotals = routes.map((r) => ({
    route: r,
    total: r.stops.reduce((sum, s) => sum + s.planned_boys + s.planned_girls, 0)
  }))

  if (strategy === 'LARGEST_ROUTE_FIRST') {
    withTotals.sort((a, b) => b.total - a.total)
  } else {
    withTotals.sort((a, b) => a.total - b.total)
  }

  return withTotals.map((r) => r.route)
}
