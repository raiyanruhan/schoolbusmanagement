// Pure conflict detection engine — no DB/UI imports, no side effects
import type { RunWithDetails, Bus, Conflict } from '../../shared/types'

export function detectConflicts(
  runs: RunWithDetails[],
  buses: Bus[]
): Conflict[] {
  const conflicts: Conflict[] = []

  const busMap = new Map<string, Bus>()
  for (const b of buses) busMap.set(b.id, b)

  for (const run of runs) {
    if (run.status === 'CANCELLED') continue

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
    if (run.status === 'CANCELLED') continue
    if (!byBus.has(run.bus_id)) byBus.set(run.bus_id, [])
    byBus.get(run.bus_id)!.push(run)
  }

  for (const [busId, busRuns] of byBus) {
    const bus = busMap.get(busId)
    // Group by same shift + same direction — that's a collision
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
