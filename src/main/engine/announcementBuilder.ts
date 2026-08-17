/**
 * Groups Runs into playable announcements and resolves them to audio clip
 * sequences. PURE — no DB access, no side effects.
 *
 * Runs that share the same route and the exact same set of stops (e.g. a
 * boys bus and a girls bus covering identical stops under SEPARATED gender
 * mode) are merged into ONE announcement with multiple bus/gender entries.
 * Runs covering a different subset of a route's stops (a split segment)
 * become their own announcement, trimmed to just that contiguous range of
 * the route's recorded clip.
 */

import type { AnnouncementEntry, AnnouncementGroup, RunWithDetails } from '../../shared/types'

export interface RunGroupInput {
  route_id: string
  route_name: string
  shift_id: string
  direction: string
  /** stops in sequence order, deduped across the group's runs */
  stops: Array<{ stop_id: string; stop_name: string; sequence_order: number }>
  members: Array<{ run_id: string; bus_id: string; bus_number: string; gender: RunWithDetails['gender'] }>
}

const GENDER_SORT_ORDER: Record<string, number> = { BOYS: 0, GIRLS: 1, MIXED: 2 }

export function groupRunsForAnnouncements(runs: RunWithDetails[]): RunGroupInput[] {
  const groups = new Map<string, RunGroupInput>()

  for (const run of runs) {
    const sortedStops = [...run.stops].sort((a, b) => a.sequence_order - b.sequence_order)
    const stopKey = sortedStops.map((s) => s.stop_id).join(',')
    const groupKey = `${run.route_id}|${stopKey}`

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        route_id: run.route_id,
        route_name: run.route.name,
        shift_id: run.shift_id,
        direction: run.direction,
        stops: sortedStops.map((s) => ({
          stop_id: s.stop_id,
          stop_name: s.stop.name,
          sequence_order: s.stop.sequence_order
        })),
        members: []
      })
    }

    groups.get(groupKey)!.members.push({
      run_id: run.id,
      bus_id: run.bus_id,
      bus_number: run.bus.number,
      gender: run.gender
    })
  }

  const result = [...groups.values()]
  for (const g of result) {
    g.members.sort((a, b) => (GENDER_SORT_ORDER[a.gender] ?? 9) - (GENDER_SORT_ORDER[b.gender] ?? 9))
  }
  return result
}

export interface ClipLookup {
  greeting: { url: string } | null
  route: (route_id: string) => { url: string } | null
  bus: (bus_id: string) => { url: string } | null
  gender: (gender: string) => { url: string } | null
}

export interface TimestampLookup {
  (route_id: string): Array<{ stop_id: string; start_ms: number; end_ms: number }>
}

export function resolveAnnouncementGroups(
  groups: RunGroupInput[],
  clips: ClipLookup,
  timestamps: TimestampLookup
): AnnouncementGroup[] {
  return groups.map((g) => {
    const routeClip = clips.route(g.route_id)
    const routeTimestamps = timestamps(g.route_id)
    const tsByStop = new Map(routeTimestamps.map((t) => [t.stop_id, t]))

    const marks = g.stops.map((s) => tsByStop.get(s.stop_id)).filter((t): t is NonNullable<typeof t> => !!t)
    const routeSegment = marks.length === g.stops.length && marks.length > 0
      ? { start_ms: Math.min(...marks.map((m) => m.start_ms)), end_ms: Math.max(...marks.map((m) => m.end_ms)) }
      : null

    const entries: AnnouncementEntry[] = g.members.map((m) => ({
      run_id: m.run_id,
      bus_id: m.bus_id,
      bus_number: m.bus_number,
      gender: m.gender,
      busClipUrl: clips.bus(m.bus_id)?.url ?? null,
      genderClipUrl: clips.gender(m.gender)?.url ?? null
    }))

    const isComplete = !!clips.greeting && !!routeClip && !!routeSegment
      && entries.every((e) => !!e.busClipUrl && !!e.genderClipUrl)

    return {
      key: `${g.route_id}|${g.stops.map((s) => s.stop_id).join(',')}`,
      route_id: g.route_id,
      route_name: g.route_name,
      shift_id: g.shift_id,
      direction: g.direction,
      stop_names: g.stops.map((s) => s.stop_name),
      greetingClipUrl: clips.greeting?.url ?? null,
      routeClipUrl: routeClip?.url ?? null,
      routeSegment,
      entries,
      isComplete
    }
  })
}
