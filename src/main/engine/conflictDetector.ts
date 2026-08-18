// Pure conflict detection engine — no DB/UI imports, no side effects
import type { RunWithDetails, Bus, Conflict, Shift } from '../../shared/types'
import { computeShiftWindow, windowsConflict } from './shiftWindow'

export function detectConflicts(
  runs: RunWithDetails[],
  buses: Bus[],
  shifts: Shift[] = []
): Conflict[] {
  const conflicts: Conflict[] = []
  const shiftById = new Map(shifts.map((s) => [s.id, s]))
  const today = new Date()

  const busMap = new Map<string, Bus>()
  for (const b of buses) busMap.set(b.id, b)

  for (const run of runs) {
    // Conflicts exist to prompt operator action on runs that haven't happened
    // yet or are in progress. A COMPLETED run already happened safely — the
    // bus's current status (e.g. retired months later) doesn't retroactively
    // make history wrong, so don't keep flagging it forever.
    if (run.status === 'CANCELLED' || run.status === 'COMPLETED') continue

    const bus = busMap.get(run.bus_id)

    // BUS_UNAVAILABLE: bus is MAINTENANCE or RETIRED
    if (bus && (bus.status === 'MAINTENANCE' || bus.status === 'RETIRED')) {
      conflicts.push({
        type: 'BUS_UNAVAILABLE',
        severity: 'CRITICAL',
        message: `Bus ${bus.number} is ${bus.status.toLowerCase()} but assigned to run`,
        run_id: run.id,
        bus_id: bus.id
      })
    }

    // OVERLOAD: student count exceeds capacity + overload_limit
    const studentCount = run.stops.reduce((sum, rs) => sum + rs.student_count, 0)
    const capacity = bus?.capacity ?? 0
    const hardLimit = capacity + (run.overload_limit ?? 0)
    if (capacity > 0 && studentCount > hardLimit) {
      conflicts.push({
        type: 'OVERLOAD',
        severity: 'CRITICAL',
        message: `Run on bus ${bus?.number ?? run.bus_id} has ${studentCount} students (limit ${hardLimit})`,
        run_id: run.id,
        bus_id: run.bus_id
      })
    }
  }

  // TIME_COLLISION: same bus assigned to overlapping runs (same session)
  const byBus = new Map<string, RunWithDetails[]>()
  for (const run of runs) {
    // Conflicts exist to prompt operator action on runs that haven't happened
    // yet or are in progress. A COMPLETED run already happened safely — the
    // bus's current status (e.g. retired months later) doesn't retroactively
    // make history wrong, so don't keep flagging it forever.
    if (run.status === 'CANCELLED' || run.status === 'COMPLETED') continue
    if (!byBus.has(run.bus_id)) byBus.set(run.bus_id, [])
    byBus.get(run.bus_id)!.push(run)
  }

  for (const [busId, busRuns] of byBus) {
    const bus = busMap.get(busId)
    // Same shift + same direction twice — definitely a collision
    const seen = new Map<string, string>()
    for (const run of busRuns) {
      const key = `${run.shift_id}__${run.direction}`
      if (seen.has(key)) {
        conflicts.push({
          type: 'TIME_COLLISION',
          severity: 'CRITICAL',
          message: `Bus ${bus?.number ?? busId} assigned to multiple runs in the same shift/direction`,
          run_id: run.id,
          bus_id: busId
        })
      } else {
        seen.set(key, run.id)
      }
    }

    // Fleet is shared across shifts — flag a bus double-booked into two
    // DIFFERENT shifts whose real clock-time windows overlap (or leave too
    // little turnaround), using each run's shift timing fields.
    for (let i = 0; i < busRuns.length; i++) {
      for (let j = i + 1; j < busRuns.length; j++) {
        const a = busRuns[i]
        const b = busRuns[j]
        if (a.shift_id === b.shift_id) continue // same-shift dup already caught above

        const shiftA = shiftById.get(a.shift_id)
        const shiftB = shiftById.get(b.shift_id)
        if (!shiftA || !shiftB) continue

        const windowA = computeShiftWindow(shiftA, a.direction, today)
        const windowB = computeShiftWindow(shiftB, b.direction, today)
        if (!windowA || !windowB) continue

        if (windowsConflict(windowA, windowB)) {
          conflicts.push({
            type: 'TIME_COLLISION',
            severity: 'CRITICAL',
            message: `Bus ${bus?.number ?? busId} is double-booked — assigned to "${shiftA.name}" and "${shiftB.name}" with overlapping or too-tight turnaround windows`,
            run_id: a.id,
            bus_id: busId
          })
        }
      }
    }
  }

  // Deduplicate by run_id + type
  const seen = new Set<string>()
  return conflicts.filter((c) => {
    const key = `${c.type}__${c.run_id ?? c.bus_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
