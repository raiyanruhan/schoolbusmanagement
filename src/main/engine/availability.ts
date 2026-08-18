import type { Bus, Run, RunDirection } from './types'

/**
 * Returns buses that are available for assignment.
 *
 * A bus is available if:
 *   1. status === 'ACTIVE'
 *   2. Not already assigned in existingRuns for this shift + direction
 *   3. Not held by another shift today whose time window conflicts (see crossShiftBusyBusIds)
 */
export function getAvailableBuses(
  buses: Bus[],
  existingRuns: Run[],
  shiftId: string,
  direction: RunDirection,
  crossShiftBusyBusIds?: Set<string>
): Bus[] {
  const usedBusIds = new Set(
    existingRuns
      .filter((r) => r.shift_id === shiftId && r.direction === direction)
      .map((r) => r.bus_id)
  )
  if (crossShiftBusyBusIds) {
    for (const id of crossShiftBusyBusIds) usedBusIds.add(id)
  }

  return buses.filter((b) => b.status === 'ACTIVE' && !usedBusIds.has(b.id))
}
