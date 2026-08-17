import type { RunGender } from '../../shared/types'

/**
 * Normalized shape any run-like source (saved RunWithDetails, in-memory
 * ProposedRun from the auto-planner) can be mapped to before grouping.
 */
export interface GroupableRun {
  route_id: string
  route_name: string
  route_color: string
  gender: RunGender
  bus_number: string
  stops: Array<{ stop_id: string; stop_name: string; sequence_order: number }>
}

export interface RunRouteGroup {
  key: string
  route_id: string
  route_name: string
  route_color: string
  /** stop names, in sequence order — this exact set is what one row means */
  stopNames: string[]
  /** the single bus carrying boys on this exact stop set, if any (BOYS or MIXED run) */
  boysBus: string | null
  /** the single bus carrying girls on this exact stop set, if any (GIRLS or MIXED run) */
  girlsBus: string | null
}

/**
 * Groups runs by route AND exact stop set — not by route alone. A route
 * split across multiple buses (segments covering different stops) becomes
 * multiple rows, one per segment, each naming its own single bus. Only runs
 * that share the identical stop set merge into one row (the boys-bus +
 * girls-bus pair case under SEPARATED gender mode).
 *
 * Grouping by route alone (the previous behavior) hid which stop belonged to
 * which bus whenever a route was split — a row would show every stop from
 * every segment together with all their bus numbers, with no way to tell
 * which stop went with which bus. That's worse than useless for drivers and
 * students who need to know their exact bus.
 */
export function groupRunsByRoute(runs: GroupableRun[]): RunRouteGroup[] {
  const groups = new Map<string, {
    route_id: string
    route_name: string
    route_color: string
    stops: Array<{ stop_id: string; name: string; seq: number }>
    boysBus: string | null
    girlsBus: string | null
  }>()

  for (const run of runs) {
    const sortedStops = [...run.stops].sort((a, b) => a.sequence_order - b.sequence_order)
    const key = run.route_id + '|' + sortedStops.map((s) => s.stop_id).join(',')

    if (!groups.has(key)) {
      groups.set(key, {
        route_id: run.route_id,
        route_name: run.route_name,
        route_color: run.route_color,
        stops: sortedStops.map((s) => ({ stop_id: s.stop_id, name: s.stop_name, seq: s.sequence_order })),
        boysBus: null,
        girlsBus: null
      })
    }
    const entry = groups.get(key)!

    if (run.gender === 'BOYS' || run.gender === 'MIXED') entry.boysBus = run.bus_number
    if (run.gender === 'GIRLS' || run.gender === 'MIXED') entry.girlsBus = run.bus_number
  }

  return [...groups.entries()].map(([key, entry]) => ({
    key,
    route_id: entry.route_id,
    route_name: entry.route_name,
    route_color: entry.route_color,
    stopNames: entry.stops.map((s) => s.name),
    boysBus: entry.boysBus,
    girlsBus: entry.girlsBus
  }))
}
