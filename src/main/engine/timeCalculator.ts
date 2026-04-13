/**
 * Pure time calculation functions — no side effects, no imports from engine types.
 *
 * Formulas:
 *   stop_time_sec = base_stop_time_sec + (students × per_student_time_sec)
 *   segment_stop_time_sec = Σ stop_time_sec for each stop in segment
 *   travel_time_min = (segment_stops / total_route_stops) × route_travel_time_min
 *   run_time_min = travel_time_min + (segment_stop_time_sec / 60)
 *   arrival = departure + run_time_min
 */

export function stopHandlingTimeSec(
  studentCount: number,
  baseSec: number,
  perStudentSec: number
): number {
  return baseSec + studentCount * perStudentSec
}

export function segmentStopTimeSec(
  studentCounts: number[],
  baseSec: number,
  perStudentSec: number
): number {
  return studentCounts.reduce(
    (sum, count) => sum + stopHandlingTimeSec(count, baseSec, perStudentSec),
    0
  )
}

/** Proportional travel time for a segment that covers `segmentStops` out of `totalRouteStops`. */
export function segmentTravelTimeMin(
  segmentStops: number,
  totalRouteStops: number,
  routeTravelTimeMin: number
): number {
  if (totalRouteStops === 0 || routeTravelTimeMin === 0) return 0
  return (segmentStops / totalRouteStops) * routeTravelTimeMin
}

export function computeArrivalTime(
  departure: Date,
  travelTimeMin: number,
  stopTimeSec: number
): Date {
  const totalMin = travelTimeMin + stopTimeSec / 60
  return new Date(departure.getTime() + totalMin * 60_000)
}

export function parseTimeToDate(timeStr: string | null | undefined, baseDate: Date): Date | null {
  if (!timeStr) return null
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const [, hh, mm] = match
  const d = new Date(baseDate)
  d.setHours(parseInt(hh), parseInt(mm), 0, 0)
  return d
}
