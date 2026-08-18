// Pure helpers for reasoning about the real clock-time window a shift+direction
// occupies, and whether two such windows leave a bus enough turnaround time.
// Exists because the fleet is shared across shifts (not one bus per shift) —
// see Shift.inbound_*/outbound_* timing fields.

import { parseTimeToDate } from './timeCalculator'
import type { RunDirection } from '../../shared/types'

export interface TimeWindow {
  start: Date
  end: Date
}

export interface ShiftTiming {
  inbound_depart_school: string | null
  inbound_arrive_school: string | null
  outbound_depart_school: string | null
  outbound_arrive_stops: string | null
}

/** Minimum gap a bus needs between finishing one leg and starting the next. */
export const DEFAULT_TURNAROUND_BUFFER_MIN = 15

export function computeShiftWindow(
  shift: ShiftTiming,
  direction: RunDirection,
  referenceDate: Date
): TimeWindow | null {
  const [startStr, endStr] = direction === 'OUTBOUND'
    ? [shift.outbound_depart_school, shift.outbound_arrive_stops]
    : [shift.inbound_depart_school, shift.inbound_arrive_school]

  const start = parseTimeToDate(startStr, referenceDate)
  const end = parseTimeToDate(endStr, referenceDate)
  if (!start || !end || end <= start) return null
  return { start, end }
}

/** True if the windows overlap, or don't leave `bufferMin` of turnaround between them. */
export function windowsConflict(
  a: TimeWindow,
  b: TimeWindow,
  bufferMin: number = DEFAULT_TURNAROUND_BUFFER_MIN
): boolean {
  const bufMs = bufferMin * 60_000
  return a.start.getTime() < b.end.getTime() + bufMs && b.start.getTime() < a.end.getTime() + bufMs
}
