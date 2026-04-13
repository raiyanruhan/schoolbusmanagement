/**
 * Constraint-aware segment splitter.
 *
 * Splits an ordered list of stops into the fewest possible contiguous segments
 * where each segment satisfies:
 *   1. Capacity constraint: Σ students ≤ refCapacity + overload_limit
 *   2. Time constraint (optional): arrival_time ≤ arrival_deadline
 *
 * After the greedy split, a backtracking boundary optimization pass runs
 * to minimize load imbalance between adjacent segments by shifting boundaries ±1.
 */

import type { StopWithCount, TimeConfig } from './types'
import {
  stopHandlingTimeSec,
  segmentTravelTimeMin,
  computeArrivalTime
} from './timeCalculator'

export interface SegmentConstraints {
  refCapacity: number
  overload_limit: number
  /** Total stop count in the route (for proportional travel time) */
  totalRouteStops: number
  travel_time_minutes: number
  timeConfig?: TimeConfig
  baseSec: number
  perStudentSec: number
}

// ─── Greedy split ─────────────────────────────────────────────────────────────

export function splitIntoSegments(
  stops: StopWithCount[],
  getCount: (s: StopWithCount) => number,
  constraints: SegmentConstraints
): StopWithCount[][] {
  const { refCapacity, overload_limit, baseSec, perStudentSec } = constraints
  const maxSeats = refCapacity + overload_limit

  const segments: StopWithCount[][] = []
  let current: StopWithCount[] = []
  let currentStudents = 0
  let currentStopTimeSec = 0

  for (const stop of stops) {
    const count = getCount(stop)
    const thisStopTimeSec = stopHandlingTimeSec(count, baseSec, perStudentSec)
    const newStudents = currentStudents + count
    const newStopTimeSec = currentStopTimeSec + thisStopTimeSec

    const capacityViolated = current.length > 0 && newStudents > maxSeats
    const timeViolated = current.length > 0 && constraints.timeConfig
      ? isTimeViolated(current.length + 1, newStopTimeSec, constraints)
      : false

    if (capacityViolated || timeViolated) {
      segments.push(current)
      current = [stop]
      currentStudents = count
      currentStopTimeSec = thisStopTimeSec
    } else {
      current.push(stop)
      currentStudents = newStudents
      currentStopTimeSec = newStopTimeSec
    }
  }

  if (current.length > 0) segments.push(current)

  return segments
}

// ─── Boundary optimizer ───────────────────────────────────────────────────────

/**
 * Local search over segment boundaries.
 * For each adjacent pair (A, B), tries:
 *   - Moving last stop of A → front of B
 *   - Moving first stop of B → end of A
 * Accepts if the move reduces |load(A) - load(B)| and both segments remain valid.
 *
 * Repeats until no improvement found (max 3 passes to bound O(n²) worst case).
 */
export function optimizeBoundaries(
  segments: StopWithCount[][],
  getCount: (s: StopWithCount) => number,
  constraints: SegmentConstraints
): StopWithCount[][] {
  if (segments.length < 2) return segments

  const result = segments.map((s) => [...s])
  let improved = true
  let pass = 0

  while (improved && pass < 3) {
    improved = false
    pass++

    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i]
      const b = result[i + 1]
      if (a.length < 2 && b.length < 2) continue

      const loadA = segmentLoad(a, getCount)
      const loadB = segmentLoad(b, getCount)
      const imbalance = Math.abs(loadA - loadB)

      // Option 1: move last stop of A → front of B
      if (a.length >= 2) {
        const newA = a.slice(0, -1)
        const newB = [a[a.length - 1], ...b]
        const newImbalance = Math.abs(segmentLoad(newA, getCount) - segmentLoad(newB, getCount))
        if (
          newImbalance < imbalance &&
          isSegmentValid(newB, getCount, constraints)
        ) {
          result[i] = newA
          result[i + 1] = newB
          improved = true
          continue
        }
      }

      // Option 2: move first stop of B → end of A
      if (b.length >= 2) {
        const newA = [...a, b[0]]
        const newB = b.slice(1)
        const newImbalance = Math.abs(segmentLoad(newA, getCount) - segmentLoad(newB, getCount))
        if (
          newImbalance < imbalance &&
          isSegmentValid(newA, getCount, constraints)
        ) {
          result[i] = newA
          result[i + 1] = newB
          improved = true
        }
      }
    }
  }

  return result
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function segmentLoad(stops: StopWithCount[], getCount: (s: StopWithCount) => number): number {
  return stops.reduce((sum, s) => sum + getCount(s), 0)
}

function isSegmentValid(
  stops: StopWithCount[],
  getCount: (s: StopWithCount) => number,
  constraints: SegmentConstraints
): boolean {
  const students = segmentLoad(stops, getCount)
  const maxSeats = constraints.refCapacity + constraints.overload_limit
  if (students > maxSeats) return false

  if (constraints.timeConfig) {
    const stopTimeSec = stops.reduce(
      (sum, s) => sum + stopHandlingTimeSec(getCount(s), constraints.baseSec, constraints.perStudentSec),
      0
    )
    if (isTimeViolated(stops.length, stopTimeSec, constraints)) return false
  }

  return true
}

function isTimeViolated(
  segmentSize: number,
  stopTimeSec: number,
  constraints: SegmentConstraints
): boolean {
  if (!constraints.timeConfig) return false
  const travelMin = segmentTravelTimeMin(
    segmentSize,
    constraints.totalRouteStops,
    constraints.travel_time_minutes
  )
  const arrival = computeArrivalTime(
    constraints.timeConfig.departure_time,
    travelMin,
    stopTimeSec
  )
  return arrival > constraints.timeConfig.arrival_deadline
}
