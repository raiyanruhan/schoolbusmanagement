import type { Bus, Run, RunDirection } from './types'

/**
 * Returns buses that are available for assignment.
 *
 * A bus is available if:
 *   1. status === 'ACTIVE'
 *   2. Not already assigned in existingRuns for this shift + direction
 */
export function getAvailableBuses(
  buses: Bus[],
  existingRuns: Run[],
  shiftId: string,
  direction: RunDirection
): Bus[] {
  const usedBusIds = new Set(
    existingRuns
      .filter((r) => r.shift_id === shiftId && r.direction === direction)
      .map((r) => r.bus_id)
  )

  return buses.filter((b) => b.status === 'ACTIVE' && !usedBusIds.has(b.id))
}
